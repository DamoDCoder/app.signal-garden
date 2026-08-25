/**
 * Bind a run's projection stream to the store.
 *
 * The stream owns resuming and the handover check; this hook owns nothing but
 * the lifetime of one `ProjectionStream` per run ID. Passing `undefined` opens
 * no socket, which is the state before a run exists.
 */

import { useEffect } from 'react';
import { ProjectionStream } from '../api/stream.js';
import { useGardenDispatch } from '../state/gardenStore.js';

export function useProjectionStream(runId: string | undefined): void {
  const dispatch = useGardenDispatch();

  useEffect(() => {
    if (runId === undefined || runId === '') return;

    const stream = new ProjectionStream(runId, {
      onSnapshot: (snapshot) => dispatch({ type: 'snapshot/received', snapshot }),
      onCatchup: (catchup) => dispatch({ type: 'stream/catchup', events: catchup.events }),
      onStatus: (status, detail) => dispatch({ type: 'stream/status', status, detail }),
      onHandoverBreak: (gap) => dispatch({ type: 'stream/handoverBreak', gap }),
      onError: (error) => dispatch({ type: 'error/raised', error }),
    });

    stream.start();
    return () => stream.close();
  }, [runId, dispatch]);
}
