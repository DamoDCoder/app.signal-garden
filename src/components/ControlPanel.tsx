/**
 * Turn the knobs while the run is going.
 *
 * A control change is staged, not applied: the daemon answers with a revision
 * and the tick that revision starts on, because a change accepted partway
 * through a tick lands on the next boundary. The panel reports that tick rather
 * than saying "applied", so the delay a person sees in the garden matches what
 * the system actually promised.
 */

import type { ReactNode } from 'react';
import { create } from '@bufbuild/protobuf';
import { ControlsSchema, RunState } from '../gen/signal/garden/v1/garden_pb.js';
import { maxEventsPerTick, whyInvalid } from '../api/limits.js';
import { num } from '../api/json.js';
import { useRunCommands } from '../hooks/useRunCommands.js';
import { useEffectiveControls, useGarden, useGardenDispatch } from '../state/gardenStore.js';
import { ControlSlider } from './RunLauncher.js';

export function ControlPanel(): ReactNode {
  const { run, draft, revision, pending, snapshot } = useGarden();
  const dispatch = useGardenDispatch();
  const controls = useEffectiveControls();
  const { applyControls, setPaused, finish } = useRunCommands();

  if (run === undefined || controls === undefined) return null;

  const state = snapshot?.state ?? run.state;
  const finished = state === RunState.FINISHED;
  const paused = state === RunState.PAUSED;
  const invalid = whyInvalid(controls);
  const dirty = draft !== undefined;

  const edit = (patch: Partial<typeof controls>): void => {
    dispatch({
      type: 'controls/drafted',
      controls: create(ControlsSchema, { ...controls, ...patch }),
    });
  };

  return (
    <section className="panel control-panel">
      <h2>Controls</h2>

      <ControlSlider
        name="events per tick"
        min={1}
        max={maxEventsPerTick}
        value={controls.eventsPerTick}
        onChange={(eventsPerTick) => edit({ eventsPerTick })}
      />
      <ControlSlider
        name="rain"
        value={controls.rainWeight}
        onChange={(rainWeight) => edit({ rainWeight })}
      />
      <ControlSlider
        name="growth"
        value={controls.growthWeight}
        onChange={(growthWeight) => edit({ growthWeight })}
      />
      <ControlSlider
        name="pest"
        value={controls.pestWeight}
        onChange={(pestWeight) => edit({ pestWeight })}
      />

      {invalid !== undefined && <p className="invalid">{invalid}</p>}

      <div className="control-actions">
        <button
          type="button"
          disabled={!dirty || invalid !== undefined || finished || pending > 0}
          onClick={() => void applyControls(controls)}
        >
          {dirty ? 'Apply change' : 'No change to apply'}
        </button>
        <button
          type="button"
          disabled={finished || pending > 0}
          onClick={() => void setPaused(!paused)}
        >
          {paused ? 'Resume' : 'Pause'}
        </button>
        <button type="button" disabled={finished || pending > 0} onClick={() => void finish()}>
          Finish
        </button>
      </div>

      {revision !== undefined && (
        <p className="revision-receipt">
          revision {revision.revision} takes effect at tick {num(revision.effectiveTick)}
        </p>
      )}
    </section>
  );
}
