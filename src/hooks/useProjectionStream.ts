/**
 * Bind a run's projection stream to the store.
 *
 * The stream owns resuming and the handover check; this hook owns nothing but
 * the lifetime of one `ProjectionStream` per run ID. Passing `undefined` opens
 * no socket, which is the state before a run exists.
 */

import { useCallback, useEffect, useRef } from 'react';
import { ProjectionStream } from '../api/stream.js';
import { useGardenDispatch } from '../state/gardenStore.js';

export interface ProjectionStreamControls {
  /** Drop the live socket on purpose, so a reconnect can be watched rather than only trusted. */
  disconnect: () => void;
}

export function useProjectionStream(runId: string | undefined): ProjectionStreamControls {
  const dispatch = useGardenDispatch();
  const streamRef = useRef<ProjectionStream | undefined>(undefined);

  useEffect(() => {
    if (runId === undefined || runId === '') return;

    const stream = new ProjectionStream(runId, {
      onSnapshot: (snapshot) => dispatch({ type: 'snapshot/received', snapshot }),
      onCatchup: (catchup) =>
        dispatch({
          type: 'stream/catchup',
          from: catchup.from,
          to: catchup.to,
          events: catchup.events,
        }),
      onStatus: (status, detail) => dispatch({ type: 'stream/status', status, detail }),
      onHandoverBreak: (gap) => dispatch({ type: 'stream/handoverBreak', gap }),
      onError: (error) => dispatch({ type: 'error/raised', error }),
    });

    streamRef.current = stream;
    stream.start();
    return () => {
      streamRef.current = undefined;
      stream.close();
    };
  }, [runId, dispatch]);

  return {
    disconnect: useCallback(() => streamRef.current?.disconnect(), []),
  };
}
