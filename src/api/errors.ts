/**
 * Failures a caller branches on.
 *
 * The daemon maps every condition to a status code rather than to message text,
 * and its contracts document is explicit that the code is what a client
 * branches on. This module turns those codes into a discriminated reason so no
 * component ever matches on a string.
 */

export type FailureReason =
  /** No such run. 404. */
  | 'not_found'
  /** Run ID already in use, live or as history on disk. 409. */
  | 'already_exists'
  /** Rejected controls or start request, or a command against a finished run. 400. */
  | 'rejected'
  /** Run log opened corrupt under the refuse policy. 500. */
  | 'data_loss'
  /** Registry shutting down. 503. */
  | 'unavailable'
  /** The daemon could not be reached at all. */
  | 'offline'
  /** A status the contract does not describe. */
  | 'unknown';

export class GardenError extends Error {
  constructor(
    readonly reason: FailureReason,
    readonly status: number,
    message: string,
    readonly detail?: string,
  ) {
    super(message);
    this.name = 'GardenError';
  }

  /** True when retrying the same request could plausibly succeed. */
  get retryable(): boolean {
    return this.reason === 'unavailable' || this.reason === 'offline';
  }
}

export const reasonForStatus = (status: number): FailureReason => {
  switch (status) {
    case 400:
      return 'rejected';
    case 404:
      return 'not_found';
    case 409:
      return 'already_exists';
    case 500:
      return 'data_loss';
    case 503:
      return 'unavailable';
    default:
      return 'unknown';
  }
};

/** What to show a person, given a failure. Kept here so the wording is one place. */
export const explain = (error: GardenError): string => {
  switch (error.reason) {
    case 'not_found':
      return 'That run does not exist on this daemon.';
    case 'already_exists':
      return 'That run ID is taken, by a live run or by history on disk. Pick another, or leave it blank.';
    case 'rejected':
      return error.detail ?? 'The daemon rejected that request.';
    case 'data_loss':
      return 'The run log opened corrupt and the daemon refused it.';
    case 'unavailable':
      return 'The daemon is shutting down.';
    case 'offline':
      return 'No daemon at this address. Start one with `task serve`, or `docker compose up`.';
    case 'unknown':
      return error.detail ?? 'The daemon returned something this client does not understand.';
  }
};
