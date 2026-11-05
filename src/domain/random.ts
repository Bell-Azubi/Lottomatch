/** Source of independent, uniformly distributed unsigned 32-bit integers. */
export type Uint32Source = () => number;

const RANGE = 2 ** 32;
const MAX_ATTEMPTS = 1_000;

/**
 * Maps a uniform 32-bit source onto `[0, size)` without modulo bias: values at or above the
 * largest multiple of `size` below 2^32 are rejected and drawn again.
 * Throws only on programming errors (invalid size) or a broken source.
 */
export function uniformIndex(size: number, next: Uint32Source): number {
  if (!Number.isInteger(size) || size < 1 || size > RANGE) {
    throw new RangeError(`uniformIndex: size must be an integer in 1..2^32, got ${size}`);
  }
  const limit = RANGE - (RANGE % size);
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const value = next();
    if (!Number.isInteger(value) || value < 0 || value >= RANGE) {
      throw new RangeError(`uniformIndex: source returned a non-uint32 value ${value}`);
    }
    if (value < limit) return value % size;
  }
  throw new Error('uniformIndex: random source rejected too often');
}

/** Picks one element uniformly; `undefined` for an empty list. */
export function pickUniform<T>(items: readonly T[], next: Uint32Source): T | undefined {
  if (items.length === 0) return undefined;
  return items[uniformIndex(items.length, next)];
}

/** Uniform integer in `[1, max]`. */
export function uniformNumber(max: number, next: Uint32Source): number {
  return uniformIndex(max, next) + 1;
}
