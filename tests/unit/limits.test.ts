import { describe, expect, it } from 'vitest';
import { defaultControls, maxEventsPerTick, whyInvalid } from '../../src/api/limits.js';

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
    expect(whyInvalid({ eventsPerTick: 6, rainWeight: 0, growthWeight: 0, pestWeight: 0 })).toMatch(
      /at least one/,
    );
  });

  it('rejects a negative weight', () => {
    expect(whyInvalid({ ...defaultControls, pestWeight: -1 })).toMatch(/negative/);
  });
});
