import crypto from "crypto";

const COOKIE_NAME = "admin_session";
const MAX_AGE_SECONDS = 60 * 60 * 8; // 8 hours

function secret() {
  const s = process.env.ADMIN_PASSWORD;
  if (!s) throw new Error("ADMIN_PASSWORD is not set");
  return s;
}

/** A short signature over a timestamp, so the cookie can't just be guessed
 * or replayed indefinitely, without needing a database-backed session store. */
function sign(timestamp) {
  return crypto.createHmac("sha256", secret()).update(String(timestamp)).digest("hex");
}

export function createSessionCookieValue() {
  const timestamp = Date.now();
  return `${timestamp}.${sign(timestamp)}`;
}

export function isValidSession(cookieValue) {
  if (!cookieValue) return false;
  const [timestampStr, sig] = cookieValue.split(".");
  const timestamp = Number(timestampStr);
  if (!timestamp || !sig) return false;
  if (Date.now() - timestamp > MAX_AGE_SECONDS * 1000) return false;
  return sig === sign(timestamp);
}

export function setSessionCookieHeader() {
  const value = createSessionCookieValue();
  return `${COOKIE_NAME}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${MAX_AGE_SECONDS}${
    process.env.NODE_ENV === "production" ? "; Secure" : ""
  }`;
}

export function clearSessionCookieHeader() {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

export function getSessionCookieFromRequest(req) {
  const raw = req.headers.cookie || "";
  const match = raw.split(";").map((c) => c.trim()).find((c) => c.startsWith(`${COOKIE_NAME}=`));
  return match ? match.slice(COOKIE_NAME.length + 1) : null;
}

export const SESSION_COOKIE_NAME = COOKIE_NAME;

/** Returns true and does nothing further if the request has a valid admin
 * session; otherwise writes a 401 response and returns false. Use as:
 *   if (!requireSession(req, res)) return;
 */
export function requireSession(req, res) {
  const cookieValue = getSessionCookieFromRequest(req);
  if (!isValidSession(cookieValue)) {
    res.status(401).json({ error: "Not authenticated" });
    return false;
  }
  return true;
}
