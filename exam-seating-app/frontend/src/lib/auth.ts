import { cookies } from "next/headers";
import {
  ADMIN_COOKIE_NAME,
  SESSION_MAX_AGE,
  checkAdminPassword,
  issueSessionToken,
  verifySessionToken,
} from "~/lib/admin-session";

export {
  ADMIN_COOKIE_NAME,
  SESSION_MAX_AGE,
  checkAdminPassword,
  issueSessionToken,
  verifySessionToken,
};

export function getAdminCookieOptions(): {
  httpOnly: boolean;
  sameSite: "lax";
  secure: boolean;
  path: string;
  maxAge: number;
} {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  };
}

export async function isAdminAuthenticated(): Promise<boolean> {
  const cookieStore = await cookies();
  return verifySessionToken(cookieStore.get(ADMIN_COOKIE_NAME)?.value);
}