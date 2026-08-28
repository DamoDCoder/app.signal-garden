# Known Limits

Things this client cannot do, with what it does instead. Each one is a candidate for a change in
either repository rather than a defect to be quietly worked around.

## A Browser Cannot Read The Stream's Rejection

The daemon rejects a bad stream request **before** the WebSocket upgrade, so a missing run is a
404, a bad offset is a 400, and a shutting-down registry is a 503. That is the right design: it
makes a rejection an ordinary HTTP status rather than a socket that opens and immediately closes
with a code.

The browser `WebSocket` API exposes none of it. A failed handshake produces a `close` event with
code 1006 and no status, whatever the daemon wrote. So from here, "that offset is out of range" and
"the daemon is not running" look identical.

**What this client does:** after two resume attempts that never opened, it asks
`GET /v1/runs/{run_id}` over REST. A 404 is terminal — the run is gone, stop retrying. Anything
else means the offset is the likely problem, so it drops `from` and reconnects as a new client.
That costs the records in the gap and is visible in the connection banner, and it is the only exit
from an offset the daemon will refuse forever.

**What would fix it upstream:** accepting the stream and closing it with a WebSocket close code
carrying the reason would be worse — the pre-upgrade status is better for every non-browser client.
A cheap addition would be a REST route that validates an offset without opening a socket, so the
client can ask before it connects rather than guessing after it fails.

## Telemetry Polls

Telemetry is not on the projection stream. The daemon's contract says the performance panel polls
`GET /v1/runs/{run_id}/telemetry`, and folding it into the stream is M3's work, once the counters
become histograms worth pushing. So the pressure panel is up to one poll interval stale relative to
the garden beside it, which will show as a lag between a burst and its counters.

## Catch-Up Can Be Large

A client resuming from a deep offset receives every record in the gap in one frame, read on the
run's own goroutine. At M2's volumes that is a slice copy. At M3's it is a measurable pause on the
daemon and a large message here.

**What this client does:** keeps the newest 200 records for display and drops the rest. The garden
is not built from them — the snapshot behind the catch-up frame is authoritative — so dropping them
loses a view of what was missed, never a piece of the garden.

## No Reload Survival

A reload is a new client. Nothing — not the run ID, not the offset — is kept in the browser, so a
reload attaches from scratch and starts at the current garden rather than resuming from the offset
the previous page was holding. Keeping the last run ID and offset in `sessionStorage` would make a
reload a resume, and is a small change deliberately not made yet.
