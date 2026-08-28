# Client Roadmap

The milestones are the daemon's. This is what each one needs from the browser.

## M1: Local Vertical Slice — _in progress here_

The daemon's half is done. What remains is this repository's, and it is what M1's exit criteria are
now waiting on.

**Exit criteria still open:**

- `docker compose up` starts the local stack. _(Compose is written; it needs a run through on a
  clean machine.)_
- A run can start, update controls, pause, and finish, from the browser.
- Browser tests cover the primary journey.

**Feedback question:** _does the UI make system pressure legible?_ [docs/ui.md](ui.md) tracks this —
a pressure history, duplicate delivery visible in the garden's stillness, and tick-boundary latency
are answered; reconnect as a demonstrable act, rather than an invisible recovery, is what remains.

## M2: Event Backbone And Replay — _supported, not yet shown off_

The durable half is done in the daemon and this client speaks to it: it resumes from
`folded_offset`, checks the handover, and survives a daemon restart mid-run.

What is missing is the _demonstration_. The M2 story — stop the consumer, create lag, restart,
replay to the same state — is currently a terminal exercise. Making it a thing a person can do in
the browser is the client's contribution to that milestone:

- a deliberate disconnect, so catch-up can be watched rather than inferred,
- the size of the gap a reconnect covered, in records,
- the garden hash held next to the duplicate counter, so idempotency is one glance.

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
