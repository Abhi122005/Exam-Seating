/**
 * In-memory rate limiter: 100 failed attempts per key per 15 minutes.
 * Liberal by design — never block a real user.
 * Successful actions should call `resetKey` to clear the counter.
 */

const failedAttempts = new Map<string, { count: number; resetAt: number }>();

export const MAX_FAILED = 100;
export const WINDOW_MS = 15 * 60 * 1000;

/**
 * Record a failed attempt for the given key.
 * Returns `true` if the attempt is allowed, `false` if the limit is exceeded.
 */
export function recordFailure(key: string, now: number = Date.now()): boolean {
  const entry = failedAttempts.get(key);
  if (!entry || now > entry.resetAt) {
    failedAttempts.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  if (entry.count >= MAX_FAILED) return false;
  entry.count++;
  return true;
}

/** Clear the failed-attempt counter for a key (e.g. after successful login). */
export function resetKey(key: string): void {
  failedAttempts.delete(key);
}

/** Get the current failed-attempt count for a key (test helper). */
export function getCount(key: string): number {
  return failedAttempts.get(key)?.count ?? 0;
}

/** Clear all state (test helper). */
export function clearAll(): void {
  failedAttempts.clear();
}
