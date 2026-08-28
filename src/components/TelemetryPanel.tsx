/**
 * System pressure, in the terms the system uses.
 *
 * The number worth watching is the gap between `log_offset` and
 * `committed_offset`: it is what a restart would redeliver, and idempotent
 * processing is what makes that harmless. It moves at snapshot cadence rather
 * than per tick, so it climbs and drops in sawteeth by design rather than
 * because something is wrong.
 *
 * `pending` is consumer lag. It is zero while the processor drains inside the
 * tick that produced the events, and it becomes interesting at M3, when the
 * consumer can actually fall behind.
 */

import type { ReactNode } from 'react';
import { millisFromDuration, num } from '../api/json.js';
import { historyValues, ratePerSecond } from '../api/pressure.js';
import { useGarden } from '../state/gardenStore.js';
import { Sparkline } from './Sparkline.js';

export function TelemetryPanel(): ReactNode {
  const { telemetry, telemetryHistory } = useGarden();

  if (telemetry === undefined) {
    return (
      <section className="panel telemetry">
        <h2>Pressure</h2>
        <p className="empty">No telemetry yet.</p>
      </section>
    );
  }

  const processor = telemetry.processor;
  const redeliverable = telemetry.logOffset - telemetry.committedOffset;

  const publishedRate = ratePerSecond(telemetryHistory, (t) => t.published);
  const appliedRate = ratePerSecond(telemetryHistory, (t) => t.processor?.applied ?? 0n);
  const redeliverableHistory = historyValues(
    telemetryHistory,
    (t) => t.logOffset - t.committedOffset,
  );

  return (
    <section className="panel telemetry">
      <h2>Pressure</h2>

      <dl className="telemetry-grid">
        <PressureMetric
          name="published"
          value={num(telemetry.published)}
          rate={publishedRate}
          history={historyValues(telemetryHistory, (t) => t.published)}
        />
        <Metric
          name="pending"
          value={num(telemetry.pending)}
          hint="events published, not yet processed"
        />
        <PressureMetric
          name="applied"
          value={processor ? num(processor.applied) : 0}
          rate={appliedRate}
          history={historyValues(telemetryHistory, (t) => t.processor?.applied ?? 0n)}
        />
        <Metric
          name="duplicates"
          value={processor ? num(processor.duplicates) : 0}
          hint="redelivered events the processor recognised and dropped"
        />
        <Metric name="no effect" value={processor ? num(processor.noEffect) : 0} />
        <Metric name="rejected" value={processor ? num(processor.rejected) : 0} />
        <PressureMetric
          name="uncommitted"
          value={num(redeliverable)}
          history={redeliverableHistory}
          hint="records a restart would redeliver — climbs and drops in sawteeth by design, at snapshot cadence"
        />
        <Metric name="log offset" value={num(telemetry.logOffset)} />
        <Metric name="subscribers" value={telemetry.subscribers} />
        <Metric
          name="frames dropped"
          value={num(telemetry.snapshotsDropped)}
          hint="snapshots a slow subscriber never received"
        />
        <Metric name="tick pace" value={`${millisFromDuration(telemetry.tickInterval)}ms`} />
        <Metric
          name="uptime"
          value={`${Math.round(millisFromDuration(telemetry.uptime) / 1000)}s`}
        />
      </dl>

      {processor !== undefined && Object.keys(processor.byType).length > 0 && (
        <ul className="by-type">
          {Object.entries(processor.byType).map(([type, count]) => (
            <li key={type}>
              <span>{type}</span>
              <span>{String(count)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function PressureMetric({
  name,
  value,
  rate,
  history,
  hint,
}: {
  name: string;
  value: number;
  rate?: number | undefined;
  history: number[];
  hint?: string;
}): ReactNode {
  const spanSeconds = Math.min(history.length, 60);
  const title =
    (hint === undefined ? '' : `${hint} — `) +
    `last ${spanSeconds}s: ${Math.min(...history, value)}–${Math.max(...history, value)}`;

  return (
    <div className="metric metric--pressure" title={title}>
      <dt>{name}</dt>
      <dd>
        {value}
        {rate !== undefined && (
          <span className="metric-rate">
            {rate >= 0 ? '+' : ''}
            {rate.toFixed(1)}/s
          </span>
        )}
      </dd>
      <Sparkline values={history} />
    </div>
  );
}

function Metric({
  name,
  value,
  hint,
}: {
  name: string;
  value: number | string;
  hint?: string;
}): ReactNode {
  return (
    <div className="metric" title={hint}>
      <dt>{name}</dt>
      <dd>{value}</dd>
    </div>
  );
}
