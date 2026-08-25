/**
 * The command and query surface: the generated REST routes.
 *
 * Everything that changes a run goes through here. The projection stream is a
 * read transport and never carries a command — that boundary is the daemon's,
 * and this client keeps it rather than reproducing half of it.
 *
 * Messages are parsed with the generated schemas rather than used as raw JSON,
 * so snake_case field names, enum spellings, and the 64-bit string encoding are
 * handled in one place at the edge. `ignoreUnknownFields` is on deliberately: a
 * daemon one tag ahead of the pinned contract adds fields, and a client that
 * threw on them would break on a compatible change.
 */

import {
  create,
  fromJson,
  toJson,
  type DescMessage,
  type JsonValue,
  type MessageShape,
} from '@bufbuild/protobuf';
import { restUrl } from './config.js';
import { durationFromMillis } from './json.js';
import { GardenError, reasonForStatus } from './errors.js';
import {
  type Controls,
  ControlsSchema,
  type ControlRevision,
  ControlRevisionSchema,
  type GardenSnapshot,
  GardenSnapshotSchema,
  type Run,
  RunSchema,
  type RunSummary,
  RunSummarySchema,
  StartRunRequestSchema,
  type TelemetrySnapshot,
  TelemetrySnapshotSchema,
} from '../gen/signal/garden/v1/garden_pb.js';

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH';
  body?: unknown;
  signal?: AbortSignal;
}

const parseOptions = { ignoreUnknownFields: true } as const;

async function request<Desc extends DescMessage>(
  path: string,
  schema: Desc,
  options: RequestOptions = {},
): Promise<MessageShape<Desc>> {
  const { method = 'GET', body, signal } = options;

  const init: RequestInit = { method };
  if (body !== undefined) {
    init.headers = { 'content-type': 'application/json' };
    init.body = JSON.stringify(body);
  }
  if (signal) init.signal = signal;

  let response: Response;
  try {
    response = await fetch(restUrl(path), init);
  } catch (cause) {
    throw new GardenError(
      'offline',
      0,
      `${method} ${path} could not reach the daemon`,
      cause instanceof Error ? cause.message : undefined,
    );
  }

  if (!response.ok) {
    // grpc-gateway renders errors as {"code":…,"message":…,"details":[…]}.
    // The message is for a person to read; the status is what we branch on.
    const detail = await response
      .text()
      .then(readMessage)
      .catch(() => undefined);
    throw new GardenError(
      reasonForStatus(response.status),
      response.status,
      `${method} ${path} failed with ${response.status}`,
      detail,
    );
  }

  return fromJson(schema, (await response.json()) as JsonValue, parseOptions);
}

const readMessage = (raw: string): string | undefined => {
  if (raw === '') return undefined;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed === 'object' && parsed !== null && 'message' in parsed) {
      const { message } = parsed as { message?: unknown };
      if (typeof message === 'string') return message;
    }
  } catch {
    // A plain-text body — the projection stream's rejections look like this.
  }
  return raw.trim();
};

/** What a run is started with. Fields left out take the daemon's defaults. */
export interface StartRunOptions {
  /** Optional. The daemon picks a free ID when this is empty. */
  runId?: string;
  /** An opaque 64-bit token, carried as a string end to end. */
  seed: string;
  organisms: number;
  controls: Controls;
  /** Wall-clock pace. It changes how fast a garden is watched, never where it ends up. */
  tickIntervalMillis?: number;
  /** Zero runs until the run is finished by hand. */
  maxTicks?: bigint;
  /** Republish every Nth event of a tick, which makes the idempotency demo a control. */
  duplicateEvery?: number;
}

export const startRun = (options: StartRunOptions, signal?: AbortSignal): Promise<Run> => {
  const message = create(StartRunRequestSchema, {
    runId: options.runId ?? '',
    seed: options.seed,
    organisms: options.organisms,
    controls: options.controls,
    maxTicks: options.maxTicks ?? 0n,
    duplicateEvery: options.duplicateEvery ?? 0,
    ...(options.tickIntervalMillis === undefined
      ? {}
      : { tickInterval: durationFromMillis(options.tickIntervalMillis) }),
  });

  return request('/v1/runs', RunSchema, {
    method: 'POST',
    body: toJson(StartRunRequestSchema, message),
    ...(signal ? { signal } : {}),
  });
};

export const getRun = (runId: string, signal?: AbortSignal): Promise<Run> =>
  request(`/v1/runs/${encodeURIComponent(runId)}`, RunSchema, signal ? { signal } : {});

/**
 * Stage a control change.
 *
 * The receipt carries `effective_tick`: the tick at which the producer starts
 * obeying these controls. A change accepted partway through a tick lands on the
 * next boundary, so the receipt is what the UI reports rather than "applied".
 */
export const updateControls = (
  runId: string,
  controls: Controls,
  signal?: AbortSignal,
): Promise<ControlRevision> =>
  request(`/v1/runs/${encodeURIComponent(runId)}/controls`, ControlRevisionSchema, {
    method: 'PATCH',
    // The route binds body: "controls", so the body is the Controls message
    // itself rather than the enclosing request.
    body: toJson(ControlsSchema, controls),
    ...(signal ? { signal } : {}),
  });

/** Pause and resume are one method with one meaning: `paused` says which. */
export const pauseRun = (runId: string, paused: boolean, signal?: AbortSignal): Promise<Run> =>
  request(`/v1/runs/${encodeURIComponent(runId)}:pause`, RunSchema, {
    method: 'POST',
    body: { paused },
    ...(signal ? { signal } : {}),
  });

/** Finishing returns the scorecard the run leaves behind. */
export const finishRun = (runId: string, signal?: AbortSignal): Promise<RunSummary> =>
  request(`/v1/runs/${encodeURIComponent(runId)}:finish`, RunSummarySchema, {
    method: 'POST',
    body: {},
    ...(signal ? { signal } : {}),
  });

export const getSnapshot = (runId: string, signal?: AbortSignal): Promise<GardenSnapshot> =>
  request(
    `/v1/runs/${encodeURIComponent(runId)}/snapshot`,
    GardenSnapshotSchema,
    signal ? { signal } : {},
  );

export const getTelemetry = (runId: string, signal?: AbortSignal): Promise<TelemetrySnapshot> =>
  request(
    `/v1/runs/${encodeURIComponent(runId)}/telemetry`,
    TelemetrySnapshotSchema,
    signal ? { signal } : {},
  );

/** Liveness and readiness, for the connection banner. */
export const readyz = async (signal?: AbortSignal): Promise<boolean> => {
  try {
    const response = await fetch(restUrl('/readyz'), signal ? { signal } : {});
    return response.ok;
  } catch {
    return false;
  }
};
