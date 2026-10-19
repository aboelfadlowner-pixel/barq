import { NextResponse } from "next/server";
import { requireAdmin } from "@/server/auth";
import { ApiError } from "@/server/errors";
import { handle } from "@/server/http";
import { MAX_UPLOAD_BYTES, saveImage } from "@/server/storage";

/** POST /api/admin/uploads : the image file as the request body (Content-Type image/webp|jpeg|png). Returns { url }. */
export const POST = handle(async (request) => {
  await requireAdmin();
  const size = Number(request.headers.get("content-length") ?? 0);
  if (size > MAX_UPLOAD_BYTES) throw new ApiError(413, "حجم الصورة كبير جدًا (الحد الأقصى 3 ميجابايت)");
  const bytes = new Uint8Array(await request.arrayBuffer());
  const url = await saveImage(bytes, (request.headers.get("content-type") ?? "").split(";")[0].trim());
  return NextResponse.json({ url }, { status: 201 });
});
