/**
 * One place that knows what is happening.
 *
 * The daemon is the authority for garden state — the processor decides what a
 * garden is, and this client renders projections rather than calculating
 * outcomes. So this store holds exactly two kinds of thing: the last message of
 * each type the daemon sent, and the local intent that has not been acknowledged
 * yet (a control draft the person is dragging, a request in flight).
 *
 * Nothing here derives a garden. When a snapshot and a local guess disagree, the
 * snapshot wins, because the alternative is a UI that quietly diverges from the
 * system it claims to be showing.
 */

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useReducer,
  type Dispatch,
  type ReactNode,
} from 'react';
import type { HandoverBreak, StreamStatus } from '../api/stream.js';
import { GardenError } from '../api/errors.js';
import type {
  Controls,
  ControlRevision,
  Event as GardenEvent,
  GardenSnapshot,
  Run,
  RunSummary,
  TelemetrySnapshot,
} from '../gen/signal/garden/v1/garden_pb.js';

/** How many catch-up events the feed keeps. A gap can be thousands of records. */
const eventFeedLimit = 200;

/** How many polled telemetry samples the pressure history keeps, oldest first. */
export const telemetryHistoryLimit = 60;

export interface GardenState {
  run: Run | undefined;
  snapshot: GardenSnapshot | undefined;
  telemetry: TelemetrySnapshot | undefined;
  /** Polled samples, oldest first, capped at telemetryHistoryLimit. One run's worth. */
  telemetryHistory: TelemetrySnapshot[];
  summary: RunSummary | undefined;

  /** The last accepted control change, which names the tick it takes effect on. */
  revision: ControlRevision | undefined;

  /**
   * The processor's duplicate count at the moment the current hash first
   * appeared. The difference between that and the latest polled count is how
   * many redelivered events this exact garden state has survived unchanged —
   * idempotency as a fact next to the hash it did not move, not two counters
   * a person has to notice are related.
   */
  hashStableSince: { hash: string; duplicatesAtStart: bigint } | undefined;

  /** What the person has moved but not sent yet. Undefined means "no draft". */
  draft: Controls | undefined;

  stream: {
    status: StreamStatus;
    detail: string | undefined;
    /** Set when a catch-up frame and the snapshot behind it disagreed. */
    handoverBreak: HandoverBreak | undefined;
  };

  /** Newest first. Only ever populated by catch-up frames. */
  missedEvents: GardenEvent[];

  /** In-flight command count, so buttons can show they are working. */
  pending: number;

  error: GardenError | undefined;
}

const initialState: GardenState = {
  run: undefined,
  snapshot: undefined,
  telemetry: undefined,
  telemetryHistory: [],
  summary: undefined,
  revision: undefined,
  hashStableSince: undefined,
  draft: undefined,
  stream: { status: 'connecting', detail: undefined, handoverBreak: undefined },
  missedEvents: [],
  pending: 0,
  error: undefined,
};

export type GardenAction =
  | { type: 'run/loaded'; run: Run }
  | { type: 'run/cleared' }
  | { type: 'snapshot/received'; snapshot: GardenSnapshot }
  | { type: 'telemetry/received'; telemetry: TelemetrySnapshot }
  | { type: 'summary/received'; summary: RunSummary }
  | { type: 'controls/drafted'; controls: Controls }
  | { type: 'controls/accepted'; revision: ControlRevision }
  | { type: 'stream/status'; status: StreamStatus; detail?: string | undefined }
  | { type: 'stream/handoverBreak'; gap: HandoverBreak }
  | { type: 'stream/catchup'; events: GardenEvent[] }
  | { type: 'command/started' }
  | { type: 'command/settled' }
  | { type: 'error/raised'; error: GardenError }
  | { type: 'error/cleared' };

