import { ApiError } from "../../src/server/errors";

/**
 * Browser version of `src/server/storage.ts` for the demo build: the image is kept inside the data itself as a
 * data URL (the demo has no server to store files on), so it lives in the viewer's localStorage like the rest.
 */
export const MAX_UPLOAD_BYTES = 3 * 1024 * 1024;

export async function saveImage(bytes: Uint8Array, contentType: string): Promise<string> {
  if (!/^image\/(webp|jpeg|png)$/.test(contentType)) throw new ApiError(400, "الملف ده مش صورة (المسموح: WebP أو JPG أو PNG)");
  if (bytes.length > MAX_UPLOAD_BYTES) throw new ApiError(413, "الصورة كبيرة قوي (أقصى حد 3 ميجا)");
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return `data:${contentType};base64,${btoa(binary)}`;
}
