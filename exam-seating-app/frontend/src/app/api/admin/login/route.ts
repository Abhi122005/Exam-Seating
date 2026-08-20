import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  ADMIN_COOKIE_NAME,
  checkAdminPassword,
  getAdminCookieOptions,
  issueSessionToken,
} from "~/lib/auth";
import { withRouteLogging } from "~/lib/route-log";

export const POST = withRouteLogging("POST /api/admin/login", async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const password = typeof body?.password === "string" ? body.password : "";

  if (!checkAdminPassword(password)) {
    return NextResponse.json(
      { success: false, message: "Invalid admin password" },
      { status: 401 },
    );
  }

  const cookieStore = await cookies();
  cookieStore.set(ADMIN_COOKIE_NAME, issueSessionToken(), getAdminCookieOptions());

  return NextResponse.json({ success: true });
});
