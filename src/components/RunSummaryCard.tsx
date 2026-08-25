/**
 * The scorecard a finished run leaves behind.
 *
 * A finished run is still readable: its history is on disk, its snapshot stands
 * where it ended, and replaying its log reaches the same hash in a different
 * process. That is what the hash here is for.
 */

import type { ReactNode } from 'react';
import { num } from '../api/json.js';
import { useGarden } from '../state/gardenStore.js';

export function RunSummaryCard(): ReactNode {
  const { summary } = useGarden();
  if (summary === undefined) return null;

  const { run, snapshot, telemetry } = summary;

  return (
    <section className="panel run-summary" data-testid="run-summary">
      <h2>Run finished</h2>
      <dl>
        <div>
          <dt>run</dt>
          <dd>{run?.runId}</dd>
        </div>
        <div>
          <dt>seed</dt>
          <dd>{run?.seed}</dd>
        </div>
        <div>
          <dt>ticks</dt>
          <dd>{run ? num(run.tick) : '—'}</dd>
        </div>
        <div>
          <dt>alive</dt>
          <dd>{snapshot?.stats ? `${snapshot.stats.alive} / ${snapshot.stats.organisms}` : '—'}</dd>
        </div>
        <div>
          <dt>total stage</dt>
          <dd>{snapshot?.stats?.totalStage ?? '—'}</dd>
        </div>
        <div>
          <dt>published</dt>
          <dd>{telemetry ? num(telemetry.published) : '—'}</dd>
        </div>
        <div>
          <dt>duplicates dropped</dt>
          <dd>{telemetry?.processor ? num(telemetry.processor.duplicates) : '—'}</dd>
        </div>
        <div>
          <dt>hash</dt>
          <dd className="garden-hash">{snapshot?.hash}</dd>
        </div>
      </dl>
      {run?.failure !== undefined && run.failure !== '' && (
        <p role="alert">ended early: {run.failure}</p>
      )}
    </section>
  );
}
