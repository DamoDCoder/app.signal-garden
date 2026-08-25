import { describe, expect, it } from 'vitest';
import { GardenError, reasonForStatus } from '../../src/api/errors.js';

// The daemon maps every condition to a status code rather than to message text.
// This is the table from its contracts document, asserted rather than trusted.
describe('status mapping', () => {
  it.each([
    [400, 'rejected'],
    [404, 'not_found'],
    [409, 'already_exists'],
    [500, 'data_loss'],
    [503, 'unavailable'],
  ])('maps %i to %s', (status, reason) => {
    expect(reasonForStatus(status)).toBe(reason);
  });

  it('treats a shutting-down daemon as worth retrying and a rejection as not', () => {
    expect(new GardenError('unavailable', 503, '').retryable).toBe(true);
    expect(new GardenError('rejected', 400, '').retryable).toBe(false);
  });
});
