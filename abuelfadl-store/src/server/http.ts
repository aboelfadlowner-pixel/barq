import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
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
      return NextResponse.json({ error: "حصل خطأ في السيرفر" }, { status: 500 });
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
  throw new ApiError(400, "البيانات المبعوتة مش مفهومة");
}

/** Parses a numeric id from the URL, or throws 404. */
export function parseId(value: string, what: string): number {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) throw new ApiError(404, `${what} غير موجود`);
  return id;
}

/** After a catalog change: rebuild the store pages so customers see it. */
export function refreshStore() {
  revalidatePath("/", "layout");
}
