import crypto from "crypto";

export const ADMIN_COOKIE_NAME = "admin_session";
export const SESSION_MAX_AGE = 60 * 60 * 24;

const SESSION_NONCE_BYTES = 16;
const SESSION_SIG_BYTES = 32;

function adminPassword(): string {
  return process.env.ADMIN_PASSWORD || "CEC2026";
}

function signSession(payload: Buffer): Buffer {
  return crypto.createHmac("sha256", adminPassword()).update(payload).digest();
}

export function issueSessionToken(): string {
  const ts = Math.floor(Date.now() / 1000);
  const nonce = crypto.randomBytes(SESSION_NONCE_BYTES);
  const payload = Buffer.alloc(4 + SESSION_NONCE_BYTES);
  payload.writeUInt32BE(ts, 0);
  nonce.copy(payload, 4);
  const sig = signSession(payload);
  return `${payload.toString("base64url")}.${sig.toString("base64url")}`;
}

export function verifySessionToken(token: string | undefined | null): boolean {
  if (!token) return false;
  const [payloadB64, sigB64] = token.split(".");
  if (!payloadB64 || !sigB64) return false;
  const payload = Buffer.from(payloadB64, "base64url");
  const sig = Buffer.from(sigB64, "base64url");
  if (payload.length !== 4 + SESSION_NONCE_BYTES || sig.length !== SESSION_SIG_BYTES) return false;
  if (!crypto.timingSafeEqual(sig, signSession(payload))) return false;
  const ts = payload.readUInt32BE(0);
  const now = Math.floor(Date.now() / 1000);
  return now - ts < SESSION_MAX_AGE;
}

export function checkAdminPassword(password: string): boolean {
  const a = Buffer.from(password);
  const b = Buffer.from(adminPassword());
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
