/**
 * Every run the daemon is already serving.
 *
 * Without this, watching a run means already knowing its ID — and a restarted
 * daemon resumes every unfinished run it finds without telling anyone which
 * ones. Polled rather than pushed: the same tradeoff telemetry makes, and for
 * the same reason — this is a list, not a stream, and it changes rarely enough
 * that polling is honest about how fresh it is.
 */

import { useEffect, useState, type ReactNode } from 'react';
import { listRuns } from '../api/client.js';
import { RunState, type Run } from '../gen/signal/garden/v1/garden_pb.js';
import { num } from '../api/json.js';
import { useGardenDispatch } from '../state/gardenStore.js';

const pollMs = 3000;

const stateLabel: Record<RunState, string> = {
  [RunState.UNSPECIFIED]: 'unknown',
  [RunState.RUNNING]: 'running',
  [RunState.PAUSED]: 'paused',
  [RunState.FINISHED]: 'finished',
};

export function RunList({ onAttached }: { onAttached: (runId: string) => void }): ReactNode {
  const dispatch = useGardenDispatch();
  const [runs, setRuns] = useState<Run[] | undefined>(undefined);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;

    const poll = async (): Promise<void> => {
      try {
        const response = await listRuns(controller.signal);
        setRuns(response.runs);
        setFailed(false);
      } catch {
        // The daemon being unreachable is already visible elsewhere (starting
        // a run or attaching by ID will surface it); this list just goes
        // stale rather than adding a second banner for the same fact.
        setFailed(true);
      }
      if (!controller.signal.aborted) timer = setTimeout(() => void poll(), pollMs);
    };

    void poll();

    return () => {
      controller.abort();
      if (timer !== undefined) clearTimeout(timer);
    };
  }, []);

  const watch = (run: Run): void => {
    dispatch({ type: 'run/loaded', run });
    onAttached(run.runId);
  };

  return (
    <section className="panel run-list">
      <h2>Active runs</h2>

      {runs === undefined && failed && <p className="empty">Can&apos;t reach the daemon.</p>}
      {runs === undefined && !failed && <p className="empty">Looking…</p>}
      {runs !== undefined && runs.length === 0 && (
        <p className="empty">Nothing running. Start one, or attach by ID below.</p>
      )}

      {runs !== undefined && runs.length > 0 && (
        <ul className="run-list-rows" data-testid="run-list">
          {runs.map((run) => (
            <li key={run.runId} className="run-list-row">
              <span className="run-list-id">{run.runId}</span>
              <span className={`badge badge--${stateLabel[run.state]}`}>
                {stateLabel[run.state]}
              </span>
              <span className="run-list-tick">tick {num(run.tick)}</span>
              {run.resumed && (
                <span
                  className="badge"
                  title="resumed after a daemon restart: its determinism chain starts fresh"
                >
                  resumed
                </span>
              )}
              <button type="button" onClick={() => watch(run)}>
                Watch
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
