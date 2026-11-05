/** Outcome of an operation whose failure is expected and must be handled, never thrown. */
export type Result<T, E> =
  { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: E };

/** Wraps a successful value. */
export function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

/** Wraps an expected failure. */
export function err<E>(error: E): Result<never, E> {
  return { ok: false, error };
}
