# Client Roadmap

The milestones are the daemon's. This is what each one needs from the browser.

## M1: Local Vertical Slice — _done_

**Done:**

- A run can start, update controls, pause, and finish, from the browser.
- Browser tests cover the primary journey. [tests/e2e/primary-journey.spec.ts](../tests/e2e/primary-journey.spec.ts)
  starts a run, steers it, and finishes it.
- `docker compose up` starts the local stack. Verified: `task docker:build` in the daemon checkout,
  `task up` here — both containers reach `healthy`, and a run started, ticked, and finished over the
  composed stack's REST routes.

**Feedback question:** _does the UI make system pressure legible?_ [docs/ui.md](ui.md) tracks this —
all four gaps it raised (a pressure history, duplicate delivery in the garden's stillness,
tick-boundary latency, and reconnect as a demonstrable act) are now answered.

## M2: Event Backbone And Replay — _demonstrated, live-verified_

The three things this milestone asked of the browser — a deliberate disconnect so catch-up can be
watched rather than inferred, the size of the gap a reconnect covered stated in records, and the
garden hash held next to the duplicate counter — were built as part of M1's feedback question and
are done. See [docs/ui.md](ui.md).

Verifying them against a _real_ outage (`docker compose stop garden`, not just a client-side socket
drop) found a genuine daemon bug: shutting down closed every open projection stream with
`CloseNormalClosure` / "run finished" — the same code and reason a run finishing sends — even though
the run was mid-run and came right back on restart. A client reading the one thing a browser's
`CloseEvent` reliably exposes, the close code, could not tell a restart from a real ending, and gave
up instead of reconnecting. Fixed in the daemon: shutdown now closes with `CloseGoingAway` (1001),
the standard code for "the server is leaving, not the resource," which the client's existing
drop-and-reconnect path already handles correctly with no client change — 1001 is simply not 1000.
`TestStreamClosesGoingAwayWhenTheRegistryShutsDown` is the regression.

Live-verified end to end: started a run, stopped the daemon container mid-run, watched the client
back off through `reconnecting` (250ms → 8s), restarted the daemon, watched it resume to `live` on
its own tick — no button, no manual reconnect, the same path a dropped WiFi connection would take.

## M3: Failure And Performance Lab — _client half done_

**Done:**

- A pressure history: throughput, lag, and freshness over a rolling window rather than as totals —
  built as part of M1's feedback question, above.
- Worker count and batch size are real controls at `CONTRACT` `v0.13.0`; the Controls panel takes
  them as new sliders, live-tunable mid-run the same way every other control is.
- Failure injection as a control surface, in the same spirit as `duplicate_every`:
  `fail_snapshot_every` is a slider in the Controls panel, and `snapshot_save_retries`/
  `snapshot_save_failures` are visible in the Pressure panel.

**Exit criteria still open:**

- Latency histograms once the daemon emits them over `GetTelemetry` — it doesn't yet; Prometheus
  `/metrics` is the daemon's only latency surface so far, and this client doesn't poll that.
- Telemetry over the stream, once it's worth pushing rather than polling.

## M4: Showcase Release

**Done:**

- **The setup path, run from a fresh clone.** `nvm use`, `task setup`, `task up` against a scratch
  clone of this repo (plus a fresh `signal-garden` clone for `task docker:build`) — all succeeded,
  daemon and client both came up healthy, a run started. Not a fully clean _machine_: same Docker
  image store, npm cache, and already-installed Node/Docker/`task` as everywhere else this was run
  from — that's the gap still open. See [signal-garden's roadmap](https://github.com/DamoDCoder/signal-garden/blob/main/docs/roadmap.md)
  for the full writeup, since the daemon half of the same check ran alongside this one.
- **A deterministic demo seed reachable in one click, hash shown.** Turned out to already be true —
  `RunLauncher`'s defaults (seed `42`, 20 organisms, the balanced starting mix) already were the
  demo seed, verified by starting two independent runs with nothing changed and confirming identical
  hashes at the same tick. What was missing was saying so: a line above the form now states the
  defaults are the demo, rather than leaving a returning visitor to notice a coincidence. No new
  mechanics — reusing the existing `.hint` style, not a new affordance.
- **A production build rather than a dev server in Compose.** The `Dockerfile` is now two stages:
  `node:22-alpine` runs the same `npm run build` a person runs, and `nginx:1.27-alpine` serves the
  `dist/` bundle it produces. No bind mounts and no `npm run dev` in the stack — `task dev` stays
  the inner loop. nginx listens on 5173 so every doc, the Playwright config, and the published URL
  are unchanged; the container swap underneath is invisible. `VITE_SIGNAL_GARDEN_HTTP` moved from a
  runtime `environment` value to a `build.args` value, because Vite bakes it into the bundle — the
  browser downloads a fixed daemon address, and changing it means `docker compose up --build`. A
  `.dockerignore` keeps the host `node_modules` and prior `dist/` out of the build context.
  Verified: image builds offline, `/` and a deep link both serve `index.html`, hashed assets come
  back `immutable`, and the `http://localhost:8080` default is present in the shipped JS.

- **Pre-configured dashboards for `compose.observability.yaml`.** `task observability:up` now also
  starts Grafana on `:3000` — no login, opening straight onto a provisioned **Signal Garden**
  dashboard rather than an empty query box. Prometheus's own UI has no saved-dashboard concept and
  Jaeger's is trace search only, so Grafana is the piece that makes "opens into a built dashboard"
  real. Two datasources (Prometheus, Jaeger) and one dashboard JSON live under
  `observability/grafana/` and are file-provisioned; nothing is clicked to wire them, and UI edits
  are overwritten on restart. Panels cover the daemon's whole `/metrics` surface — event rate by
  outcome, pending-events lag, tick-duration p50/p95/p99, RPC rate and p95 by method, non-OK RPC
  responses, WebSocket freshness, snapshot save retries and failures — plus a Jaeger traces panel
  for `signalgardend`. Verified end to end against a live run: datasources resolve over the compose
  network, every Prometheus panel returns real series, and the traces panel lists spans. The raw
  `:9091` and `:16686` UIs are still published for a query box and trace search. No named volume,
  same as `prometheus` — it is a demo tool, provisioned fresh each start.

**Still open:**

- Garden interactions worth watching for five minutes.
- A genuinely clean _machine_ — this repo's setup has only been run on machines that already had
  the toolchain installed.

## Not Planned Here

- Any garden rule in the browser.
- A second definition of a garden, an event, or a frame.
- Commands over the projection stream.
- Multiplayer, before single-client replay is boring.
