# 0004: The store holds only what the daemon said, plus unacknowledged intent

- **Date:** 2026-08-25
- **Status:** Accepted

## Context

The client receives a garden every tick and can send control changes at any moment. That invites an
optimistic UI: move a slider, apply the change locally, let the next frame confirm it.

For most applications that is the right instinct. Here it is a trap, for a specific reason: this
interface's whole job is to show that a control change lands at a **tick boundary** rather than on
acknowledgement. An optimistic update hides precisely the behaviour the project exists to
demonstrate, and it does it by making the system look better than it is.

## Decision

The store holds two kinds of thing and no third:

1. **The last message of each type the daemon sent** — run, snapshot, telemetry, revision, summary.
2. **Local intent that has not been acknowledged** — the control draft the person is dragging, and
   the count of commands in flight.

Nothing derives a garden. Nothing interpolates between frames. When a snapshot and a local guess
disagree, the snapshot wins.

The draft is cleared when the daemon issues a revision, not when the request is sent. Until the
receipt arrives, what the person moved is a wish; the receipt names the tick it becomes a fact.

## Consequences

- A run at a 2-second tick interval looks like a run at a 2-second tick interval. That is
  information, not lag.
- The control panel can say "revision 4 takes effect at tick 61" rather than "applied", because it
  has the receipt and not a guess.
- A slow or failed command is visible as a command, rather than as a garden that changed and then
  changed back.

## What Would Revisit This

- A control whose effect is genuinely instantaneous and unconditional, which would have nothing to
  hide by being shown immediately. There is none in the contract today.
