import { NextResponse } from "next/server";
import { checkPassword, createSessionToken, SESSION_COOKIE } from "@/server/auth";
import { ApiError } from "@/server/errors";
import { handle, readJson } from "@/server/http";

/** POST /api/admin/login { password } : sets the admin session cookie. */
export const POST = handle(async (request) => {
  const { password } = await readJson<{ password?: unknown }>(request);
  if (typeof password !== "string" || !checkPassword(password)) throw new ApiError(401, "كلمة السر غلط");
  const { value, maxAge } = createSessionToken();
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, value, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  });
  return response;
});
