/**
 * What this client missed while it was away.
 *
 * These are the records from a catch-up frame — the only events that reach the
 * browser at all, since the steady-state stream carries folded gardens rather
 * than individual events. They carry no `recorded_at`: wall-clock time is never
 * written to the log, so a record read back has none to report, and
 * `occurred_at` is the tick that produced it.
 */

import type { ReactNode } from 'react';
import { num } from '../api/json.js';
import { useGarden } from '../state/gardenStore.js';

export function EventFeed(): ReactNode {
  const { missedEvents } = useGarden();
  if (missedEvents.length === 0) return null;

  return (
    <section className="panel event-feed">
      <h2>
        Missed while away <small>{missedEvents.length} records, newest first</small>
      </h2>
      <ol>
        {missedEvents.map((event) => (
          <li key={`${event.eventId}-${event.attempt}`} data-type={event.eventType}>
            <span className="event-tick">tick {num(event.occurredAt)}</span>
            <span className="event-type">{event.eventType}</span>
            <span className="event-entity">{event.entityId}</span>
            <span className="event-amount">{event.payload?.amount ?? ''}</span>
            {event.attempt > 1 && <span className="event-attempt">attempt {event.attempt}</span>}
          </li>
        ))}
      </ol>
    </section>
  );
}
