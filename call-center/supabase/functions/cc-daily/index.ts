// cc-daily — the call center's nightly job (scheduled once a day, e.g. 3–4 AM Cairo):
//   1) a backup copy of all the call-center data → private bucket cc-backups/daily/YYYY-MM-DD.json,
//      keeping the last 30 days (older copies are removed);
//   2) the drivers' delivery photos older than 30 days are removed (bucket cc-delivery-photos only).
// Only the scheduler can run it: header x-cc-cleanup must equal the CC_CLEANUP_SECRET set in the
// function's settings. Uses the project's own service key from the environment — no key is written here.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const BACKUPS = "cc-backups";
const PHOTOS = "cc-delivery-photos";
const KEEP_BACKUP_DAYS = 30;
const KEEP_PHOTO_DAYS = 30;
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

Deno.serve(async (req: Request) => {
  const secret = Deno.env.get("CC_CLEANUP_SECRET");
  if (!secret || req.headers.get("x-cc-cleanup") !== secret) return json({ error: "forbidden" }, 403);
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const out: Record<string, unknown> = {};

  // 1) backup (Cairo date in the file name)
  try {
    const { data, error } = await sb.rpc("cc_backup_export");
    if (error) throw error;
    const day = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Cairo" }).format(new Date());
    const path = `daily/${day}.json`;
    const up = await sb.storage.from(BACKUPS).upload(path, new Blob([JSON.stringify(data)], { type: "application/json" }),
      { contentType: "application/json", upsert: true });
    if (up.error) throw up.error;
    out.backup = path;
    const cutoff = new Date(Date.now() - KEEP_BACKUP_DAYS * 86400000).toISOString().slice(0, 10);
    const { data: files } = await sb.storage.from(BACKUPS).list("daily", { limit: 1000 });
    const old = (files ?? []).filter((f) => f.name.endsWith(".json") && f.name.slice(0, 10) < cutoff).map((f) => `daily/${f.name}`);
    if (old.length) await sb.storage.from(BACKUPS).remove(old);
    out.backups_removed = old.length;
  } catch (e) {
    out.backup_error = String((e as Error)?.message ?? e);
  }

  // 2) delivery photos older than 30 days (one folder per driver)
  try {
    const cutoff = Date.now() - KEEP_PHOTO_DAYS * 86400000;
    let removed = 0;
    const { data: folders, error } = await sb.storage.from(PHOTOS).list("", { limit: 1000 });
    if (error) throw error;
    for (const folder of folders ?? []) {
      if (folder.id) continue;                       // a file at the top (not a driver folder): leave it
      for (;;) {                                     // oldest first; a full page of old photos → list again
        const { data: files, error: e } = await sb.storage.from(PHOTOS)
          .list(folder.name, { limit: 1000, sortBy: { column: "created_at", order: "asc" } });
        if (e) throw e;
        const old = (files ?? []).filter((f) => f.created_at && Date.parse(f.created_at) < cutoff);
        if (old.length) {
          const { error: rmErr } = await sb.storage.from(PHOTOS).remove(old.map((f) => `${folder.name}/${f.name}`));
          if (rmErr) throw rmErr;
          removed += old.length;
        }
        if (!files || files.length < 1000 || old.length < files.length) break;
      }
    }
    out.photos_removed = removed;
  } catch (e) {
    out.photos_error = String((e as Error)?.message ?? e);
  }

  return json(out, out.backup_error ? 500 : 200);
});
