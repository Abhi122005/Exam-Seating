import { NextResponse } from "next/server";

export const config = {
  matcher: ["/admin/:path*"],
};

// Edge middleware just checks the cookie is *present* (cheap, fast reroute
// for the common case of "not logged in at all"). The actual signature
// check (lib/auth.js, using Node's crypto) happens again in every
// /api/admin/* route handler, which is what actually protects the data —
// this middleware is only a UX convenience so logged-out staff get bounced
// straight to the login page instead of a broken-looking admin screen.
export function proxy(request) {
  const { pathname } = request.nextUrl;
  if (pathname === "/admin/login") {
    return NextResponse.next();
  }

  const cookie = request.cookies.get("admin_session");
  if (!cookie) {
    const loginUrl = new URL("/admin/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}
