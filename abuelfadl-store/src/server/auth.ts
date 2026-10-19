import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { Role } from "../types/auth";
import { ApiError } from "./errors";

/**
 * Dashboard login: one password per role and a signed session cookie that carries the role.
 * `ADMIN_PASSWORD` opens everything; `CALLCENTER_PASSWORD` opens the orders side only (see `Role`).
 * Good enough while there is no database; replace with per-user accounts later.
 *
 * In development, unset passwords default to "admin" and "callcenter" so the dashboard can be tried right away.
 * In production a role cannot log in until its password is set.
 */
export const SESSION_COOKIE = "af_admin";
const SESSION_DAYS = 7;

const isProduction = () => process.env.NODE_ENV === "production";

function adminPassword(): string | null {
  return process.env.ADMIN_PASSWORD || (isProduction() ? null : "admin");
}

function callCenterPassword(): string | null {
  return process.env.CALLCENTER_PASSWORD || (isProduction() ? null : "callcenter");
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

/** The role whose password this is, or null. */
export function checkPassword(password: string): Role | null {
  const admin = adminPassword();
  if (!admin) throw new ApiError(503, "لوحة التحكم غير مفعّلة: يجب ضبط ADMIN_PASSWORD في إعدادات الخادم");
  if (safeEqual(password, admin)) return "admin";
  const callCenter = callCenterPassword();
  return callCenter && safeEqual(password, callCenter) ? "callcenter" : null;
}

/** Cookie value: "<expiry ms>.<role>.<signature>". */
export function createSessionToken(role: Role): { value: string; maxAge: number } {
  const key = secret();
  if (!key) throw new ApiError(503, "لوحة التحكم غير مفعّلة");
  const maxAge = SESSION_DAYS * 24 * 60 * 60;
  const payload = `${Date.now() + maxAge * 1000}.${role}`;
  return { value: `${payload}.${sign(payload, key)}`, maxAge };
}

function roleFromToken(token: string | undefined): Role | null {
  const key = secret();
  if (!token || !key) return null;
  const [expires, role, signature] = token.split(".");
  if (!expires || !signature || (role !== "admin" && role !== "callcenter")) return null;
  return Number(expires) > Date.now() && safeEqual(signature, sign(`${expires}.${role}`, key)) ? role : null;
}

/** The signed-in role, or null when there is no valid session. */
export async function getRole(): Promise<Role | null> {
  return roleFromToken((await cookies()).get(SESSION_COOKIE)?.value);
}

/** Throws 401 without a session, 403 for the call center. For every admin-only /api/admin handler. */
export async function requireAdmin(): Promise<void> {
  const role = await getRole();
  if (!role) throw new ApiError(401, "يجب تسجيل الدخول أولًا");
  if (role !== "admin") throw new ApiError(403, "هذه الصفحة متاحة للمدير فقط");
}

/** Throws 401 without a session; returns the role. For the handlers the call center uses too (orders, customers, stats). */
export async function requireStaff(): Promise<Role> {
  const role = await getRole();
  if (!role) throw new ApiError(401, "يجب تسجيل الدخول أولًا");
  return role;
}

/** For admin-only dashboard pages: the call center is sent to the orders. (The panel layout handles signed-out users.) */
export async function adminOnlyPage(): Promise<void> {
  if ((await getRole()) !== "admin") redirect("/admin/orders");
}
