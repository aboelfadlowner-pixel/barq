import { cookieJar } from "../shims/cookie-jar";
import { ApiError } from "../../src/server/errors";

/** Browser version of `src/server/auth.ts` for the demo build. The password is always "admin". */
export const SESSION_COOKIE = "af_admin";
export const DEMO_PASSWORD = "admin";
const SESSION_DAYS = 7;

export function checkPassword(password: string): boolean {
  return password === DEMO_PASSWORD;
}

export function createSessionToken(): { value: string; maxAge: number } {
  const maxAge = SESSION_DAYS * 24 * 60 * 60;
  return { value: `demo.${Date.now() + maxAge * 1000}`, maxAge };
}

export function isAdminSync(): boolean {
  const token = cookieJar.get(SESSION_COOKIE);
  return Boolean(token && Number(token.split(".")[1]) > Date.now());
}

export async function isAdmin(): Promise<boolean> {
  return isAdminSync();
}

export async function requireAdmin(): Promise<void> {
  if (!isAdminSync()) throw new ApiError(401, "لازم تسجّل دخول الأول");
}
