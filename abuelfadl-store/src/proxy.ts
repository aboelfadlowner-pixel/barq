import { NextResponse, type NextRequest } from "next/server";

/**
 * One code base, two sites, and an optional lock while the store is being prepared.
 *
 * `APP_PART` (Vercel setting) picks what this deployment serves:
 * - "store": the store only. The dashboard and its API answer 404, so admin load or a dashboard bug never touches it.
 * - "admin": the dashboard only. Store pages send to /admin and the public store API answers 404.
 * - not set (development, demo): both, as one site.
 * Uploaded images (/uploads/...), product photos and covers are files, so both deployments serve them.
 *
 * `PREVIEW_PASSWORD` (Vercel setting, store side): while set, the store asks for this password before showing anything
 * (pages and the store API, orders included) and tells search engines not to index it. The dashboard keeps its own
 * login and is not locked. Remove the setting on launch day to open the store to everyone.
 */
export async function proxy(request: NextRequest) {
  const part = process.env.APP_PART;
  const { pathname } = request.nextUrl;
  // Uptime monitor, and the dashboard asking the store to rebuild (secret-protected): never locked.
  if (pathname === "/api/health" || pathname === "/api/revalidate") return NextResponse.next();
  const dashboard = pathname === "/admin" || pathname.startsWith("/admin/") || pathname.startsWith("/api/admin/") || pathname === "/api/admin";

  if (part === "admin") {
    if (dashboard) return NextResponse.next();
    if (pathname.startsWith("/api/")) return NextResponse.json({ error: "غير موجود" }, { status: 404 });
    return NextResponse.redirect(new URL("/admin", request.url));
  }
  if (part === "store" && dashboard) {
    return new NextResponse("الصفحة غير موجودة", { status: 404, headers: { "content-type": "text/plain; charset=utf-8" } });
  }

  const password = process.env.PREVIEW_PASSWORD;
  if (!password || dashboard) return NextResponse.next();
  return previewGate(request, password);
}

export const config = {
  // Everything except Next's own files and files with an extension (images, covers, fonts, icons).
  matcher: ["/((?!_next/static|_next/image|.*\\..*).*)"],
};

// ---------- preview lock ----------

const COOKIE = "af_preview";
const GATE = "/preview";
const NO_INDEX = { "X-Robots-Tag": "noindex, nofollow" };

/** The cookie holds a hash of the password, never the password itself; changing the password signs everyone out. */
async function tokenFor(password: string): Promise<string> {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`abuelfadl-preview:${password}`));
  return Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Only paths on this site (no "//other-site" or full URLs) are followed after the password. */
const safeNext = (value: string | null) => (value && value.startsWith("/") && !value.startsWith("//") ? value : "/");

async function previewGate(request: NextRequest, password: string): Promise<NextResponse> {
  const token = await tokenFor(password);
  const { pathname, search, searchParams } = request.nextUrl;

  if (pathname === GATE) {
    if (request.method === "POST") {
      const form = await request.formData().catch(() => null);
      const next = safeNext(String(form?.get("next") ?? ""));
      if ((await tokenFor(String(form?.get("password") ?? ""))) === token) {
        const response = NextResponse.redirect(new URL(next, request.url), 303);
        response.cookies.set(COOKIE, token, { httpOnly: true, secure: request.nextUrl.protocol === "https:", sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30 });
        return response;
      }
      await new Promise((resolve) => setTimeout(resolve, 800)); // slows down guessing
      return gatePage(next, true);
    }
    return gatePage(safeNext(searchParams.get("next")), false);
  }

  if (request.cookies.get(COOKIE)?.value === token) {
    const response = NextResponse.next();
    response.headers.set("X-Robots-Tag", NO_INDEX["X-Robots-Tag"]);
    return response;
  }
  if (pathname.startsWith("/api/")) return NextResponse.json({ error: "الموقع مغلق مؤقتًا" }, { status: 401, headers: NO_INDEX });
  return NextResponse.redirect(new URL(`${GATE}?next=${encodeURIComponent(pathname + search)}`, request.url));
}

const escape = (value: string) => value.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/** A small standalone page (no store styles or data are sent before the password). */
function gatePage(next: string, wrong: boolean): NextResponse {
  const html = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>أبو الفضل</title>
<style>*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;background:#F5F6F5;font-family:Tahoma,'Segoe UI',sans-serif;color:#1A211C}
form{width:min(360px,calc(100% - 32px));background:#fff;border-radius:20px;padding:28px 24px;box-shadow:0 10px 30px rgba(20,30,22,.08);display:grid;gap:12px;text-align:center}
h1{margin:0;color:#105028;font-size:1.5rem}p{margin:0;color:#67726A;font-size:.92rem;line-height:1.7}
input{font:inherit;padding:12px 14px;border:1.5px solid #E7EAE7;border-radius:12px;text-align:center;direction:ltr}
button{font:inherit;font-weight:700;padding:12px;border:0;border-radius:999px;background:#1F5E37;color:#fff;cursor:pointer}
.err{color:#C62828}</style></head><body>
<form method="post" action="${GATE}"><h1>أبو الفضل</h1><p>الموقع قيد التجهيز. اكتب كلمة المرور للمعاينة.</p>
${wrong ? '<p class="err">كلمة المرور غير صحيحة</p>' : ""}
<input type="password" name="password" autocomplete="current-password" autofocus required aria-label="كلمة المرور">
<input type="hidden" name="next" value="${escape(next)}"><button type="submit">دخول</button></form></body></html>`;
  return new NextResponse(html, { status: wrong ? 401 : 200, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", ...NO_INDEX } });
}
