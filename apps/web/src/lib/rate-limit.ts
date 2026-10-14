/**
 * Login rate limiter.
 *
 * Zero-DB constraint: there is no Redis/Postgres to share counters across
 * serverless instances. So this module layers two defenses:
 *
 * 1. In-memory per-instance counter (fast, existing behavior) — stops a
 *    single instance from being hammered.
 * 2. Blob-backed shared counter (best-effort cross-instance signal) — when
 *    Blob storage is configured, failures are also recorded centrally so a
 *    distributed brute-force is at least visible and partially throttled.
 *
 * The Blob layer is advisory only (eventual consistency, no atomic incr on
 * Vercel Blob). The in-memory check always runs first and is authoritative
 * for the local instance. If the Blob write fails, login still proceeds —
 * auth availability must not depend on storage health.
 */

const failedAttempts = new Map<string, { count: number; resetAt: number }>();

export const MAX_FAILED = 100;
export const WINDOW_MS = 15 * 60 * 1000;

const RATE_LIMIT_BLOB_PREFIX = "exam-seating/ratelimit/";
const BLOB_SYNC_INTERVAL_MS = 30 * 1000;
let lastBlobSync = 0;
const pendingBlobSync = new Map<string, { count: number; resetAt: number }>();

function blobAvailable(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

function rateLimitBlobPath(key: string): string {
  const safe = Buffer.from(key).toString("base64url").slice(0, 128);
  return `${RATE_LIMIT_BLOB_PREFIX}${safe}.json`;
}

async function syncFailuresToBlob(): Promise<void> {
  if (!blobAvailable() || pendingBlobSync.size === 0) return;
  const now = Date.now();
  if (now - lastBlobSync < BLOB_SYNC_INTERVAL_MS) return;
  lastBlobSync = now;
  try {
    const { put, get } = await import("@vercel/blob");
    const entries = [...pendingBlobSync.entries()];
    pendingBlobSync.clear();
    for (const [key, local] of entries) {
      try {
        const path = rateLimitBlobPath(key);
        let remote = { count: 0, resetAt: 0 };
        try {
          const res = await get(path, { access: "private" as const, useCache: false });
          if (res) {
            const buf = Buffer.from(await new Response(res.stream).arrayBuffer());
            remote = JSON.parse(buf.toString("utf-8"));
          }
        } catch {
          // no shared record yet
        }
        const merged =
          local.resetAt >= (remote.resetAt ?? 0)
            ? { count: Math.max(local.count, remote.count ?? 0), resetAt: local.resetAt }
            : { count: (remote.count ?? 0) + local.count, resetAt: local.resetAt };
        await put(path, JSON.stringify(merged), {
          access: "private" as const,
          addRandomSuffix: false,
          contentType: "application/json",
          allowOverwrite: true,
        });
      } catch {
        // Best-effort only — never break login because shared sync failed.
      }
    }
  } catch {
    // @vercel/blob unavailable — in-memory limiting still applies.
  }
}

function queueBlobSync(key: string, entry: { count: number; resetAt: number }): void {
  pendingBlobSync.set(key, { ...entry });
  void syncFailuresToBlob();
}

/**
 * Record a failed attempt for the given key.
 * Returns `true` if the attempt is allowed, `false` if the limit is exceeded.
 */
export function recordFailure(key: string, now: number = Date.now()): boolean {
  const entry = failedAttempts.get(key);
  if (!entry || now > entry.resetAt) {
    const fresh = { count: 1, resetAt: now + WINDOW_MS };
    failedAttempts.set(key, fresh);
    queueBlobSync(key, fresh);
    return true;
  }
  if (entry.count >= MAX_FAILED) return false;
  entry.count++;
  queueBlobSync(key, entry);
  return true;
}

/** Clear the failed-attempt counter for a key (e.g. after successful login). */
export function resetKey(key: string): void {
  failedAttempts.delete(key);
  pendingBlobSync.delete(key);
  // Best-effort shared reset — never throws.
  if (blobAvailable()) {
    void import("@vercel/blob")
      .then(({ del }) => del(rateLimitBlobPath(key)).catch(() => {}))
      .catch(() => {});
  }
}

/** Get the current failed-attempt count for a key (test helper). */
export function getCount(key: string): number {
  return failedAttempts.get(key)?.count ?? 0;
}

/** Clear all state (test helper). */
export function clearAll(): void {
  failedAttempts.clear();
  pendingBlobSync.clear();
  lastBlobSync = 0;
}

/** Test helper: pending cross-instance sync entries. */
export function getPendingSyncCount(): number {
  return pendingBlobSync.size;
}
