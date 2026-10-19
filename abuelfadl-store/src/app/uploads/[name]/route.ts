import { readImage } from "@/server/storage";

/** GET /uploads/<name> : an image uploaded from the dashboard (names are random, so the files never change). */
export async function GET(_request: Request, { params }: { params: Promise<{ name: string }> }) {
  const file = await readImage((await params).name);
  if (!file) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(file.bytes), {
    headers: { "Content-Type": file.contentType, "Cache-Control": "public, max-age=31536000, immutable" },
  });
}
