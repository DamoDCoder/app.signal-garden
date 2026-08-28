/**
 * Turning polled telemetry samples into a rate and a shape.
 *
 * A counter alone cannot say whether the system is at a steady trickle or a
 * burst that just stopped — that needs the samples around it, not the latest
 * one. Everything here reads `telemetryHistory` (oldest first, capped) and is
 * pure: no state of its own, so a chart re-derives the same numbers a table
 * would show.
 */

import type { TelemetrySnapshot } from '../gen/signal/garden/v1/garden_pb.js';
import { millisFromTimestamp } from './json.js';

/** Only the trailing slice of history counts toward "recent" rate. */
const recentWindowMillis = 5000;

/**
 * Events per second over the trailing window, from a monotonically
 * increasing counter field. Undefined until two dated samples exist to take
 * a delta between.
 */
export const ratePerSecond = (
  history: TelemetrySnapshot[],
  select: (snapshot: TelemetrySnapshot) => bigint,
): number | undefined => {
  const dated = history
    .map((snapshot) => ({
      atMillis: millisFromTimestamp(snapshot.observedAt),
      value: select(snapshot),
    }))
    .filter(
      (sample): sample is { atMillis: number; value: bigint } => sample.atMillis !== undefined,
    );

  if (dated.length < 2) return undefined;

  const newest = dated[dated.length - 1]!;
  const cutoff = newest.atMillis - recentWindowMillis;
  const windowStart = dated.find((sample) => sample.atMillis >= cutoff) ?? dated[0]!;

  const elapsedSeconds = (newest.atMillis - windowStart.atMillis) / 1000;
  if (elapsedSeconds <= 0) return undefined;

  return Number(newest.value - windowStart.value) / elapsedSeconds;
};

/** The plotted values for a sparkline, oldest first. */
export const historyValues = (
  history: TelemetrySnapshot[],
  select: (snapshot: TelemetrySnapshot) => bigint,
): number[] => history.map((snapshot) => Number(select(snapshot)));
