import { checkHealth } from "@/server/health";

/** GET /api/health : for an uptime monitor. 200 {"ok":true,...} when the store data can be read, 503 otherwise. */
export async function GET() {
  const health = await checkHealth();
  return Response.json(health, { status: health.ok ? 200 : 503, headers: { "cache-control": "no-store" } });
}
