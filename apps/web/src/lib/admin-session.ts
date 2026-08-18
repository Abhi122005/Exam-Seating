import crypto from "crypto";

export const ADMIN_COOKIE_NAME = "admin_session";
export const SESSION_MAX_AGE = 60 * 60 * 24;

const SESSION_NONCE_BYTES = 16;
const SESSION_SIG_BYTES = 32;

function adminPassword(): string {
  return process.env.ADMIN_PASSWORD || "CEC2026";
}

function signSession(nonce: Buffer): Buffer {
  return crypto.createHmac("sha256", adminPassword()).update(nonce).digest();
}

export function issueSessionToken(): string {
  const nonce = crypto.randomBytes(SESSION_NONCE_BYTES);
  const sig = signSession(nonce);
  return `${nonce.toString("base64url")}.${sig.toString("base64url")}`;
}

export function verifySessionToken(token: string | undefined | null): boolean {
  if (!token) return false;
  const [nonceB64, sigB64] = token.split(".");
  if (!nonceB64 || !sigB64) return false;
  const nonce = Buffer.from(nonceB64, "base64url");
  const sig = Buffer.from(sigB64, "base64url");
  if (nonce.length !== SESSION_NONCE_BYTES || sig.length !== SESSION_SIG_BYTES) return false;
  return crypto.timingSafeEqual(sig, signSession(nonce));
}

export function checkAdminPassword(password: string): boolean {
  const a = Buffer.from(password);
  const b = Buffer.from(adminPassword());
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
