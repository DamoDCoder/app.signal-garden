/**
 * The commands a person can issue, bound to the current run.
 *
 * Each one is a REST call: the projection stream is read-only, so nothing here
 * touches it. Results land in the store, and the stream reports the consequence
 * a tick or two later — which is the honest shape, because a control change
 * takes effect at the next tick boundary rather than on acknowledgement.
 */

import { useCallback } from 'react';
import {
  finishRun,
  pauseRun,
  startRun,
  updateControls,
  type StartRunOptions,
} from '../api/client.js';
import { useCommand, useGarden, useGardenDispatch } from '../state/gardenStore.js';
import type { Controls } from '../gen/signal/garden/v1/garden_pb.js';

export interface RunCommands {
  start: (options: StartRunOptions) => Promise<string | undefined>;
  applyControls: (controls: Controls) => Promise<void>;
  setPaused: (paused: boolean) => Promise<void>;
  finish: () => Promise<void>;
}

export function useRunCommands(): RunCommands {
  const { run } = useGarden();
  const dispatch = useGardenDispatch();
  const command = useCommand();
  const runId = run?.runId;

  const start = useCallback(
    async (options: StartRunOptions) => {
      const started = await command(() => startRun(options));
      if (started === undefined) return undefined;
      dispatch({ type: 'run/loaded', run: started });
      return started.runId;
    },
    [command, dispatch],
  );

  const applyControls = useCallback(
    async (controls: Controls) => {
      if (runId === undefined) return;
      const revision = await command(() => updateControls(runId, controls));
      if (revision !== undefined) dispatch({ type: 'controls/accepted', revision });
    },
    [command, dispatch, runId],
  );

  const setPaused = useCallback(
    async (paused: boolean) => {
      if (runId === undefined) return;
      const updated = await command(() => pauseRun(runId, paused));
      if (updated !== undefined) dispatch({ type: 'run/loaded', run: updated });
    },
    [command, dispatch, runId],
  );

  const finish = useCallback(async () => {
    if (runId === undefined) return;
    const summary = await command(() => finishRun(runId));
    if (summary !== undefined) dispatch({ type: 'summary/received', summary });
  }, [command, dispatch, runId]);

  return { start, applyControls, setPaused, finish };
}
