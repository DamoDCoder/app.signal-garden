# Client Roadmap

The milestones are the daemon's. This is what each one needs from the browser.

## M1: Local Vertical Slice — _in progress here_

The daemon's half is done. What remains is this repository's, and it is what M1's exit criteria are
now waiting on.

**Exit criteria still open:**

- `docker compose up` starts the local stack. _(Compose is written; it needs a run through on a
  clean machine.)_

**Done:**

- A run can start, update controls, pause, and finish, from the browser.
- Browser tests cover the primary journey. [tests/e2e/primary-journey.spec.ts](../tests/e2e/primary-journey.spec.ts)
  starts a run, steers it, and finishes it.

**Feedback question:** _does the UI make system pressure legible?_ [docs/ui.md](ui.md) tracks this —
all four gaps it raised (a pressure history, duplicate delivery in the garden's stillness,
tick-boundary latency, and reconnect as a demonstrable act) are now answered.

## M2: Event Backbone And Replay — _demonstrated, live-verified_

The three things this milestone asked of the browser — a deliberate disconnect so catch-up can be
watched rather than inferred, the size of the gap a reconnect covered stated in records, and the
garden hash held next to the duplicate counter — were built as part of M1's feedback question and
are done. See [docs/ui.md](ui.md).

Verifying them against a *real* outage (`docker compose stop garden`, not just a client-side socket
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

## M3: Failure And Performance Lab

- A pressure history: throughput, lag, and freshness over a rolling window rather than as totals.
- Latency histograms once the daemon emits them, and telemetry over the stream once it is worth
  pushing.
- Worker count and batch size become real controls in the contract at M3; the control panel takes
  them as new sliders.
- Failure injection as a control surface, in the same spirit as `duplicate_every`.

## M4: Showcase Release

- Garden interactions worth watching for five minutes.
- A deterministic demo seed reachable in one click, with the hash shown so the determinism claim is
  checkable on screen.
- A production build rather than a dev server in Compose.
- The setup path verified from a clean machine.

## Not Planned Here

- Any garden rule in the browser.
- A second definition of a garden, an event, or a frame.
- Commands over the projection stream.
- Multiplayer, before single-client replay is boring.
