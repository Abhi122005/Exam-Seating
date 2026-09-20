/**
 * Central place for every required secret. Throws immediately if missing,
 * in every environment including local dev -- no silent fallback to a
 * hardcoded value, ever. Created because the same "|| 'literal-value'"
 * pattern was found duplicated across three files (admin-session.ts,
 * exam-publish.ts, cron/cleanup/route.ts), each with its own hardcoded
 * fallback already committed to git history. One place to audit from now on.
 */
function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `${name} is not set. Add it to apps/web/.env.local for local dev, ` +
        `or to your Vercel project's Environment Variables for production.`
    );
  }
  return value;
}

export function getAdminPassword(): string {
  return requireEnv("ADMIN_PASSWORD");
}

export function getBackendSharedSecret(): string {
  return requireEnv("BACKEND_SHARED_SECRET");
}

export function getCronSecret(): string {
  return requireEnv("CRON_SECRET");
}