import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  ADMIN_COOKIE_NAME,
  checkAdminPassword,
  getAdminCookieOptions,
  issueSessionToken,
} from "~/lib/admin-session"; // In-memory rate limiter: 50 failed attempts per IP per 15 minutes.
// Liberal by design — never block a real user. Successful logins don't count.
const failedAttempts = new Map<string, { count: number; resetAt: number }>();
const MAX_FAILED = 100;
const WINDOW_MS = 15 * 60 * 1000;

function getClientIp(req: Request): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

function recordFailed(ip: string): boolean {
  const now = Date.now();
  const entry = failedAttempts.get(ip);
  if (!entry || now > entry.resetAt) {
    failedAttempts.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  if (entry.count >= MAX_FAILED) return false;
  entry.count++;
  return true;
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const password = typeof body?.password === "string" ? body.password : "";
  const ip = getClientIp(req);

  if (!checkAdminPassword(password)) {
    if (!recordFailed(ip)) {
      return NextResponse.json(
        { success: false, message: "Too many failed attempts. Try again later." },
        { status: 429 },
      );
    }
    return NextResponse.json(
      { success: false, message: "Invalid admin password" },
      { status: 401 },
    );
  }

  // Successful login — never rate-limited, clear failed count
  failedAttempts.delete(ip);
  const cookieStore = await cookies();
  cookieStore.set(ADMIN_COOKIE_NAME, issueSessionToken(), getAdminCookieOptions());

  return NextResponse.json({ success: true });
}
