import { revalidatePath } from "next/cache";
import { timingSafeEqual } from "node:crypto";

/**
 * POST /api/revalidate : called by the dashboard deployment after each change (see `refreshStore`), so the store
 * rebuilds its pages at once. Needs the shared REVALIDATE_SECRET in the "x-revalidate-secret" header; does nothing else.
 */
export async function POST(request: Request) {
  const secret = process.env.REVALIDATE_SECRET ?? "";
  const given = request.headers.get("x-revalidate-secret") ?? "";
  const ok = secret.length >= 16 && given.length === secret.length && timingSafeEqual(Buffer.from(given), Buffer.from(secret));
  if (!ok) return Response.json({ error: "غير مسموح" }, { status: 401 });
  revalidatePath("/", "layout");
  return Response.json({ ok: true });
}
