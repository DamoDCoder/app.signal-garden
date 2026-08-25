/// <reference types="vite/client" />

/**
 * The two settings this client has, typed so `import.meta.env` is not `any`.
 * Both are read once in `src/api/config.ts` and nowhere else.
 */
interface ImportMetaEnv {
  /** The daemon's public HTTP origin. The stream URL is derived from it. */
  readonly VITE_SIGNAL_GARDEN_HTTP?: string;
  /** Telemetry poll interval in milliseconds. Telemetry does not stream until M3. */
  readonly VITE_TELEMETRY_POLL_MS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
