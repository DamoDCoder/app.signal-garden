/**
 * Poll telemetry for the performance panel.
 *
 * Telemetry is not on the stream. The daemon's contract says the panel polls
 * `GET /v1/runs/{run_id}/telemetry`, and folding it into the projection frames
 * is M3's, once the counters become histograms worth pushing. Polling here
 * rather than pretending it streams keeps that visible.
 */

import { useEffect } from 'react';
import { getTelemetry } from '../api/client.js';
import { telemetryPollMs } from '../api/config.js';
import { useGardenDispatch } from '../state/gardenStore.js';

export function useTelemetry(runId: string | undefined, enabled = true): void {
  const dispatch = useGardenDispatch();

  useEffect(() => {
    if (runId === undefined || runId === '' || !enabled) return;

    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;

    const poll = async (): Promise<void> => {
      try {
        const telemetry = await getTelemetry(runId, controller.signal);
        dispatch({ type: 'telemetry/received', telemetry });
      } catch {
        // A failed poll is not worth a banner: the connection status already
        // says whether the daemon is there, and the next tick tries again.
      }
      if (!controller.signal.aborted) timer = setTimeout(() => void poll(), telemetryPollMs);
    };

    void poll();

    return () => {
      controller.abort();
      if (timer !== undefined) clearTimeout(timer);
    };
  }, [runId, enabled, dispatch]);
}
