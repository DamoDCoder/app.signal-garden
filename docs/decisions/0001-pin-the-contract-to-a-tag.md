# 0001: Pin the contract to a tag, and vendor it

- **Date:** 2026-08-25
- **Status:** Accepted
- **Relates to:** [signal-garden 0011](https://github.com/DamoDCoder/signal-garden/blob/main/docs/decisions/0011-the-ui-is-a-separate-repository.md)

## Context

The daemon repository owns the contract and says a consumer should pin a tag rather than track
`main`. That leaves this repository to decide _how_ the pinned contract reaches the generator: read
from a sibling checkout at build time, fetched from a tag on demand, or vendored and committed.

## Options Considered

1. **Read `../signal-garden/proto` directly.** Works on the machine of the one person who has both
   checkouts side by side, at whatever revision that checkout happens to be on. It makes the build
   depend on the state of a directory outside the repository — including on uncommitted local
   changes to the daemon.
2. **Fetch at generation time, never commit.** Correct at the moment it runs, and unreproducible
   afterwards: a checkout of this repository from six months ago regenerates against whatever the
   tag resolves to now, and generation needs the network.
3. **Vendor the contract, committed, with the tag in a file.**

## Decision

Option 3. `CONTRACT` holds the tag, `proto/` and `third_party/` hold the vendored files, and
`scripts/fetch-contract.sh` is the only thing that writes them.

The script prefers a sibling checkout **when it is sitting on the pinned tag**, and downloads from
GitHub otherwise. That keeps generation offline in the normal case without letting an unrelated
local revision leak into it: the sibling is used because it matches, not because it is nearby.

`CONTRACT` is also what the stack is checked against: compose runs a daemon image built in the
daemon repository, and `task up` compares the version stamped into that image against this file
before starting anything. The daemon in the stack and the types the browser was generated against
cannot drift apart silently.

## What This Costs

A contract bump is a commit here that touches vendored `.proto` files and generated TypeScript
together. That is the intent: the diff is the compatibility review, and it happens in a pull request
rather than at someone's next `npm run dev`.

## What Would Revisit This

- The contract being published as an artifact — an npm package or a buf module — which would make
  vendoring the awkward path rather than the reliable one.
- A second consumer, at which point breaking-change detection on the daemon side becomes worth more
  than a pinned tag here.
