import { randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { ApiError } from "./errors";

/**
 * Where uploaded images (product and category photos) are kept until a real storage service is connected.
 * Files go to `.data/uploads/` (git-ignored, next to the data file) and are served by `src/app/uploads/[name]/route.ts`
 * at `/uploads/<name>`. Connecting Supabase Storage means rewriting `saveImage` / `readImage` only: the dashboard and
 * the upload API do not change. (Vercel cannot keep files on its disk, so uploads need that storage before going live.)
 */
const DIR = path.join(process.cwd(), ".data", "uploads");

/** Accepted image types: the dashboard sends WebP (or JPEG where the browser cannot make WebP). */
const TYPES: Record<string, { ext: string; magic: (b: Buffer) => boolean }> = {
  "image/webp": { ext: "webp", magic: (b) => b.subarray(0, 4).toString("ascii") === "RIFF" && b.subarray(8, 12).toString("ascii") === "WEBP" },
  "image/jpeg": { ext: "jpg", magic: (b) => b[0] === 0xff && b[1] === 0xd8 },
  "image/png": { ext: "png", magic: (b) => b.subarray(1, 4).toString("ascii") === "PNG" },
};
export const MAX_UPLOAD_BYTES = 3 * 1024 * 1024;

const NAME = /^[a-z0-9]{8,40}\.(webp|jpg|png)$/;

/** Checks the bytes are really an image of the given type, saves them and returns the public URL. */
export async function saveImage(data: Uint8Array, contentType: string): Promise<string> {
  const bytes = Buffer.from(data);
  const type = TYPES[contentType];
  if (!type || !type.magic(bytes)) throw new ApiError(400, "هذا الملف ليس صورة (المسموح: WebP أو JPG أو PNG)");
  if (bytes.length > MAX_UPLOAD_BYTES) throw new ApiError(413, "حجم الصورة كبير جدًا (الحد الأقصى 3 ميجابايت)");
  const name = `${Date.now().toString(36)}${randomBytes(6).toString("hex")}.${type.ext}`;
  await mkdir(DIR, { recursive: true });
  await writeFile(path.join(DIR, name), bytes);
  return `/uploads/${name}`;
}

/** The stored file for `/uploads/<name>`, or null. Only names made by `saveImage` are accepted (no paths). */
export async function readImage(name: string): Promise<{ bytes: Buffer; contentType: string } | null> {
  if (!NAME.test(name)) return null;
  const ext = name.split(".").pop();
  const contentType = Object.entries(TYPES).find(([, t]) => t.ext === ext)?.[0] ?? "application/octet-stream";
  try {
    return { bytes: await readFile(path.join(DIR, name)), contentType };
  } catch {
    return null;
  }
}
