import { NextResponse } from "next/server";
import { checkPassword, createSessionToken, SESSION_COOKIE } from "@/server/auth";
import { ApiError } from "@/server/errors";
import { handle, readJson } from "@/server/http";
import { assertNotLocked, clientKey, recordFailure, recordSuccess } from "@/server/loginGuard";

/**
 * POST /api/admin/login { password } : sets the session cookie for the role of that password (admin / call center).
 * Five wrong passwords from one address lock it out for 15 minutes (see loginGuard).
 */
export const POST = handle(async (request) => {
  const key = clientKey(request);
  assertNotLocked(key);
  const { password } = await readJson<{ password?: unknown }>(request);
  const role = typeof password === "string" ? checkPassword(password) : null;
  if (!role) throw new ApiError(401, recordFailure(key));
  recordSuccess(key);
  const { value, maxAge } = createSessionToken(role);
  const response = NextResponse.json({ ok: true, role });
  response.cookies.set(SESSION_COOKIE, value, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  });
  return response;
});
