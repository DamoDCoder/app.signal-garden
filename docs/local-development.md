# Local Development

## Dependencies

| Need                            | Why                                                                |
| ------------------------------- | ------------------------------------------------------------------ |
| Node 20+ (22 in `.nvmrc`)       | The client, and `protoc-gen-es`                                    |
| `protoc`                        | One step: generating TypeScript from the vendored contract         |
| Docker                          | The Compose stack, if you are not running a daemon from a checkout |
| A `../signal-garden` checkout   | The daemon image is built there, not here                          |
| [go-task](https://taskfile.dev) | The commands, same runner the daemon repository uses               |

`protoc` is not needed to build or test: `src/gen/` is committed. Only regeneration needs it — the
same arrangement the daemon has with its generated Go.

## First Run

```sh
nvm use
task setup                                   # npm install, vendor the contract, generate

cd ../signal-garden && task docker:build     # build the daemon image into the local image store
cd -
task up                                      # daemon and client, via Compose
```

Then open http://localhost:5173.

## Where The Daemon Image Comes From

Compose **names** the daemon image; it does not build it. That repository ships it, because an
artifact belongs to whoever knows how to build it, and a _stack_ belongs to whoever has the
dependency — see [0015](https://github.com/DamoDCoder/signal-garden/blob/main/docs/decisions/0015-ship-an-image-but-not-a-stack.md)
over there.

Nothing is pushed anywhere. The image lives in the local Docker image store, and compose is set to
`pull_policy: never` so a missing one fails with "not found locally" rather than an authentication
error against a registry nobody configured.

`task up` runs `task check-image` first, which:

- fails with the command that would fix it if the image is not there, and
- warns if the version stamped into the image does not match the tag in `CONTRACT`, which is the
  case where the browser is generated against one contract and talking to another.

By default compose runs `signal-garden/signalgardend:local`, the moving tag `task docker:build`
writes for a build matching the host architecture. To run a specific one:

```sh
task up TAG=v0.7.1
```

### Building The Daemon Image For Another Architecture

The daemon repository cross-compiles before it builds the image, and the two are not
interchangeable: `task build` there produces a `darwin/arm64` binary for its own tests, and
`task build:docker` produces the `linux/arm64` one that goes into the container. `ARCH=amd64`
builds for an x86 machine instead — and a cross build deliberately does not move `:local`, so
`task up` will not pick up an image this machine cannot run.

## Ports

| Port  | What                                                                            |
| ----- | ------------------------------------------------------------------------------- |
| 5173  | This client's dev server                                                        |
| 8080  | The daemon: generated REST routes, the projection stream, `/healthz`, `/readyz` |
| 9090  | The daemon's gRPC listener, exposed so `grpcurl` works against a running stack  |
| 9091  | Prometheus UI, `task observability:up` only — see below                         |
| 16686 | Jaeger UI, `task observability:up` only                                         |
| 4317  | Jaeger's OTLP/gRPC receiver, `task observability:up` only                       |

## Prometheus And Traces

Neither is needed to run the stack. `curl localhost:8080/metrics` already answers Prometheus's own
scrape format with nothing extra running, and tracing is off by default — see
[0016](https://github.com/DamoDCoder/signal-garden/blob/main/docs/decisions/0016-prometheus-metrics-carry-no-run-id-label.md)
and [0019](https://github.com/DamoDCoder/signal-garden/blob/main/docs/decisions/0019-traces-are-tick-and-rpc-grained-not-per-event.md)
in the daemon repository. `compose.observability.yaml` is for the demo where a dashboard and a trace
waterfall are worth more than `curl`:

```sh
task observability:up      # everything task up starts, plus Prometheus and Jaeger
```

It is an overlay (`docker compose -f compose.yaml -f compose.observability.yaml up`), not a second
stack — the same `garden`/`web` services, joined by `prometheus` and `jaeger` on the same network,
with `SIGNAL_GARDEN_OTEL_ENDPOINT` pointed at `jaeger:4317` only in this file. Open
`http://localhost:9091` for Prometheus (`signal_garden_events_processed_total`,
`signal_garden_pending_events`, and the rest of `/metrics`, queryable and graphable) and
`http://localhost:16686` for Jaeger — start a run, and both a `StartRun` RPC span and a `tick` span
per tick appear under the `signalgardend` service. `task observability:down` stops it.

## Working Against A Daemon Checkout

Often quicker than rebuilding an image:

```sh
# in ../signal-garden
task serve

# here
task dev
```

The daemon allows cross-origin requests from anywhere by default, so no proxy is configured. If you
set `SIGNAL_GARDEN_CORS_ORIGIN` to something specific over there, it has to include
`http://localhost:5173` — otherwise the garden streams and every button fails, because WebSockets
do not preflight and REST calls do.

## Working On Both Halves At Once

A contract change is not a tag yet. Building the image from an uncommitted daemon checkout is the
normal `task docker:build`: it stamps the version as `v0.7.1-dirty`, and `task check-image` accepts
that as matching `v0.7.1` — a working tree with changes in it is the expected state while both
halves are moving.

What it does _not_ check is whether those changes touched the contract. `src/gen/` is generated from
the tag in `CONTRACT`, so an unreleased daemon can disagree with the types the browser was built
against, and nothing here will notice. That is the situation pinning a tag exists to prevent, so
while it is convenient it is not the path to leave things on: cut a tag, bump `CONTRACT`, and
regenerate.

## Run History

Compose keeps run history in the `garden-data` volume, and the daemon resumes every unfinished run
it finds when it starts. That is worth doing on purpose at least once:

```sh
docker compose restart garden
```

The run comes back at the tick it stopped on, and the client reconnects and resumes from the offset
it was holding. The run is marked `resumed` in the header afterwards, because its determinism chain
starts fresh even though its garden and tick counter carry on.

To throw history away:

```sh
task reset     # docker compose down --volumes
```

## Tests

```sh
task test        # unit tests, no daemon needed
task test-e2e    # the browser journey, needs a daemon on :8080
task check       # format, typecheck, lint, unit tests
```

The browser journey does not stub the transport, because the thing under test is that a browser and
the daemon agree on the contract.
