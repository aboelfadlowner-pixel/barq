// cc-sale-unit — call-center edge function.
// Keeps cc_product_sale_unit (sku → sold by weight) in step with the products
// sheet's is_sold_by_weight column. Called by the call-center app when it opens
// (at most once every 10 minutes). Only the active call-center account may call it.
// Also refreshes the categories (التصنيفات.csv + category_reference), same throttle.
// Writes only call-center tables; reads the Drive files only.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { CATEGORIES_FILE_ID, fetchDriveCsv, PRODUCTS_FILE_ID, syncCategories, syncSaleUnits } from "./core.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  // Caller must be the signed-in, active call-center account.
  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  const { data: who } = token ? await sb.auth.getUser(token) : { data: { user: null } };
  if (!who?.user) return json({ error: "غير مصرح" }, 401);
  const { data: staff } = await sb.from("cc_staff").select("active").eq("user_id", who.user.id).maybeSingle();
  if (!staff?.active) return json({ error: "غير مصرح" }, 403);

  // The products file is downloaded once and shared by both syncs.
  let products: Promise<string> | null = null;
  const loadProducts = () => (products ??= fetchDriveCsv(PRODUCTS_FILE_ID));
  const result = await syncSaleUnits(sb, loadProducts);
  const categories = await syncCategories(sb, loadProducts, () => fetchDriveCsv(CATEGORIES_FILE_ID))
    .catch((e) => ({ status: "failed", error: String(e instanceof Error ? e.message : e) }));
  return json({ ...result, categories }, result.status === "failed" ? 502 : 200);
});
