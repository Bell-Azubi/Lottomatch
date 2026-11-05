/** Returns a value the test expects to exist, and fails with a readable message otherwise. */
export function present<T>(value: T | null | undefined, what = 'element'): T {
  if (value === null || value === undefined) throw new Error(`Expected ${what} to exist`);
  return value;
}
