// Removes the drivers' delivery photos older than 30 days (bucket cc-delivery-photos only).
// The delivery times stay in the database; only the picture goes.
// Runs once a day (scheduled). Uses the project's own service key from the function's
// environment — no key is written here.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const BUCKET = 'cc-delivery-photos';
const KEEP_DAYS = 30;

Deno.serve(async (req) => {
  const secret = Deno.env.get('CC_CLEANUP_SECRET');
  if (!secret || req.headers.get('x-cc-cleanup') !== secret) return new Response('forbidden', { status: 403 });

  const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const cutoff = Date.now() - KEEP_DAYS * 86400000;
  let removed = 0;

  const { data: folders, error } = await sb.storage.from(BUCKET).list('', { limit: 1000 });
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });

  for (const folder of folders ?? []) {
    if (folder.id) continue;                       // a file at the top (not a driver folder): leave it
    for (;;) {                                     // oldest first; a full page of old photos → list again
      const { data: files, error: e } = await sb.storage.from(BUCKET)
        .list(folder.name, { limit: 1000, sortBy: { column: 'created_at', order: 'asc' } });
      if (e) return new Response(JSON.stringify({ error: e.message }), { status: 500 });
      const old = (files ?? []).filter((f) => f.created_at && Date.parse(f.created_at) < cutoff);
      if (old.length) {
        const { error: rmErr } = await sb.storage.from(BUCKET).remove(old.map((f) => `${folder.name}/${f.name}`));
        if (rmErr) return new Response(JSON.stringify({ error: rmErr.message }), { status: 500 });
        removed += old.length;
      }
      if (!files || files.length < 1000 || old.length < files.length) break;   // sorted oldest first
    }
  }
  return new Response(JSON.stringify({ removed }), { headers: { 'content-type': 'application/json' } });
});
