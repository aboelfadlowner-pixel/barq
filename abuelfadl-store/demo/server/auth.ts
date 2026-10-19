import { cookieJar } from "../shims/cookie-jar";
import { ApiError } from "../../src/server/errors";
import type { Role } from "../../src/types/auth";

/** Browser version of `src/server/auth.ts` for the demo build. Passwords: "admin" and "callcenter". */
export const SESSION_COOKIE = "af_admin";
export const DEMO_PASSWORD = "admin";
const PASSWORDS: Record<string, Role> = { admin: "admin", callcenter: "callcenter" };
const SESSION_DAYS = 7;

export function checkPassword(password: string): Role | null {
  return PASSWORDS[password] ?? null;
}

export function createSessionToken(role: Role): { value: string; maxAge: number } {
  const maxAge = SESSION_DAYS * 24 * 60 * 60;
  return { value: `demo.${Date.now() + maxAge * 1000}.${role}`, maxAge };
}

export function getRoleSync(): Role | null {
  const [, expires, role] = (cookieJar.get(SESSION_COOKIE) ?? "").split(".");
  return Number(expires) > Date.now() && (role === "admin" || role === "callcenter") ? role : null;
}

export async function getRole(): Promise<Role | null> {
  return getRoleSync();
}

export async function requireAdmin(): Promise<void> {
  const role = getRoleSync();
  if (!role) throw new ApiError(401, "يجب تسجيل الدخول أولًا");
  if (role !== "admin") throw new ApiError(403, "هذه الصفحة متاحة للمدير فقط");
}

export async function requireStaff(): Promise<Role> {
  const role = getRoleSync();
  if (!role) throw new ApiError(401, "يجب تسجيل الدخول أولًا");
  return role;
}

export async function adminOnlyPage(): Promise<void> {}
