/**
 * The 64-bit edge.
 *
 * Every 64-bit field crosses the wire as a JSON *string* — that is the protobuf
 * JSON mapping, not a preference, and it is uniform across both transports so
 * nothing here has to know which one a value arrived on. The generated code
 * parses those strings into `bigint`, which has two consequences this module
 * exists to contain:
 *
 *   - `bigint` does not mix with `number` in arithmetic. Convert at the point of
 *     rendering, never earlier, so comparisons like `offset > 0n` stay exact.
 *   - `JSON.stringify` throws on `bigint`. Serialise messages with `toJson`
 *     from `@bufbuild/protobuf` instead, which is what `src/api/client.ts` does.
 *
 * `seed` is the exception in the other direction: it is declared JS_STRING
 * because it is an opaque token nobody does arithmetic on, so it stays a string
 * end to end and is never parsed into a number.
 */

import { create } from '@bufbuild/protobuf';
import { type Duration, DurationSchema, type Timestamp } from '@bufbuild/protobuf/wkt';

/** For rendering only. Every quantity in this contract is far below 2^53. */
export const num = (value: bigint): number => Number(value);

/** Duration from milliseconds, for tick intervals coming out of a slider. */
export const durationFromMillis = (millis: number): Duration =>
  create(DurationSchema, {
    seconds: BigInt(Math.floor(millis / 1000)),
    nanos: Math.round((millis % 1000) * 1_000_000),
  });

/** Milliseconds from a Duration, for showing one. */
export const millisFromDuration = (duration: Duration | undefined): number =>
  duration === undefined ? 0 : Number(duration.seconds) * 1000 + duration.nanos / 1_000_000;

/** Milliseconds since the Unix epoch from a Timestamp, for dating a telemetry sample. */
export const millisFromTimestamp = (timestamp: Timestamp | undefined): number | undefined =>
  timestamp === undefined
    ? undefined
    : Number(timestamp.seconds) * 1000 + timestamp.nanos / 1_000_000;
