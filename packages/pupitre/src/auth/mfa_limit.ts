import { consumeLoginLimit, clearLoginLimit } from '../drivers/limiter.js'

const attempts = new Map<string, { count: number; expiresAt: number }>()
const duration = 60_000
const maxEntries = 10_000

/** Reserve a guess synchronously before any asynchronous verification or optional limiter call. */
export async function consumeMfaLimit(
  key: string,
  consumeOptionalLimit: (key: string) => Promise<boolean> = consumeLoginLimit
): Promise<{ limited: boolean; exhausted: boolean }> {
  const now = Date.now()
  for (const [entryKey, entry] of attempts) {
    if (entry.expiresAt <= now) attempts.delete(entryKey)
  }
  let entry = attempts.get(key)
  if (!entry) {
    // Never evict an active budget: saturation must deny new guesses, not reset existing ones.
    if (attempts.size >= maxEntries) return { limited: true, exhausted: true }
    entry = { count: 0, expiresAt: now + duration }
    attempts.set(key, entry)
  }
  if (entry.count >= 5) return { limited: true, exhausted: true }
  entry.count++
  let limited = false
  try {
    limited = await consumeOptionalLimit(key)
  } catch {
    // Optional/distributed limiter failure cannot bypass the already-reserved local budget.
  }
  return { limited, exhausted: entry.count >= 5 }
}

/** Only a verified MFA challenge clears the user budget, never password login/session renewal. */
export async function clearMfaLimit(key: string): Promise<void> {
  attempts.delete(key)
  try {
    await clearLoginLimit(key)
  } catch {
    // The next challenge remains protected by the local budget if the optional backend is down.
  }
}
