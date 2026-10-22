import { getLoginAttempts, setLoginAttempts } from "./db";
import { ApiError } from "./errors";

/**
 * Caps how many requests one address can make in a window (public order form). Counts share the login guard's store
 * (store.login_fails, or memory) under their own key prefix. The cap is generous: mobile networks put many customers
 * behind one address, so it only stops floods.
 */
export async function assertWithinLimit(key: string, max: number, windowMs: number, message: string, now = Date.now()): Promise<void> {
  let entry = await getLoginAttempts(key);
  if (!entry || now - entry.since > windowMs) entry = { failures: 0, since: now, lockedUntil: 0 };
  if (entry.failures >= max) throw new ApiError(429, message);
  entry.failures += 1;
  entry.lockedUntil = entry.since + windowMs; // lets the database store clean the row up after the window
  await setLoginAttempts(key, entry);
}
