/**
 * The projection stream.
 *
 * A frame per tick over a WebSocket, carrying the same `GardenSnapshot` the
 * REST route serves, marshalled the same way. This module owns three things the
 * rest of the app should never have to think about:
 *
 *   1. **Resuming.** Every snapshot names `folded_offset` — the first log record
 *      that garden has not folded. Holding the last one means a reconnect asks
 *      for exactly what it missed instead of starting over at the current
 *      garden and silently skipping a gap.
 *
 *   2. **Checking the handover.** A resumed stream sends one catch-up frame
 *      first, and `catchup.to` must equal the `folded_offset` of the snapshot
 *      immediately behind it. Anything else is a record the client never sees
 *      or one it sees twice, so it is reported rather than absorbed.
 *
 *   3. **Telling a finished run from a dropped connection.** The daemon closes
 *      normally (1000, "run finished") when a run ends. Every other close is a
 *      drop, and is retried.
 *
 * Nothing sent on this socket changes a run: the daemon discards client
 * messages, and every command goes through `src/api/client.ts`.
 */

import { fromJson, type JsonValue } from '@bufbuild/protobuf';
import { streamUrl } from './config.js';
import { GardenError } from './errors.js';
import { getRun } from './client.js';
import {
  type Catchup,
  FrameType,
  type GardenSnapshot,
  ProjectionFrameSchema,
} from '../gen/signal/garden/v1/garden_pb.js';

export type StreamStatus =
  /** Opening a socket for the first time. */
  | 'connecting'
  /** Reconnecting, and asking for the records missed since the last snapshot. */
  | 'resuming'
  /** Frames are arriving. */
  | 'live'
  /** The connection dropped and a retry is scheduled. */
  | 'reconnecting'
  /** The run ended and the daemon closed the socket normally. Terminal. */
  | 'finished'
  /** The run is gone, or retrying is pointless. Terminal. */
  | 'failed';

/**
 * A break in the handover between a catch-up frame and the snapshot behind it.
 *
 * `to` and `foldedOffset` disagreeing is not a cosmetic mismatch: it means the
 * garden on screen was not built from the records this client was given. It is
 * surfaced so a person sees it, rather than being logged and rendered over.
 */
export interface HandoverBreak {
  expected: bigint;
  actual: bigint;
  /** Positive when records were skipped, negative when records repeat. */
  drift: bigint;
}

export interface ProjectionStreamHandlers {
  onSnapshot: (snapshot: GardenSnapshot) => void;
  onCatchup?: (catchup: Catchup) => void;
  onStatus?: (status: StreamStatus, detail?: string) => void;
  onHandoverBreak?: (gap: HandoverBreak) => void;
  onError?: (error: GardenError) => void;
}

/** Backoff between reconnects, capped. The stream is paced by ticks, not latency. */
const backoffMillis = [250, 500, 1000, 2000, 4000, 8000];

export class ProjectionStream {
  #socket: WebSocket | undefined;
  #timer: ReturnType<typeof setTimeout> | undefined;
  #attempt = 0;
  #closed = false;

  /** The offset to resume from: the last snapshot's `folded_offset`. */
  #foldedOffset: bigint | undefined;

  /** A catch-up frame promises where it ends; the next snapshot has to agree. */
  #pendingHandover: bigint | undefined;

  /**
   * Consecutive resume attempts that never opened.
   *
   * A browser cannot read the status the daemon writes before the upgrade, so a
   * refused offset and an unreachable daemon look identical from here. After
   * two failed resumes the offset is dropped and the stream reconnects as a new
   * client: it costs the records in the gap, and it is the only way out of an
   * offset the daemon will refuse forever. See docs/known-limits.md.
   */
  #failedResumes = 0;

  constructor(
    private readonly runId: string,
    private readonly handlers: ProjectionStreamHandlers,
  ) {}

  /** Open the stream. Safe to call once; use `close()` to stop it. */
  start(): void {
    this.#closed = false;
    this.#connect();
  }