export function reducer(state: GardenState, action: GardenAction): GardenState {
  switch (action.type) {
    case 'run/loaded':
      // A fresh attach: the previous run's telemetry would otherwise linger and
      // draw a history that spans two different gardens.
      return {
        ...state,
        run: action.run,
        telemetry: undefined,
        telemetryHistory: [],
        hashStableSince: undefined,
        error: undefined,
      };

    case 'run/cleared':
      return { ...initialState };

    case 'snapshot/received': {
      // A snapshot carries run state as well as a garden, so the lifecycle on
      // screen follows the stream rather than waiting for the next REST poll.
      const hashChanged = state.snapshot?.hash !== action.snapshot.hash;
      return {
        ...state,
        snapshot: action.snapshot,
        run: state.run
          ? { ...state.run, state: action.snapshot.state, tick: action.snapshot.tick }
          : state.run,
        hashStableSince:
          hashChanged || state.hashStableSince === undefined
            ? {
                hash: action.snapshot.hash,
                duplicatesAtStart: state.telemetry?.processor?.duplicates ?? 0n,
              }
            : state.hashStableSince,
      };
    }

    case 'telemetry/received':
      return {
        ...state,
        telemetry: action.telemetry,
        telemetryHistory: [...state.telemetryHistory, action.telemetry].slice(
          -telemetryHistoryLimit,
        ),
      };

    case 'summary/received':
      return {
        ...state,
        summary: action.summary,
        run: action.summary.run ?? state.run,
        snapshot: action.summary.snapshot ?? state.snapshot,
        telemetry: action.summary.telemetry ?? state.telemetry,
      };

    case 'controls/drafted':
      return { ...state, draft: action.controls };

    case 'controls/accepted':
      // The draft is cleared on acceptance, not on send: until the daemon
      // issues a revision, what the person moved is still only local intent.
      //
      // The revision's controls are folded into run.controls here rather than
      // left for the next GetRun: this is not a guess at what the daemon will
      // do, it is the daemon's own echo of what it just accepted. Without
      // this, the effective controls fall back to the run's stale pre-edit
      // value the moment the draft clears, and Apply looks like it reverted
      // the sliders and did nothing — the change did land, at the tick the
      // receipt names, but nothing on screen said so.
      return {
        ...state,
        revision: action.revision,
        draft: undefined,
        run:
          state.run && action.revision.controls
            ? {
                ...state.run,
                controls: action.revision.controls,
                revision: action.revision.revision,
              }
            : state.run,
      };

    case 'stream/status':
      return {
        ...state,
        stream: { ...state.stream, status: action.status, detail: action.detail },
      };

    case 'stream/handoverBreak':
      return { ...state, stream: { ...state.stream, handoverBreak: action.gap } };

    case 'stream/catchup':
      return {
        ...state,
        missedEvents: [...action.events].reverse().slice(0, eventFeedLimit),
      };

    case 'command/started':
      return { ...state, pending: state.pending + 1, error: undefined };

    case 'command/settled':
      return { ...state, pending: Math.max(0, state.pending - 1) };

    case 'error/raised':
      return { ...state, error: action.error };

    case 'error/cleared':
      return { ...state, error: undefined };
  }
}

const StateContext = createContext<GardenState | undefined>(undefined);
const DispatchContext = createContext<Dispatch<GardenAction> | undefined>(undefined);

export function GardenProvider({ children }: { children: ReactNode }): ReactNode {
  const [state, dispatch] = useReducer(reducer, initialState);
  return (
    <StateContext.Provider value={state}>
      <DispatchContext.Provider value={dispatch}>{children}</DispatchContext.Provider>
    </StateContext.Provider>
  );
}

export function useGarden(): GardenState {
  const state = useContext(StateContext);
  if (state === undefined) throw new Error('useGarden used outside GardenProvider');
  return state;
}

export function useGardenDispatch(): Dispatch<GardenAction> {
  const dispatch = useContext(DispatchContext);
  if (dispatch === undefined) throw new Error('useGardenDispatch used outside GardenProvider');
  return dispatch;
}

/**
 * Run a command, and put its failure somewhere a person can see it.
 *
 * Every REST call in this app goes through here, so a rejected control change
 * and an unreachable daemon are reported the same way rather than each caller
 * inventing its own handling.
 */
export function useCommand(): <T>(work: () => Promise<T>) => Promise<T | undefined> {
  const dispatch = useGardenDispatch();

  return useCallback(
    async <T,>(work: () => Promise<T>): Promise<T | undefined> => {
      dispatch({ type: 'command/started' });
      try {
        return await work();
      } catch (error) {
        dispatch({
          type: 'error/raised',
          error:
            error instanceof GardenError
              ? error
              : new GardenError(
                  'unknown',
                  0,
                  'command failed',
                  error instanceof Error ? error.message : undefined,
                ),
        });
        return undefined;
      } finally {
        dispatch({ type: 'command/settled' });
      }
    },
    [dispatch],
  );
}

/** The controls on screen: the draft if there is one, otherwise the run's. */
export function useEffectiveControls(): Controls | undefined {
  const { draft, run } = useGarden();
  return useMemo(() => draft ?? run?.controls, [draft, run]);
}
