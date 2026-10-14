import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { checkAdminPassword, issueSessionToken } from "~/lib/admin-session";
import { ADMIN_COOKIE_NAME, getAdminCookieOptions } from "~/lib/auth";
import { getCount, MAX_FAILED, recordFailure, resetKey } from "~/lib/rate-limit";

function getClientIp(req: Request): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const password = typeof body?.password === "string" ? body.password : "";
  const ip = getClientIp(req);

  // Pre-check before doing any password work: already-exhausted keys are
  // rejected immediately, even for correct passwords (prevents an attacker
  // from probing after lockout, and makes the limit observable).
  if (getCount(ip) >= MAX_FAILED) {
    return NextResponse.json(
      { success: false, message: "Too many failed attempts. Try again later." },
      { status: 429 },
    );
  }

  if (!password || password.length > 256) {
    recordFailure(ip);
    return NextResponse.json(
      { success: false, message: "Invalid admin password" },
      { status: 401 },
    );
  }

  if (!checkAdminPassword(password)) {
    if (!recordFailure(ip)) {
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
  resetKey(ip);
  const cookieStore = await cookies();
  cookieStore.set(ADMIN_COOKIE_NAME, issueSessionToken(), getAdminCookieOptions());

  return NextResponse.json({ success: true });
}