  /** Stop the stream and cancel any pending retry. Terminal. */
  close(): void {
    this.#closed = true;
    if (this.#timer !== undefined) clearTimeout(this.#timer);
    this.#timer = undefined;
    const socket = this.#socket;
    this.#socket = undefined;
    socket?.close(1000, 'client closed');
  }

  /**
   * Close the live socket on purpose, not terminally. This takes the exact
   * path a real drop takes — the same `onclose` handler, the same resume
   * from `folded_offset`, the same catch-up and handover check — so that
   * path can be watched on demand rather than only trusted. 3000 is an
   * application-defined close code, chosen so this never collides with 1000
   * ("run finished"), which onclose treats as terminal.
   */
  disconnect(): void {
    this.#socket?.close(3000, 'reconnect demo');
  }

  /** Where a reconnect would resume from, for display. */
  get foldedOffset(): bigint | undefined {
    return this.#foldedOffset;
  }

  #connect(): void {
    if (this.#closed) return;

    const resuming = this.#foldedOffset !== undefined;
    this.#status(resuming ? 'resuming' : 'connecting');

    const socket = new WebSocket(streamUrl(this.runId, this.#foldedOffset));
    this.#socket = socket;

    socket.onopen = () => {
      this.#attempt = 0;
      this.#failedResumes = 0;
      this.#status('live');
    };

    socket.onmessage = (message: MessageEvent<string>) => this.#receive(message.data);

    socket.onclose = (event: CloseEvent) => {
      if (this.#socket !== socket) return;
      this.#socket = undefined;
      if (this.#closed) return;

      // A run that ended closes normally and says so. Anything else dropped.
      if (event.code === 1000) {
        this.#status('finished', event.reason || 'run finished');
        return;
      }
      if (resuming) this.#failedResumes += 1;
      void this.#retry();
    };

    // `onerror` carries no detail in any browser; the close event that follows
    // is where the decision gets made.
    socket.onerror = () => {};
  }

  #receive(raw: string): void {
    let frame;
    try {
      frame = fromJson(ProjectionFrameSchema, JSON.parse(raw) as JsonValue, {
        ignoreUnknownFields: true,
      });
    } catch (cause) {
      this.handlers.onError?.(
        new GardenError(
          'unknown',
          0,
          'unparseable projection frame',
          cause instanceof Error ? cause.message : undefined,
        ),
      );
      return;
    }

    switch (frame.type) {
      case FrameType.CATCHUP: {
        if (frame.catchup === undefined) return;
        this.#pendingHandover = frame.catchup.to;
        this.handlers.onCatchup?.(frame.catchup);
        return;
      }
      case FrameType.SNAPSHOT: {
        const snapshot = frame.snapshot;
        if (snapshot === undefined) return;
        this.#checkHandover(snapshot);
        this.#foldedOffset = snapshot.foldedOffset;
        this.handlers.onSnapshot(snapshot);
        return;
      }
      default:
        return;
    }
  }

  #checkHandover(snapshot: GardenSnapshot): void {
    const expected = this.#pendingHandover;
    this.#pendingHandover = undefined;
    if (expected === undefined || expected === snapshot.foldedOffset) return;

    this.handlers.onHandoverBreak?.({
      expected,
      actual: snapshot.foldedOffset,
      drift: snapshot.foldedOffset - expected,
    });
  }

  async #retry(): Promise<void> {
    if (this.#closed) return;

    // Two resumes that never opened means the offset itself may be the problem.
    // Ask REST whether the run is even there before deciding.
    if (this.#failedResumes >= 2) {
      const gone = await this.#runIsGone();
      if (gone) {
        this.#status('failed', 'the run is gone');
        return;
      }
      this.#foldedOffset = undefined;
      this.#failedResumes = 0;
      this.#status('reconnecting', 'resuming failed twice: reconnecting as a new client');
    }

    const delay = backoffMillis[Math.min(this.#attempt, backoffMillis.length - 1)] ?? 8000;
    this.#attempt += 1;
    this.#status('reconnecting', `retrying in ${delay}ms`);
    this.#timer = setTimeout(() => this.#connect(), delay);
  }

  async #runIsGone(): Promise<boolean> {
    try {
      await getRun(this.runId);
      return false;
    } catch (error) {
      return error instanceof GardenError && error.reason === 'not_found';
    }
  }

  #status(status: StreamStatus, detail?: string): void {
    this.handlers.onStatus?.(status, detail);
  }
}
