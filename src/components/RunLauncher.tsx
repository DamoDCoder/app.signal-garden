/**
 * Start a run.
 *
 * This is the configuration half of the interface: seed, garden size, pace, and
 * the starting event mix, plus `duplicate_every`, which republishes every Nth
 * event of a tick. That last one is the point of the whole exercise made
 * clickable — at-least-once delivery is a control here rather than a test-only
 * code path, so a person can turn duplication on and watch the processor
 * deduplicate it without the garden changing.
 *
 * The seed is a string all the way down. It is the one 64-bit field in the
 * contract declared as an opaque token rather than a quantity, and parsing it
 * into a number would lose values above 2^53.
 */

import { useState, type FormEvent, type ReactNode } from 'react';
import { create } from '@bufbuild/protobuf';
import { ControlsSchema } from '../gen/signal/garden/v1/garden_pb.js';
import {
  defaultControls,
  maxEventsPerTick,
  whyInvalid,
  type ControlsInput,
} from '../api/limits.js';
import { useRunCommands } from '../hooks/useRunCommands.js';
import { useGarden } from '../state/gardenStore.js';

export interface RunLauncherProps {
  onStarted: (runId: string) => void;
}

export function RunLauncher({ onStarted }: RunLauncherProps): ReactNode {
  const { pending } = useGarden();
  const { start } = useRunCommands();

  const [runId, setRunId] = useState('');
  const [seed, setSeed] = useState('42');
  const [organisms, setOrganisms] = useState(20);
  const [tickMillis, setTickMillis] = useState(300);
  const [maxTicks, setMaxTicks] = useState(0);
  const [duplicateEvery, setDuplicateEvery] = useState(0);
  const [controls, setControls] = useState<ControlsInput>({ ...defaultControls });

  const invalid =
    whyInvalid(controls) ?? (organisms < 1 ? 'a garden needs at least one organism' : undefined);

  const submit = async (formEvent: FormEvent): Promise<void> => {
    formEvent.preventDefault();
    if (invalid !== undefined) return;

    const started = await start({
      ...(runId === '' ? {} : { runId }),
      seed,
      organisms,
      controls: create(ControlsSchema, controls),
      tickIntervalMillis: tickMillis,
      maxTicks: BigInt(maxTicks),
      duplicateEvery,
    });
    if (started !== undefined) onStarted(started);
  };

  return (
    <form className="panel run-launcher" onSubmit={(e) => void submit(e)}>
      <h2>Start a run</h2>

      <label>
        Run ID <small>optional — the daemon picks a free one</small>
        <input value={runId} onChange={(e) => setRunId(e.target.value)} placeholder="demo" />
      </label>

      <label>
        Seed <small>the same seed and the same control ticks reach the same garden</small>
        <input
          value={seed}
          onChange={(e) => setSeed(e.target.value)}
          inputMode="numeric"
          required
        />
      </label>

      <label>
        Organisms
        <input
          type="number"
          min={1}
          value={organisms}
          onChange={(e) => setOrganisms(Number(e.target.value))}
        />
      </label>

      <label>
        Tick interval <small>{tickMillis}ms — pace only; it never changes the outcome</small>
        <input
          type="range"
          min={50}
          max={2000}
          step={50}
          value={tickMillis}
          onChange={(e) => setTickMillis(Number(e.target.value))}
        />
      </label>

      <label>
        Max ticks <small>0 runs until finished by hand</small>
        <input
          type="number"
          min={0}
          value={maxTicks}
          onChange={(e) => setMaxTicks(Number(e.target.value))}
        />
      </label>

      <label>
        Duplicate every <small>republish every Nth event of a tick; 0 is off</small>
        <input
          type="number"
          min={0}
          value={duplicateEvery}
          onChange={(e) => setDuplicateEvery(Number(e.target.value))}
        />
      </label>

      <fieldset>
        <legend>Starting controls</legend>
        <ControlSlider
          name="events per tick"
          max={maxEventsPerTick}
          min={1}
          value={controls.eventsPerTick}
          onChange={(eventsPerTick) => setControls({ ...controls, eventsPerTick })}
        />
        <ControlSlider
          name="rain"
          value={controls.rainWeight}
          onChange={(rainWeight) => setControls({ ...controls, rainWeight })}
        />
        <ControlSlider
          name="growth"
          value={controls.growthWeight}
          onChange={(growthWeight) => setControls({ ...controls, growthWeight })}
        />
        <ControlSlider
          name="pest"
          value={controls.pestWeight}
          onChange={(pestWeight) => setControls({ ...controls, pestWeight })}
        />
      </fieldset>

      {invalid !== undefined && <p className="invalid">{invalid}</p>}

      <button type="submit" disabled={invalid !== undefined || pending > 0}>
        {pending > 0 ? 'starting…' : 'Start run'}
      </button>
    </form>
  );
}

interface ControlSliderProps {
  name: string;
  value: number;
  min?: number;
  max?: number;
  hint?: string;
  onChange: (value: number) => void;
}

export function ControlSlider({
  name,
  value,
  min = 0,
  max = 10,
  hint,
  onChange,
}: ControlSliderProps): ReactNode {
  return (
    <label className="control-slider">
      <span>
        {name} <output>{value}</output>
      </span>
      {hint !== undefined && <small>{hint}</small>}
      <input
        type="range"
        aria-label={name}
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  );
}
