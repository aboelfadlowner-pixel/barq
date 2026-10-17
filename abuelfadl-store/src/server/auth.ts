import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { ApiError } from "./errors";

/**
 * Admin login: one shared password (env `ADMIN_PASSWORD`) and a signed session cookie.
 * Good enough while there is one admin team and no database; replace with per-user accounts later.
 *
 * In development, if `ADMIN_PASSWORD` is not set, the password is "admin" so the dashboard can be tried right away.
 * In production the login is refused until `ADMIN_PASSWORD` is set.
 */
export const SESSION_COOKIE = "af_admin";
const SESSION_DAYS = 7;

function adminPassword(): string | null {
  return process.env.ADMIN_PASSWORD || (process.env.NODE_ENV === "production" ? null : "admin");
}

/** Signing key: `ADMIN_SESSION_SECRET`, or derived from the password (changing the password then logs everyone out). */
function secret(): string | null {
  const password = adminPassword();
  return process.env.ADMIN_SESSION_SECRET || (password ? `af-session:${password}` : null);
}

const sign = (payload: string, key: string) => createHmac("sha256", key).update(payload).digest("base64url");

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

export function checkPassword(password: string): boolean {
  const expected = adminPassword();
  if (!expected) throw new ApiError(503, "لوحة التحكم غير مفعّلة: لازم يتحط ADMIN_PASSWORD في إعدادات السيرفر");
  return safeEqual(password, expected);
}

/** Cookie value: "<expiry ms>.<signature>". */
export function createSessionToken(): { value: string; maxAge: number } {
  const key = secret();
  if (!key) throw new ApiError(503, "لوحة التحكم غير مفعّلة");
  const maxAge = SESSION_DAYS * 24 * 60 * 60;
  const expires = String(Date.now() + maxAge * 1000);
  return { value: `${expires}.${sign(expires, key)}`, maxAge };
}

function isValidToken(token: string | undefined): boolean {
  const key = secret();
  if (!token || !key) return false;
  const [expires, signature] = token.split(".");
  return Boolean(expires && signature) && Number(expires) > Date.now() && safeEqual(signature, sign(expires, key));
}

export async function isAdmin(): Promise<boolean> {
  return isValidToken((await cookies()).get(SESSION_COOKIE)?.value);
}

/** Throws 401 unless the request carries a valid admin session. Call at the top of every /api/admin handler. */
export async function requireAdmin(): Promise<void> {
  if (!(await isAdmin())) throw new ApiError(401, "لازم تسجّل دخول الأول");
}
