// `vitest/config` rather than `vite`: it is the same defineConfig with the test
// block typed, so the unit-test setup lives beside the dev server it shares.
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// The daemon serves the REST routes and the projection stream on one origin,
// and it sends CORS headers by default (SIGNAL_GARDEN_CORS_ORIGIN=*), so the
// dev server does not proxy. VITE_SIGNAL_GARDEN_HTTP is the one address to
// configure; src/api/config.ts derives the WebSocket URL from it.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    // Docker Desktop's bind mount on macOS doesn't reliably forward fsevents
    // into the container, so the native watcher misses edits. Polling costs
    // nothing outside that setup and fixes it there.
    watch: { usePolling: true },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['tests/unit/**/*.test.ts?(x)'],
    setupFiles: ['tests/unit/setup.ts'],
  },
});
