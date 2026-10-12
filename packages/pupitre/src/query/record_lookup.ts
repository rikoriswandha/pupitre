/** PostgreSQL rejects malformed integer/UUID identifiers instead of returning no rows. */
export function isInvalidIdentifierError(error: unknown): boolean {
  return !!error && typeof error === 'object' && 'code' in error && error.code === '22P02'
}

/** Only use around identifier lookups; unrelated database failures must propagate. */
export async function lookupOrNull<T>(lookup: () => PromiseLike<T>): Promise<T | null> {
  try {
    return await lookup()
  } catch (error) {
    if (isInvalidIdentifierError(error)) return null
    throw error
  }
}
