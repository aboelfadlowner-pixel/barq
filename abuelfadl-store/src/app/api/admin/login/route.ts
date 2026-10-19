import { NextResponse } from "next/server";
import { checkPassword, createSessionToken, SESSION_COOKIE } from "@/server/auth";
import { ApiError } from "@/server/errors";
import { handle, readJson } from "@/server/http";

/** POST /api/admin/login { password } : sets the session cookie for the role of that password (admin / call center). */
export const POST = handle(async (request) => {
  const { password } = await readJson<{ password?: unknown }>(request);
  const role = typeof password === "string" ? checkPassword(password) : null;
  if (!role) throw new ApiError(401, "كلمة المرور غير صحيحة");
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
