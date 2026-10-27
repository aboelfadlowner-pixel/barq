// cc-drivers — call-center edge function (18_driver_tracking.sql).
// The drivers have no e-mail and no password: the admin adds each driver (name + mobile) and
// sends him his own link. Two actions:
//   create — the admin (signed in) adds a driver: a login account with a made-up address that
//            receives nothing, then cc_driver_setup → returns the link's secret once.
//   login  — the driver opens his link: secret → his account → a one-time sign-in code the page
//            uses at once (verifyOtp). A new link from the admin, or stopping him, ends the old one.
// Uses the project's own service key from the function's environment — no key is written here.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

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
  const body = await req.json().catch(() => ({}));

  if (body.action === "login") {
    const secret = typeof body.token === "string" ? body.token : "";
    const { data: userId } = secret ? await sb.rpc("cc_driver_by_link", { p_token: secret }) : { data: null };
    if (!userId) return json({ error: "اللينك ده مبقاش شغال — اطلب لينك جديد من الإدارة" }, 403);
    const { data: u } = await sb.auth.admin.getUserById(userId);
    if (!u?.user?.email) return json({ error: "اللينك ده مبقاش شغال — اطلب لينك جديد من الإدارة" }, 403);
    const { data: link, error } = await sb.auth.admin.generateLink({ type: "magiclink", email: u.user.email });
    if (error || !link?.properties?.hashed_token) return json({ error: "تعذر الدخول — جرّب تاني" }, 502);
    return json({ token_hash: link.properties.hashed_token });
  }

  if (body.action === "create") {
    // Caller must be the signed-in, active admin.
    const jwt = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    const { data: who } = jwt ? await sb.auth.getUser(jwt) : { data: { user: null } };
    if (!who?.user) return json({ error: "غير مصرح" }, 401);
    const { data: staff } = await sb.from("cc_staff").select("active, role").eq("user_id", who.user.id).maybeSingle();
    if (!staff?.active || staff.role !== "admin") return json({ error: "للأدمن بس" }, 403);

    const email = `driver-${crypto.randomUUID()}@drivers.cc.local`;   // never receives mail
    const { data: made, error: mkErr } = await sb.auth.admin.createUser({ email, email_confirm: true });
    if (mkErr || !made?.user) return json({ error: "تعذر إضافة الطيار — جرّب تاني" }, 502);
    const { data: secret, error } = await sb.rpc("cc_driver_setup", {
      p_user_id: made.user.id, p_name: body.name ?? "", p_phone: body.phone ?? "",
    });
    if (error) {
      await sb.auth.admin.deleteUser(made.user.id);   // only the account made just now
      return json({ error: error.message, hint: error.hint }, 400);
    }
    return json({ user_id: made.user.id, token: secret });
  }

  return json({ error: "action?" }, 400);
});
