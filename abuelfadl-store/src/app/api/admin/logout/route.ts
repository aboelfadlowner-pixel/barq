import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/server/auth";
import { handle } from "@/server/http";

/** POST /api/admin/logout : clears the admin session cookie. */
export const POST = handle(async () => {
  const response = NextResponse.json({ ok: true });
  response.cookies.delete(SESSION_COOKIE);
  return response;
});
