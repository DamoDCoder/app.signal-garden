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

**Still open:**

- Garden interactions worth watching for five minutes.
- A production build rather than a dev server in Compose.
- A genuinely clean _machine_ — this repo's setup has only been run on machines that already had
  the toolchain installed.
- Pre-configured Prometheus and Jaeger dashboards for `compose.observability.yaml` — provisioned so
  `task observability:up` opens straight into a built dashboard rather than an empty query box.

## Not Planned Here

- Any garden rule in the browser.
- A second definition of a garden, an event, or a frame.
- Commands over the projection stream.
- Multiplayer, before single-client replay is boring.
