# The Contract Here

## Where It Comes From

The daemon repository owns the definition of a run, a garden, an event, and a projection frame.
This client vendors it and generates from it. It never writes its own version of those types — a
second definition would be free to drift until someone noticed the difference in a browser.

```text
CONTRACT                              the daemon tag this client is built against
proto/signal/garden/v1/garden.proto   vendored from that tag
third_party/google/api/*.proto        vendored alongside, because the contract imports them
src/gen/                              generated, committed
```

## Generating

```sh
task contract     # scripts/fetch-contract.sh && scripts/generate.sh
```

`fetch-contract.sh` copies from a sibling `../signal-garden` checkout when it is sitting on the
pinned tag, and downloads from the tag on GitHub otherwise. Generation is the invocation the daemon
documents:

```sh
protoc -I proto -I third_party \
  --plugin=protoc-gen-es=./node_modules/.bin/protoc-gen-es \
  --es_out=src/gen --es_opt=target=ts,import_extension=.js \
  signal/garden/v1/garden.proto google/api/annotations.proto google/api/http.proto
```

The vendored `google/api` protos have to be generated alongside the contract: `garden_pb` imports
the annotations file, and leaving it out fails at module resolution rather than at generation.

## Bumping The Daemon

```sh
echo v0.13.0 > CONTRACT
task contract
task check
```

The diff in `src/gen/` **is** the contract change, which is the reason that directory is committed
rather than ignored — see [0002](decisions/0002-commit-the-generated-typescript.md). Compose reads
the same file, so the daemon it builds and the types the browser was generated against move
together.

## What The Generated Types Do With 64-Bit Fields

Every 64-bit field crosses the wire as a JSON **string**. That is the protobuf JSON mapping rather
than a preference — JSON numbers lose precision above 2^53 — and it is uniform across both
transports, so nothing here has to know which transport a value arrived on.

The daemon declares what each one _means_ with `jstype`: `JS_NUMBER` for bounded quantities a
client does arithmetic on, `JS_STRING` for opaque tokens. Measured against `protoc-gen-es`:

| Field                                                       | Declared    | Generated type |
| ----------------------------------------------------------- | ----------- | -------------- |
| `Run.seed`                                                  | `JS_STRING` | `string`       |
| `tick`, `sequence`, `folded_offset`, `log_offset`, counters | `JS_NUMBER` | `bigint`       |
| `organisms`, `revision`, `attempt`                          | _(int32)_   | `number`       |

`protoc-gen-es` does not honour `JS_NUMBER`, and that is it being right rather than incomplete:
`number` cannot hold an int64 losslessly. The distinction still arrives — `seed` is a string this
client passes around unchanged, and every quantity is a `bigint` it compares and renders.

Two consequences, both handled at the edges:

- `bigint` does not mix with `number`. `src/api/json.ts` converts, and only at the point of render.
- `JSON.stringify` throws on `bigint`. `src/api/client.ts` serialises with `toJson` and the
  generated schema instead.

## Parsing

Responses and frames are parsed with `fromJson` and the generated schema rather than used as raw
JSON, so snake_case field names, enum spellings, and the string encoding are handled once.
`ignoreUnknownFields` is on deliberately: a daemon one tag ahead adds fields, and a client that
threw on them would break on a change the contract calls compatible.

## Compatibility

The daemon's compatibility rules apply here as consumer obligations:

- Unknown fields are ignored, not rejected.
- Enum values this build does not know decode to their unspecified zero value; a `switch` on one
  must have a default that renders something rather than throwing.
- `event_type` is a string rather than an enum, precisely so a client that cannot render an event
  can still name it.
