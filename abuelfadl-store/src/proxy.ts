import { NextResponse, type NextRequest } from "next/server";

/**
 * One code base, two sites. `APP_PART` (Vercel setting) picks what this deployment serves:
 * - "store": the store only. The dashboard and its API answer 404, so admin load or a dashboard bug never touches it.
 * - "admin": the dashboard only. Store pages send to /admin and the public store API answers 404.
 * - not set (development, demo): both, as one site.
 * Uploaded images (/uploads/...), product photos and covers are files, so both deployments serve them.
 */
export function proxy(request: NextRequest) {
  const part = process.env.APP_PART;
  if (part !== "store" && part !== "admin") return NextResponse.next();

  const { pathname } = request.nextUrl;
  if (pathname === "/api/health") return NextResponse.next();
  const dashboard = pathname === "/admin" || pathname.startsWith("/admin/") || pathname.startsWith("/api/admin/") || pathname === "/api/admin";

  if (part === "store") {
    return dashboard ? new NextResponse("الصفحة غير موجودة", { status: 404, headers: { "content-type": "text/plain; charset=utf-8" } }) : NextResponse.next();
  }
  if (dashboard) return NextResponse.next();
  if (pathname.startsWith("/api/")) return NextResponse.json({ error: "غير موجود" }, { status: 404 });
  return NextResponse.redirect(new URL("/admin", request.url));
}

export const config = {
  // Everything except Next's own files and files with an extension (images, covers, fonts, icons).
  matcher: ["/((?!_next/static|_next/image|.*\\..*).*)"],
};
