# 0003: Resume from `folded_offset`, and treat a broken handover as an alert

- **Date:** 2026-08-25
- **Status:** Accepted
- **Relates to:** [signal-garden 0009](https://github.com/DamoDCoder/signal-garden/blob/main/docs/decisions/0009-catch-up-is-a-command-to-the-run-not-a-second-reader.md)

## Context

The projection stream can be resumed. A client passing `?from=N` gets one catch-up frame carrying
the records between `N` and the snapshot immediately behind it, and `catchup.to` always equals that
snapshot's `folded_offset`.

A client is free to ignore all of it and reconnect without `from`. That is simpler, always works,
and silently skips whatever happened while the socket was down.

## Options Considered

1. **Reconnect fresh every time.** No offset bookkeeping. The garden is correct — the snapshot is
   authoritative — and the events in the gap are gone with nothing to say they existed. For a
   project whose M2 exit criterion is _"a disconnected client receives a snapshot and missed
   updates"_, a client that declines the second half of that sentence is not demonstrating it.
2. **Resume, and trust the frames.** Hold the last `folded_offset`, pass it, render what comes back.
3. **Resume, and check the handover.**

## Decision

Option 3.

The client holds the last snapshot's `folded_offset` and resumes from it. When a catch-up frame
arrives it remembers `catchup.to`, and the next snapshot's `folded_offset` has to equal it. When
they disagree, the difference is surfaced as an alert with its direction stated: a positive drift is
records that were never delivered, a negative one is records delivered twice.

**Why it is an alert rather than a log line.** The daemon asserts this equality in its own tests, so
a mismatch in a browser means something the contract promises is not holding — a client one tag
behind the daemon, a proxy reordering frames, a bug. The garden on screen was not built from the
records this client received. There is no honest way to render over that, and a console warning
nobody reads is the same as rendering over it.

## What This Costs

Bookkeeping in `src/api/stream.ts`, and one failure mode: an offset the daemon will refuse forever
would make every reconnect fail. A browser cannot read the pre-upgrade status that would say so, so
after two failed resumes the client drops `from` and reconnects as a new client — losing the gap,
which is the same outcome as option 1, but only after trying and only visibly. See
[known-limits.md](../known-limits.md).

## What Would Revisit This

- A REST route that validates an offset without opening a socket, which would replace the two-strike
  heuristic with an answer.
- Catch-up frames large enough that receiving one is itself a pause worth avoiding, which is the
  measurement M3 is going to take on the daemon side.
