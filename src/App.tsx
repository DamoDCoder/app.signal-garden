/**
 * Signal Garden's control surface.
 *
 * Two states: no run, and a run. Before a run there is configuration — start
 * one, or attach to one the daemon is already serving. During a run the screen
 * is one garden, one set of controls, and the pressure the system is under,
 * because the whole claim of this project is that those three things are the
 * same story told three ways.
 */

import { useState, type ReactNode } from 'react';
import { RunState } from './gen/signal/garden/v1/garden_pb.js';
import { useProjectionStream } from './hooks/useProjectionStream.js';
import { useTelemetry } from './hooks/useTelemetry.js';
import { useGarden, useGardenDispatch } from './state/gardenStore.js';
import { AttachToRun } from './components/AttachToRun.js';
import { ConnectionStatus } from './components/ConnectionStatus.js';
import { ControlPanel } from './components/ControlPanel.js';
import { ErrorBanner } from './components/ErrorBanner.js';
import { EventFeed } from './components/EventFeed.js';
import { GardenView } from './components/GardenView.js';
import { RunLauncher } from './components/RunLauncher.js';
import { RunList } from './components/RunList.js';
import { RunSummaryCard } from './components/RunSummaryCard.js';
import { TelemetryPanel } from './components/TelemetryPanel.js';

export function App(): ReactNode {
  const [runId, setRunId] = useState<string | undefined>(undefined);
  const { run, snapshot } = useGarden();
  const dispatch = useGardenDispatch();

  const { disconnect } = useProjectionStream(runId);
  // A finished run's counters do not move, so polling one is noise.
  useTelemetry(runId, (snapshot?.state ?? run?.state) !== RunState.FINISHED);

  const leave = (): void => {
    setRunId(undefined);
    dispatch({ type: 'run/cleared' });
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1>Signal Garden</h1>
        {runId !== undefined && (
          <>
            <span className="run-id" data-testid="run-id">
              {runId}
            </span>
            {run?.resumed === true && (
              <span
                className="badge"
                title="resumed after a daemon restart: its determinism chain starts fresh"
              >
                resumed
              </span>
            )}
            <ConnectionStatus onDisconnect={disconnect} />
            <button type="button" onClick={leave}>
              Leave run
            </button>
          </>
        )}
      </header>

      <ErrorBanner />

      {runId === undefined ? (
        <main className="setup">
          <RunLauncher onStarted={setRunId} />
          <div className="setup-watch">
            <RunList onAttached={setRunId} />
            <AttachToRun onAttached={setRunId} />
          </div>
        </main>
      ) : (
        <main className="dashboard">
          <GardenView />
          <ControlPanel />
          <TelemetryPanel />
          <RunSummaryCard />
          <EventFeed />
        </main>
      )}
    </div>
  );
}
