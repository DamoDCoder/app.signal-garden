#!/usr/bin/env bash
# Vendor the contract from the daemon repository at the tag in CONTRACT.
#
# The client pins a tag rather than tracking main — decision 0011 in the daemon
# repository, and 0001 here. This script is the only thing that writes proto/
# and third_party/, so a contract bump is one edit to CONTRACT and one run.
#
# A sibling checkout is used when it is on the pinned tag, which keeps
# generation offline; otherwise the files come from the tag on GitHub.
set -euo pipefail

cd "$(dirname "$0")/.."

TAG="$(tr -d '[:space:]' < CONTRACT)"
REPO="${SIGNAL_GARDEN_REPO:-https://github.com/DamoDCoder/signal-garden}"
SIBLING="${SIGNAL_GARDEN_PATH:-../signal-garden}"

FILES=(
  "proto/signal/garden/v1/garden.proto"
  "third_party/google/api/annotations.proto"
  "third_party/google/api/http.proto"
)

copy_from_sibling() {
  [ -d "$SIBLING/.git" ] || return 1
  local at
  at="$(git -C "$SIBLING" tag --points-at HEAD 2>/dev/null || true)"
  case " $at " in
    *" $TAG "*) ;;
    *) return 1 ;;
  esac
  echo "contract: $TAG from $SIBLING"
  for f in "${FILES[@]}"; do
    mkdir -p "$(dirname "$f")"
    cp "$SIBLING/$f" "$f"
  done
}

download_from_tag() {
  local raw="${REPO/github.com/raw.githubusercontent.com}/$TAG"
  echo "contract: $TAG from $REPO"
  for f in "${FILES[@]}"; do
    mkdir -p "$(dirname "$f")"
    curl -fsSL "$raw/$f" -o "$f"
  done
}

copy_from_sibling || download_from_tag

printf '%s\n' "$TAG" > proto/.contract-version
echo "vendored ${#FILES[@]} files at $TAG"
