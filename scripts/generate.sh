#!/usr/bin/env bash
# Generate TypeScript from the vendored contract.
#
# The invocation is the one the daemon documents in docs/contracts.md. The
# vendored google/api protos are generated alongside the contract because
# garden_pb imports the annotations file: leaving them out fails at module
# resolution rather than at generation.
set -euo pipefail

cd "$(dirname "$0")/.."

if [ ! -f proto/signal/garden/v1/garden.proto ]; then
  echo "no contract vendored: run scripts/fetch-contract.sh first" >&2
  exit 1
fi

if ! command -v protoc >/dev/null 2>&1; then
  echo "protoc is not on PATH: brew install protobuf" >&2
  exit 1
fi

if [ ! -x node_modules/.bin/protoc-gen-es ]; then
  echo "protoc-gen-es is not installed: npm install" >&2
  exit 1
fi

# Only the generated trees are cleared: src/gen/README.md is written by a
# person and explains why the rest of the directory is committed.
rm -rf src/gen/signal src/gen/google
mkdir -p src/gen

protoc -I proto -I third_party \
  --plugin=protoc-gen-es=./node_modules/.bin/protoc-gen-es \
  --es_out=src/gen --es_opt=target=ts,import_extension=.js \
  signal/garden/v1/garden.proto \
  google/api/annotations.proto \
  google/api/http.proto

echo "generated src/gen from $(cat proto/.contract-version 2>/dev/null || echo 'unknown tag')"
