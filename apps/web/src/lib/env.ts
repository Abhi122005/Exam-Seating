/**
 * Central place for every required secret. Throws immediately if missing,
 * in every environment including local dev -- no silent fallback to a
 * hardcoded value, ever. This keeps the repo aligned with the original
 * security rule: every external secret must come from environment variables,
 * not from embedded literals or local defaults.
 */
function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(
      `${name} is not set. Add it to apps/web/.env.local for local dev, ` +
        `or to your Vercel project's Environment Variables for production.`,
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

export function getParserServiceUrl(): string {
  return requireEnv("PARSER_SERVICE_URL");
}
