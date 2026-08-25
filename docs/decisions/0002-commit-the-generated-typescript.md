# 0002: Commit the generated TypeScript

- **Date:** 2026-08-25
- **Status:** Accepted

## Context

`src/gen/` is produced by `protoc-gen-es` from the vendored contract. It could be generated on
install and ignored, the way many TypeScript projects treat generated clients.

## Decision

Commit it, and require `protoc` only for regeneration.

Three reasons, in order of weight:

**The diff is the compatibility review.** A contract bump changes `CONTRACT`, the vendored `.proto`,
and `src/gen/` in one commit. What actually changed for this client — a new field, a renamed one, a
type that moved from `number` to `bigint` — is readable in that diff. Ignoring the directory hides
exactly the thing pinning a tag exists to make visible.

**A clean checkout builds without protoc.** This is the arrangement the daemon already has with its
generated Go, for the same reason: `protoc` is a toolchain install, and needing it to run `npm test`
makes the first five minutes in a new checkout an installation problem.

**Generated output is deterministic.** `protoc-gen-es` at a pinned version against a pinned contract
produces the same files, so the committed copy is verifiable rather than merely present:
regenerating and finding a diff means one of the pins moved.

## What This Costs

A generated directory in review. It is excluded from linting and formatting, and it is never
hand-edited — a change there that did not come from `task contract` is a mistake, not a fix.

## What Would Revisit This

- Generated output large enough to drown the diffs it is meant to clarify.
- A generator whose output is not reproducible, which would make the committed copy a claim rather
  than a check.
