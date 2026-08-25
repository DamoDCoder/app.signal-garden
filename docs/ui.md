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

### Pressure

The number worth watching is the gap between `log_offset` and `committed_offset`: it is what a
restart would redeliver, and idempotent processing is what makes that harmless. It moves at
snapshot cadence rather than per tick, so it climbs and drops in sawteeth **by design**. A panel
that made that look like a fault would be lying about a healthy system.

`pending` is consumer lag, and it is zero while the processor drains inside the tick that produced
the events. It becomes interesting at M3, when the consumer can genuinely fall behind. Showing it
at zero now is honest; hiding it until it moves would mean nobody knows what changed when it does.

### Connection

Two numbers that are not interchangeable, labelled so:

- `sequence` counts frames **this connection** received.
- `folded_offset` names the **history** behind the current frame, and is what a reconnect resumes
  from.

A break in the handover — a catch-up frame that ends somewhere other than where the snapshot behind
it stands — is an alert, not a log line. It means the garden on screen was not built from the
records this client was given, and there is no honest way to render over that.

## What The Interface Still Owes M1

The daemon's feedback plan asks, after M1: _does the UI make system pressure legible?_ The current
panels are readable but static. What would answer the question:

- A **pressure strip over time** rather than instantaneous counters — a rate needs a history to be
  a rate.
- **Duplicate delivery made visible in the garden's stillness**: the duplicate counter climbing
  while the garden hash holds is the entire idempotency story in two numbers, and it currently
  takes two panels to see.
- **Reconnect as a demonstrable act**: dropping the socket on purpose and watching the catch-up
  frame arrive, with the gap it covered stated in records rather than implied.
- **Tick-boundary latency** shown as the distance between a control's `effective_tick` and the
  garden actually changing.
