# Five Minutes Worth Watching

The daemon repository's [`docs/demo.md`](https://github.com/DamoDCoder/signal-garden/blob/main/docs/demo.md)
is the _proof_ script — a fresh checkout of both repos reaching a live run with documented commands.
This is the _viewing_ script: one run, five minutes, where the garden is always doing something on
screen and every system property is turned on deliberately and watched land on a panel.

It assumes the stack is already up with the observability overlay, so the monitoring beats have
somewhere to land:

```sh
cd app.signal-garden && task observability:up
```

Open the client at `http://localhost:5173` and Grafana at `http://localhost:3000` (no login, straight
onto the **Signal Garden** dashboard) side by side. `http://localhost:16686` is Jaeger for the last
beat.

## The Arc

Seed `42`, 20 organisms, the balanced `3 / 2 / 1` rain/growth/pest mix: this garden **grows fast and
then dies completely**, and that is the point — it is a story with a shape, not a screensaver.

- **Ticks 0–200** (~40 s at the 200 ms pace): almost every event lands. Rings fill as rain banks
  moisture, glyphs enlarge as growth spends it a stage at a time, colours slide green → amber as pest
  chips health.
- **Ticks 200–1400**: attrition. Pest weight `1` is small but it never stops, and `growth` needs
  health ≥ 30, so organisms that fell behind early get caught at a low stage while the leaders max
  out at stage 5. You watch glyphs go dark one at a time.
- **The end**: all 20 dead, 16 at stage 5, 4 stranded at stage 3, rings near full — rain kept
  arriving after death and was absorbed with no effect. The scorecard's `total_stage` is **92 of a
  possible 100**: how much garden grew before the clock ran out.

Everything below is layered on top of that arc without pausing it.

## Minute By Minute

Set the pace field to **200 ms** in the start form before starting — it makes the cadence beats
quick enough to watch. Timings below are wall-clock at that pace; the tick numbers hold at any pace.

### 0:00 — Start

Start form: seed `42`, 20 organisms, pace `200`, **`duplicate_every` = 1**, everything else default
(`6` events/tick, `3 / 2 / 1`, unbounded capacity). "Start run."

- **Garden**: the grid appears and immediately moves — see _The Arc_.
- **Hash line**: the chain digest under the garden. This is the claim the project makes; hold the
  thought for 0:45.
- **Pressure**: `pending` at 0, the `uncommitted` sparkline beginning its sawtooth. `published` rate
  is roughly **twice** `applied` rate — `duplicate_every 1` means every event is delivered twice.
- **Grafana → Events processed by outcome**: `applied` leads early, with a `duplicate` series
  climbing alongside `no_effect` from the first scrape.

### 0:45 — Determinism, stated

The garden is visibly slowing as it saturates. Read the hash. In the daemon checkout,
`task run -- -seed 42` replays the same seed offline and prints the same chain digest — checkable,
not asserted (daemon `docs/decisions/0008`). Controls still say **revision 0**: nothing has been
touched, so the seed alone produced everything on screen.

### 1:00 — Make it fall behind, on purpose

Controls panel: `worker count` → `2`, `batch size` → `2`, `events per tick` → `30`. Apply. The
receipt reads _revision 1 takes effect at tick T — N ticks away_ and counts down.

Capacity is now `worker × batch = 4` records/tick against `30 × 2 = 60` deliveries/tick.

- **Pressure**: `pending` climbs in a straight line — roughly **+1400 every 5 s** — into the tens of
  thousands. This is the M3 capacity model: a consumer genuinely behind, not a fault (`docs/ui.md`,
  Pressure).
- **Grafana → Pending events**: the same straight diagonal, unmistakable at dashboard scale.
- **Grafana → Events / sec**: folded throughput pinned near the **4/tick cap**, nowhere near the 60
  being produced.
- **Grafana → Tick duration**: p95 steps up — each tick still does bounded work, but it does all of
  it every time now.

### 2:15 — Catch back up

Controls: `worker count` → `0`, `batch size` → `0` (unbounded), `events per tick` → `6`. Apply.

- **Pressure**: `pending` collapses to 0 **within one or two ticks** — the whole backlog folds at
  once.
- **Grafana → Events / sec**: a single tall spike as tens of thousands of records are processed in a
  breath, then back to the baseline rate.
- Idempotent processing is what makes draining a backlog that fast safe: a record folded twice is a
  no-op, so there is nothing to be careful about.

