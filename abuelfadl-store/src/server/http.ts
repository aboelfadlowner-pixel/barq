import { revalidatePath } from "next/cache";
import { after, NextResponse } from "next/server";
import { ApiError } from "./errors";

/**
 * Wraps a route handler: returns its result as JSON, and turns thrown errors into
 * `{ error, fields? }` with the right status (ApiError) or a generic 500.
 */
export function handle<C>(fn: (request: Request, context: C) => Promise<unknown>) {
  return async (request: Request, context: C) => {
    try {
      const result = await fn(request, context);
      return result instanceof Response ? result : NextResponse.json(result ?? { ok: true });
    } catch (error) {
      if (error instanceof ApiError) {
        return NextResponse.json({ error: error.message, fields: error.fields }, { status: error.status });
      }
      console.error("[api]", error);
      return NextResponse.json({ error: "حدث خطأ في الخادم" }, { status: 500 });
    }
  };
}

/** Reads a JSON object body, or throws 400. */
export async function readJson<T = Record<string, unknown>>(request: Request): Promise<T> {
  try {
    const body = await request.json();
    if (body && typeof body === "object" && !Array.isArray(body)) return body as T;
  } catch {
    // fall through
  }
  throw new ApiError(400, "البيانات المرسلة غير مفهومة");
}

/** Parses a numeric id from the URL, or throws 404. */
export function parseId(value: string, what: string): number {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) throw new ApiError(404, `${what} غير موجود`);
  return id;
}

/**
 * After a catalog or settings change: rebuild the store pages so customers see it.
 * With the dashboard deployed apart from the store (APP_PART=admin), this deployment's own pages are not the ones
 * customers see, so the store is also asked to rebuild through its /api/revalidate (NEXT_PUBLIC_STORE_URL +
 * REVALIDATE_SECRET), after the response is sent. Without it the store would show the change within 10 minutes.
 */
export function refreshStore() {
  revalidatePath("/", "layout");
  const store = process.env.NEXT_PUBLIC_STORE_URL;
  const secret = process.env.REVALIDATE_SECRET;
  if (process.env.APP_PART !== "admin" || !store || !secret) return;
  after(async () => {
    try {
      const response = await fetch(new URL("/api/revalidate", store), { method: "POST", headers: { "x-revalidate-secret": secret } });
      if (!response.ok) console.error("[refreshStore] store answered", response.status);
    } catch (error) {
      console.error("[refreshStore] store not reached", error);
    }
  });
}
