// Pushes Semlehy-branch prices + availability to the online store (Laravel).
// Source: public.website_feed. Runs hourly via pg_cron, or manually (?dry=1 to preview).
//
// Required secrets (supabase secrets set ...):
//   WEBSITE_SYNC_URL    e.g. https://new.abuelfadlstore.com/api/barq/stock-sync
//   WEBSITE_SYNC_TOKEN  shared bearer token, same value as BARQ_SYNC_TOKEN in the Laravel .env
// Optional:
//   WEBSITE_SYNC_SKUS   comma-separated SKUs to limit the sync to (for the first test run)

import { createClient } from "npm:@supabase/supabase-js@2";

const CHUNK = 500;

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const dry = url.searchParams.get("dry") === "1";
  const trigger = url.searchParams.get("trigger") ?? "manual";

  const db = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const target = Deno.env.get("WEBSITE_SYNC_URL");
  const token = Deno.env.get("WEBSITE_SYNC_TOKEN");
  const onlySkus = (Deno.env.get("WEBSITE_SYNC_SKUS") ?? "")
    .split(",").map((s) => s.trim()).filter(Boolean);

  const log = async (row: Record<string, unknown>) => {
    if (!dry) await db.from("website_sync_log").insert({ trigger, ...row });
  };

  try {
    const items = [];
    for (let from = 0; ; from += 1000) {
      let q = db.from("website_feed").select("sku,price,qty,available").order("sku");
      if (onlySkus.length) q = q.in("sku", onlySkus);
      const { data, error } = await q.range(from, from + 999);
      if (error) throw error;
      items.push(...data.map((r) => ({
        sku: r.sku,
        price: Number(r.price),
        qty: Number(r.qty),
        available: r.available,
      })));
      if (data.length < 1000) break;
    }

    if (dry) return json({ dry: true, count: items.length, sample: items.slice(0, 10) });
    if (!target || !token) throw new Error("WEBSITE_SYNC_URL / WEBSITE_SYNC_TOKEN not set");

    let updated = 0, unchanged = 0;
    const notFound: string[] = [];
    for (let i = 0; i < items.length; i += CHUNK) {
      const res = await fetch(target, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
          "Accept": "application/json",
        },
        body: JSON.stringify({ items: items.slice(i, i + CHUNK) }),
      });
      if (!res.ok) throw new Error(`site responded ${res.status}: ${(await res.text()).slice(0, 300)}`);
      const r = await res.json();
      updated += r.updated ?? 0;
      unchanged += r.unchanged ?? 0;
      notFound.push(...(r.not_found ?? []));
    }

    const summary = { sent: items.length, updated, unchanged, not_found: notFound.length };
    await log({ ...summary, not_found_skus: notFound, ok: true });
    return json({ ok: true, ...summary, not_found_skus: notFound });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await log({ ok: false, error: msg });
    return json({ ok: false, error: msg }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
