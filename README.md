# app.signal-garden

The control surface for [Signal Garden](https://github.com/DamoDCoder/signal-garden): a React
client that starts runs, turns the knobs, and shows what the event system is doing while it does
it.

Signal Garden is a local-first real-time event-processing laboratory disguised as a strategy game.
The daemon owns the simulation, the durable log, and the contract. This repository owns the
browser, and the Compose file that runs both.

## Status

**M1 done; M2 demonstrated and live-verified; M3's client-repo items done.** Wired to the contract
at `v0.13.0`. A run can be started, steered, paused, and finished from the browser; pressure
history, duplicate-delivery visibility, tick-boundary latency, and reconnect are all built and
shown, not just rendered as tables. `docker compose up` starts the local stack clean, and
`docker compose stop` against a live run and back is a verified path: the client backs off through
`reconnecting` and resumes to `live` on its own once the daemon returns.

The Controls panel has three more sliders — `worker count`, `batch size`, `fail snapshot every` —
live-tunable the same way the original four are, and the Pressure panel shows the two counters they
feed: `snapshot save retries`/`snapshot save failures`. `compose.observability.yaml`
(`task observability:up`) brings up Grafana — no login, on a provisioned dashboard — alongside
Prometheus and Jaeger, without any of them being required to run the stack.

M4 is underway: Compose now serves a production nginx build rather than the Vite dev server, the
observability overlay ships a built dashboard, and [docs/demo.md](docs/demo.md) is the five-minute
viewing script. See [docs/roadmap.md](docs/roadmap.md) for the exit-criteria record and
[docs/ui.md](docs/ui.md) for what each panel does.

The daemon's half of M1 was done first: a run can start, take control changes, pause, and finish
over generated REST routes, and a projection stream delivers a frame per tick that a client can
resume from a log offset.

## What This Repository Is For

The daemon can already be driven with `curl`. What it cannot do is make system behaviour _legible_
— which is the question the whole project exists to answer, and the one the feedback plan asks
after M1: _does the UI make system pressure legible?_

So the interface has a job beyond being usable. It has to show, without anyone explaining it:

- that a control change lands at a **tick boundary** rather than on acknowledgement,
- that duplicate delivery is **survived**, not prevented,
- that a reconnecting client is handed **exactly** what it missed,
- that the gap between what is logged and what is committed is what a restart would redeliver,
- and that a run **outlives the process** that was serving it.

## Quick Start

Needs Node 20 or newer, `protoc` for the one generation step, and either Docker or a daemon
running locally.

```sh
nvm use              # Node 22, per .nvmrc
task setup           # npm install, vendor the contract at the tag in CONTRACT, generate TypeScript

cd ../signal-garden && task docker:build && cd -    # once, and after every daemon bump
task up              # daemon on :8080 and :9090, client on :5173
```

The daemon image is built in the daemon checkout, not here: that repository knows how to build its
own binary, and this one only knows how to run it. Nothing is pushed to a registry — `task up`
checks the image is in the local image store, and checks the version stamped into it against the tag
in `CONTRACT`, before starting anything.

Against a daemon already running from a checkout (`task serve` over there):

```sh
task dev             # http://localhost:5173, talking to http://localhost:8080
```

`task --list` is the index. Tasks mirror the daemon repository's, so moving between the two
checkouts does not mean learning a second set of commands.

## The Contract

This client never describes a garden of its own. `proto/signal/garden/v1/garden.proto` is vendored
from the daemon repository at the tag in [CONTRACT](CONTRACT), and `src/gen/` is generated from it
with `protoc-gen-es`. A second definition of a garden would be free to drift until someone noticed
it in a browser.

Bumping the daemon is two steps and one review:

```sh
echo v0.13.0 > CONTRACT
task contract        # re-vendors and regenerates; the diff in src/gen is the contract change
```

Two things the generated types will tell you, and this client handles at its edges:

- **64-bit fields are `bigint`.** They arrive as JSON strings — the protobuf mapping, uniform
  across both transports — so they never mix with `number` in arithmetic, and `JSON.stringify`
  throws on them. `src/api/json.ts` holds the conversions; `src/api/client.ts` serialises with
  `toJson` rather than `JSON.stringify`.
- **`seed` is a `string`,** because it is the one 64-bit field in the contract declared as an
  opaque token rather than a quantity. It stays a string end to end.

See [docs/contract.md](docs/contract.md) for the full generation story, and the daemon's
[docs/contracts.md](https://github.com/DamoDCoder/signal-garden/blob/main/docs/contracts.md) for
the surface itself.

## How It Talks To The Daemon

Two transports, one contract.

|                              | Transport                       | Module                                 |
| ---------------------------- | ------------------------------- | -------------------------------------- |
| Commands and queries         | Generated REST routes over HTTP | [src/api/client.ts](src/api/client.ts) |
| The garden, a frame per tick | WebSocket projection stream     | [src/api/stream.ts](src/api/stream.ts) |

The stream is read-only. Nothing sent on it changes a run — the daemon discards client messages —
so every command goes through the REST client, and this repository keeps that boundary rather than
reproducing half of it.

Reconnecting is the part worth reading. Every snapshot names `folded_offset`, the first log record
that garden has not folded; holding the last one means a reconnect asks for exactly what it missed
instead of quietly restarting at the current garden. The catch-up frame that comes back promises
where it ends, and the snapshot behind it has to agree — `catchup.to` must equal that snapshot's
`folded_offset`. When it does not, the garden on screen was not built from the records this client
received, and the interface says so instead of rendering over it.

## Documentation

- [Architecture](docs/architecture.md): the layers here and what each is not allowed to do.
- [The contract](docs/contract.md): pinning, generating, and bumping.
- [The interface](docs/ui.md): what each panel is for and the question it answers.
- [Five minutes worth watching](docs/demo.md): the viewing script — one run, every property turned on and watched land on a panel.
- [Local development](docs/local-development.md): commands, ports, and the Compose stack.
- [Known limits](docs/known-limits.md): what this client cannot see, and what it does instead.
- [Roadmap](docs/roadmap.md): what M1 still needs, and what M3 and M4 add.
- [Decisions](docs/decisions/): short records with the evidence behind them.

## Non-Goals

- No garden rules in the browser. The processor is the authority for garden state; this client
  renders projections and never calculates an outcome.
- No second definition of a garden, an event, or a frame.
- No commands over the projection stream.
- No interpolation between frames. A garden that was never on the wire is not shown.
