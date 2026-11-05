type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

function canonicalise(value: unknown): Json {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') return value;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (Array.isArray(value)) return value.map(canonicalise);
  if (typeof value === 'object') {
    const entries = Object.entries(value)
      .filter(([, entry]) => entry !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return Object.fromEntries(entries.map(([key, entry]) => [key, canonicalise(entry)]));
  }
  return null;
}

/**
 * Deterministic JSON: object keys sorted, `undefined` entries dropped. Used for the hash chain
 * and export checksums so equal data always hashes equally.
 */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(canonicalise(value));
}
