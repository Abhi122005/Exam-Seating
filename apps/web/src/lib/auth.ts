import { cookies } from "next/headers";

const ADMIN_COOKIE_NAME = "admin_session";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "CEC2026";

export function checkAdminPassword(password: string): boolean {
  return password === ADMIN_PASSWORD;
}

export async function isAdminAuthenticated(): Promise<boolean> {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_COOKIE_NAME)?.value;
  return token === ADMIN_PASSWORD;
}

export function getAdminCookieHeader(password: string): string {
  return `${ADMIN_COOKIE_NAME}=${password}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400`;
}

export function getClearAdminCookieHeader(): string {
  return `${ADMIN_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}
