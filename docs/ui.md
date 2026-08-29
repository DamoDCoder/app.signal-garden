# The Interface

Each panel exists to answer one question. A panel that does not answer its question is a panel
that should be cut rather than decorated.

## Before A Run

| Panel       | Question                                          | Notes                                                                 |
| ----------- | ------------------------------------------------- | --------------------------------------------------------------------- |
| Start a run | _What garden do I want, and under what pressure?_ | Seed, organisms, pace, max ticks, starting mix, and `duplicate_every` |
| Watch a run | _What is this daemon already doing?_              | Attach by run ID, including a run resumed after a restart             |

`duplicate_every` deserves its place on the first screen. It republishes every Nth event of a tick,
which makes at-least-once delivery a control a person turns rather than a property they are asked
to believe. Turn it to 1 and every event is delivered twice; the garden does not change, and the
duplicate counter climbs. That is the M2 exit criterion, clickable.

The seed is next to it for the same reason: two runs with the same seed and the same control ticks
reach the same garden, and the hash under the garden is how that gets checked rather than asserted.

## During A Run

| Panel             | Question                                    | Reads                                       |
| ----------------- | ------------------------------------------- | ------------------------------------------- |
| Garden            | _What is happening to the garden?_          | `GardenSnapshot` from the stream            |
| Controls          | _What can I change, and when does it land?_ | `ControlRevision` from `PATCH .../controls` |
| Pressure          | _What is the system doing to keep up?_      | `TelemetrySnapshot`, polled                 |
| Connection        | _Is what I am looking at current?_          | Stream status and `folded_offset`           |
| Missed while away | _What did I not see?_                       | The catch-up frame's events                 |
| Run finished      | _How did it end, and can it be reproduced?_ | `RunSummary`                                |

### Garden

Three values per organism, three visual channels, so a glance separates a thirsty garden from a
sick one instead of averaging them into one blob:

- **stage** drives size,
- **health** drives colour, green through red,
- **moisture** drives the ring.

The garden hash is shown rather than hidden. It is the claim the project makes — replay a run's log
in another process and reach the same hash — so it belongs on screen next to the garden it
fingerprints.

### Controls

A control change is **staged**, not applied. The daemon answers with a revision and the tick that
revision starts on, because a change accepted partway through a tick lands on the next boundary.
The panel reports that tick rather than saying "applied", so the delay a person sees in the garden
is the delay the system promised rather than a bug they have to explain to themselves.

The Apply button stays inert until something has actually moved. A draft is local intent; it is
cleared when the receipt arrives, not when the request is sent.

M3 added three sliders past the original four: `worker count` and `batch size` together cap how
many records one tick folds — `0` on either is unbounded, the behavior before the pair existed —
and `fail snapshot every` makes the daemon's periodic on-disk save fail its first attempt and retry
every Nth time, `0` off. All three are live-tunable the same way rain/growth/pest are; there is
nothing special about them mechanically, only what they mean.

### Pressure

The number worth watching is the gap between `log_offset` and `committed_offset`: it is what a
restart would redeliver, and idempotent processing is what makes that harmless. It moves at
snapshot cadence rather than per tick, so it climbs and drops in sawteeth **by design**. A panel
that made that look like a fault would be lying about a healthy system.

`pending` is consumer lag, and it is zero while the processor drains inside the tick that produced
the events. It genuinely moves now: set `worker count`/`batch size` below `events per tick` in the
Controls panel and `pending` climbs, capacity below production building a real backlog rather than
a synthetic one. Showing it at zero the rest of the time is honest; hiding it until it moves would
mean nobody knows what changed when it does.

`snapshot save retries`/`snapshot save failures` are the on-disk save's own counters — not the
`frames dropped` above them, which are WebSocket `GardenSnapshot` frames a slow subscriber never
received. Set `fail snapshot every` in the Controls panel and `retries` climbs by one at every
snapshot-cadence tick; `failures` stays at zero, because the injected failure only ever occupies the
save's first attempt — the point being demonstrated is a transient failure that recovers, not one
that doesn't.

### Connection

Two numbers that are not interchangeable, labelled so:

- `sequence` counts frames **this connection** received.
- `folded_offset` names the **history** behind the current frame, and is what a reconnect resumes
  from.

A break in the handover — a catch-up frame that ends somewhere other than where the snapshot behind
it stands — is an alert, not a log line. It means the garden on screen was not built from the
records this client was given, and there is no honest way to render over that.

## What The Interface Owes M1

The daemon's feedback plan asks, after M1: _does the UI make system pressure legible?_ All four gaps
this raised are answered:

- **A pressure history, not just instantaneous counters.** `published`, `applied`, and
  `uncommitted` each keep a 60-sample rolling window and plot it as a sparkline; `published` and
  `applied` also show a rate. `uncommitted` is the one worth watching — its sparkline is the
  sawtooth the daemon's docs promise, checkable rather than asserted.
- **Duplicate delivery visible in the garden's stillness.** The hash line under the garden now
  reads the count directly: `<hash> · unchanged through N duplicate deliveries`, computed from the
  processor's duplicate count at the moment the current hash first appeared. The idempotency story
  is one line instead of two panels a person has to notice are related.
- **Tick-boundary latency**, next to the revision receipt: `revision N takes effect at tick T — 3
ticks away`, counting down as the stream's snapshots advance, then switching to `landed` once
  `snapshot.revision` actually reaches `N` — not a guess from tick arithmetic alone, since a
  snapshot's own revision is what the daemon says is in effect.
- **Reconnect as a demonstrable act.** A "Drop connection" button next to the connection status,
  live only while the stream is `live`, closes the socket with an application-defined close code
  (3000, so it is never mistaken for the daemon's own 1000 "run finished"). The `onclose` handler
  cannot tell that from a real drop, so it takes the exact same path: `reconnecting`, `resuming`
  from `folded_offset`, the catch-up frame, the handover check. "Missed while away" states the
  gap's true size — `catchup.to - catchup.from` — even when the display list itself is capped at
  200 records, which it previously was not: the panel used to report the truncated list's length
  as the gap, understating a large one.
