/**
 * One address to configure.
 *
 * The daemon serves the generated REST routes and the WebSocket projection
 * stream on the same HTTP listener, so the stream URL is derived from the base
 * rather than configured separately — two settings would only ever be a way to
 * point them at different daemons by accident.
 */

const rawBase = import.meta.env.VITE_SIGNAL_GARDEN_HTTP ?? 'http://localhost:8080';

/** Base HTTP origin of the daemon, without a trailing slash. */
export const httpBase = rawBase.replace(/\/+$/, '');

/** Base WebSocket origin, same host, scheme swapped. */
export const wsBase = httpBase.replace(/^http/, 'ws');

/**
 * How often the performance panel polls telemetry.
 *
 * Telemetry does not stream: the daemon's contracts document says the panel
 * polls GET /v1/runs/{run_id}/telemetry, and folding it into the stream is M3's
 * work, once the counters become histograms worth pushing.
 */
export const telemetryPollMs = Number(import.meta.env.VITE_TELEMETRY_POLL_MS ?? 1000);

export const restUrl = (path: string): string => `${httpBase}${path}`;

/**
 * The projection stream for one run.
 *
 * `from` is a log offset. Passing it makes this a returning client: the daemon
 * sends one catch-up frame carrying the records between that offset and the
 * snapshot immediately behind it. Omitting it starts at the garden as it is now.
 */
export const streamUrl = (runId: string, from?: bigint): string => {
  const base = `${wsBase}/v1/runs/${encodeURIComponent(runId)}/stream`;
  return from === undefined ? base : `${base}?from=${from.toString()}`;
};
