/**
 * Watch a run that is already going.
 *
 * Runs outlive the process that served them: the daemon resumes every
 * unfinished run it finds on startup, and finished runs stay on disk. So the
 * client needs a way in that is not "start a new one" — otherwise a restarted
 * daemon's runs are invisible from the browser.
 *
 * A resumed run is marked as such, because its determinism chain starts fresh
 * even though its garden and tick counter carry on.
 */

import { useState, type FormEvent, type ReactNode } from 'react';
import { getRun } from '../api/client.js';
import { useCommand, useGardenDispatch } from '../state/gardenStore.js';

export function AttachToRun({ onAttached }: { onAttached: (runId: string) => void }): ReactNode {
  const [runId, setRunId] = useState('');
  const dispatch = useGardenDispatch();
  const command = useCommand();

  const submit = async (formEvent: FormEvent): Promise<void> => {
    formEvent.preventDefault();
    if (runId === '') return;
    const run = await command(() => getRun(runId));
    if (run === undefined) return;
    dispatch({ type: 'run/loaded', run });
    onAttached(run.runId);
  };

  return (
    <form className="panel attach-run" onSubmit={(e) => void submit(e)}>
      <h2>Watch a run</h2>
      <p className="hint">
        A run the daemon is already serving, including one it resumed after a restart.
      </p>
      <label>
        Run ID
        <input value={runId} onChange={(e) => setRunId(e.target.value)} placeholder="run-0001" />
      </label>
      <button type="submit" disabled={runId === ''}>
        Watch
      </button>
    </form>
  );
}
