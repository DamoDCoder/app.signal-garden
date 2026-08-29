import { describe, expect, it } from 'vitest';
import {
  defaultControls,
  maxBatchSize,
  maxEventsPerTick,
  maxWorkerCount,
  whyInvalid,
} from '../../src/api/limits.js';

// These mirror the daemon's rejection rules. The daemon is still the authority
// — the value of testing them here is that the form's affordances and its error
// messages stay in step with each other, not that the client can decide.
describe('control validation', () => {
  it('accepts the defaults', () => {
    expect(whyInvalid({ ...defaultControls })).toBeUndefined();
  });

  it('rejects a rate below one', () => {
    expect(whyInvalid({ ...defaultControls, eventsPerTick: 0 })).toMatch(/at least 1/);
  });

  it('rejects a rate above the producer bound', () => {
    expect(whyInvalid({ ...defaultControls, eventsPerTick: maxEventsPerTick + 1 })).toMatch(
      /not exceed/,
    );
  });

  it('rejects a mix with no positive weight', () => {
    expect(
      whyInvalid({ ...defaultControls, rainWeight: 0, growthWeight: 0, pestWeight: 0 }),
    ).toMatch(/at least one/);
  });

  it('rejects a negative weight', () => {
    expect(whyInvalid({ ...defaultControls, pestWeight: -1 })).toMatch(/negative/);
  });

  it('accepts the max worker count and batch size', () => {
    expect(
      whyInvalid({ ...defaultControls, workerCount: maxWorkerCount, batchSize: maxBatchSize }),
    ).toBeUndefined();
  });

  it('rejects a negative worker count', () => {
    expect(whyInvalid({ ...defaultControls, workerCount: -1 })).toMatch(/worker count.*negative/);
  });

  it('rejects a worker count above the daemon bound', () => {
    expect(whyInvalid({ ...defaultControls, workerCount: maxWorkerCount + 1 })).toMatch(
      /worker count.*not exceed/,
    );
  });

  it('rejects a negative batch size', () => {
    expect(whyInvalid({ ...defaultControls, batchSize: -1 })).toMatch(/batch size.*negative/);
  });

  it('rejects a batch size above the daemon bound', () => {
    expect(whyInvalid({ ...defaultControls, batchSize: maxBatchSize + 1 })).toMatch(
      /batch size.*not exceed/,
    );
  });

  it('rejects a negative fail_snapshot_every', () => {
    expect(whyInvalid({ ...defaultControls, failSnapshotEvery: -1 })).toMatch(
      /fail snapshot every.*negative/,
    );
  });
});
