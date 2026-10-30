import { read, usingDatabase } from "./db";

/** Whether the site can read the store data (the database when one is set), within 8 s. */
export async function checkHealth(): Promise<{ ok: boolean; database: "ok" | "local" | "down"; ms: number }> {
  const started = Date.now();
  try {
    await Promise.race([read(), new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 8000))]);
    return { ok: true, database: usingDatabase ? "ok" : "local", ms: Date.now() - started };
  } catch {
    return { ok: false, database: "down", ms: Date.now() - started };
  }
}
