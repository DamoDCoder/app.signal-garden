/**
 * Input affordances, not rules.
 *
 * These mirror the daemon's control limits so a slider has sensible bounds and
 * a form can say why a value will not be accepted before sending it. The daemon
 * remains the authority: every value here is validated again on arrival, and a
 * rejection is reported rather than assumed impossible. Nothing in this file
 * describes a garden — that definition lives in the contract, and duplicating it
 * is the failure decision 0011 exists to prevent.
 *
 * Mirrored from internal/domain/controls.go and internal/domain/garden.go at the
 * tag in CONTRACT.
 */

export const maxEventsPerTick = 1000;
export const maxMoisture = 100;
export const maxHealth = 100;
export const maxStage = 5;
export const maxWorkerCount = 64;
export const maxBatchSize = 1000;

export const defaultControls = {
  eventsPerTick: 6,
  rainWeight: 3,
  growthWeight: 2,
  pestWeight: 1,
  workerCount: 0,
  batchSize: 0,
  failSnapshotEvery: 0,
} as const;

export interface ControlsInput {
  eventsPerTick: number;
  rainWeight: number;
  growthWeight: number;
  pestWeight: number;
  workerCount: number;
  batchSize: number;
  failSnapshotEvery: number;
}

/** Why these controls would be rejected, or undefined if they would not be. */
export function whyInvalid(controls: ControlsInput): string | undefined {
  if (controls.eventsPerTick < 1) return 'events per tick must be at least 1';
  if (controls.eventsPerTick > maxEventsPerTick)
    return `events per tick must not exceed ${maxEventsPerTick}`;
  if (controls.rainWeight < 0 || controls.growthWeight < 0 || controls.pestWeight < 0)
    return 'weights must not be negative';
  if (controls.rainWeight + controls.growthWeight + controls.pestWeight === 0)
    return 'at least one event weight must be positive';
  if (controls.workerCount < 0) return 'worker count must not be negative';
  if (controls.workerCount > maxWorkerCount)
    return `worker count must not exceed ${maxWorkerCount}`;
  if (controls.batchSize < 0) return 'batch size must not be negative';
  if (controls.batchSize > maxBatchSize) return `batch size must not exceed ${maxBatchSize}`;
  if (controls.failSnapshotEvery < 0) return 'fail snapshot every must not be negative';
  return undefined;
}
