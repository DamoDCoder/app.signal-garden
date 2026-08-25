/**
 * Whether what is on screen is current, and what it would take to catch up.
 *
 * The stream status is half of it. The other half is the handover check: if a
 * catch-up frame and the snapshot behind it disagreed, the garden on screen was
 * not built from the records this client was given, and that has to be visible
 * rather than logged.
 */

import type { ReactNode } from 'react';
import { useGarden } from '../state/gardenStore.js';
import { num } from '../api/json.js';

const label: Record<string, string> = {
  connecting: 'connecting',
  resuming: 'resuming',
  live: 'live',
  reconnecting: 'reconnecting',
  finished: 'finished',
  failed: 'disconnected',
};

export function ConnectionStatus(): ReactNode {
  const { stream, snapshot } = useGarden();

  return (
    <div className="connection" data-status={stream.status}>
      <span className="connection-dot" aria-hidden="true" />
      <span data-testid="stream-status">{label[stream.status] ?? stream.status}</span>
      {stream.detail !== undefined && <span className="connection-detail">{stream.detail}</span>}
      {snapshot !== undefined && (
        <span className="connection-offset">
          tick {num(snapshot.tick)} · frame {num(snapshot.sequence)} · resumes at{' '}
          {num(snapshot.foldedOffset)}
        </span>
      )}
      {stream.handoverBreak !== undefined && (
        <p role="alert" className="handover-break">
          Catch-up ended at {num(stream.handoverBreak.expected)} but the snapshot behind it stands
          at {num(stream.handoverBreak.actual)} —{' '}
          {stream.handoverBreak.drift > 0n
            ? `${num(stream.handoverBreak.drift)} records were never delivered`
            : `${num(-stream.handoverBreak.drift)} records arrived twice`}
          . This garden was not built from the records this client received.
        </p>
      )}
    </div>
  );
}