### 3:00 — Break a snapshot save, on purpose

Controls: `fail snapshot every` → `1`. Apply. The periodic on-disk save runs every **50 ticks**
(~10 s at this pace).

- **Pressure**: `snapshot save retries` steps up by one at each cadence tick — 1, 2, 3, 4… —
  while `snapshot save failures` **stays at 0**.
- **Grafana → Snapshot save retries & dropped frames**: the retries line climbs in steps, the
  failures line stays flat on the floor.
- The injected failure only ever occupies the save's _first_ attempt, so every one recovers. This is
  a transient failure demonstrated as transient — not "the run terminates," which a real disk error
  already does today (`docs/ui.md`, Pressure).

### 3:45 — Drop the connection

"Drop connection", next to the connection status, live only while the stream reads `live`. It closes
the socket with application close code `3000`, and the client's reconnect path cannot tell that from
a real network drop, so it takes the identical route:

- **Connection**: `live → reconnecting → resuming`, then `live` again — unattended, no button, no
  manual reconnect.
- **Missed while away**: states the true gap, `catchup.to − catchup.from` in records — not a guess
  from how long the socket was down, and correct even though the displayed list is capped at 200
  (`docs/ui.md`, "Reconnect as a demonstrable act").
- **Connection**, after: `sequence` — frames _this connection_ has seen — has reset; `folded_offset`
  — the _history_ behind the current frame — has not. The handover check confirms the catch-up frame
  ends exactly where the snapshot behind it stands; a mismatch there would be an alert, not a log
  line.

### 4:15 — Idempotency, as a still life

The garden is dead now: every glyph dark, the hash under it constant. `duplicate_every` has been on
since 0:00, so the line reads **`<hash> · unchanged through N duplicate deliveries`**, and `N` is
still climbing. At-least-once delivery is being _survived_, tick after tick, not prevented. Pressure
still shows `published` running at roughly twice `applied`.

### 4:30 — Look underneath

Grafana has been open the whole time and nothing was clicked to set it up — the two datasources and
the dashboard are files under `observability/grafana/`.

- **Grafana → RPC rate by method / RPC p95 by method**: every `StartRun` and `UpdateControls` call
  from this session, by method, over loopback — the REST gateway dials gRPC, so REST traffic is in
  here too.
- **Jaeger** (`localhost:16686`, service `signalgardend`): one `tick` span per tick, one span per
  RPC. The four control changes above are each `UpdateControls` spans _and_ `control_changed` events
  in the run's own log.
- `curl localhost:8080/metrics` needs nothing else running to answer. The dashboard is the version
  of that worth more than `curl`.

### 4:50 — Finish

"Finish" in the Controls panel. The scorecard:

- **the garden**: 20 organisms, 0 alive, average stage 4.6, `total_stage` 92.
- **the counters**: events by type (`rain` / `growth` / `pest` / `control_changed`) and by outcome
  (`applied` / `no_effect` / `duplicate` — roughly half of everything, from `duplicate_every`).
- **the chain digest**: the same number `task run -- -seed 42` prints offline for this seed and this
  sequence of control changes, because both drive the same simulation (`docs/architecture.md`).

`log_offset` and `committed_offset` are equal at finish — everything produced was committed.

## What Each Beat Proves

| Beat        | Property                                                   | Where you see it                                        |
| ----------- | ---------------------------------------------------------- | ------------------------------------------------------- |
| 0:00 / 4:15 | At-least-once delivery is survived, not prevented          | duplicate counter climbing, hash still                  |
| 0:45 / 4:50 | Determinism is checkable, not asserted                     | on-screen hash = offline `task run` digest              |
| 1:00        | A consumer can genuinely fall behind                       | `pending` ramp, throughput pinned at capacity           |
| 2:15        | …and recover, safely, because processing is idempotent     | `pending` collapses in one tick                         |
| 3:00        | A transient failure recovers, not just "the run continues" | `snapshot save retries` up, `failures` flat             |
| 3:45        | Reconnect is automatic and provably complete               | `reconnecting → live` unattended, exact gap stated      |
| 4:30        | The system explains itself                                 | `/metrics` and traces, no dashboard required to be true |

See [`docs/roadmap.md`](roadmap.md) for where M4 sits, and the daemon's
[`docs/performance-report.md`](https://github.com/DamoDCoder/signal-garden/blob/main/docs/performance-report.md)
for behaviour well past this demo's scale.
