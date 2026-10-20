import { getLoginAttempts, setLoginAttempts } from "./db";
import { ApiError } from "./errors";

/**
 * Locks dashboard login for a while after too many wrong passwords from the same address, so a password cannot be
 * guessed by trying many. Counts are kept by the data store (the database table store.login_fails, or memory).
 */
const MAX_FAILURES = 5;
const WINDOW_MS = 15 * 60 * 1000;
const LOCK_MS = 15 * 60 * 1000;

/** The caller's address as the proxy reports it (Vercel sets x-forwarded-for), else one shared bucket. */
export function clientKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || request.headers.get("x-real-ip") || "local";
}

const minutesLeft = (until: number, now: number) => Math.max(1, Math.ceil((until - now) / 60000));
const lockedMessage = (until: number, now: number) => `محاولات دخول خاطئة كثيرة. حاول مرة أخرى بعد ${minutesLeft(until, now)} دقيقة`;

/** Throws 429 while this address is locked. */
export async function assertNotLocked(key: string, now = Date.now()): Promise<void> {
  const entry = await getLoginAttempts(key);
  if (entry && entry.lockedUntil > now) throw new ApiError(429, lockedMessage(entry.lockedUntil, now));
}

/** Records a wrong password and returns the message to show (with the attempts left, or the lock). */
export async function recordFailure(key: string, now = Date.now()): Promise<string> {
  let entry = await getLoginAttempts(key);
  if (!entry || now - entry.since > WINDOW_MS || (entry.lockedUntil && entry.lockedUntil <= now)) {
    entry = { failures: 0, since: now, lockedUntil: 0 };
  }
  entry.failures += 1;
  if (entry.failures >= MAX_FAILURES) entry.lockedUntil = now + LOCK_MS;
  await setLoginAttempts(key, entry);
  if (entry.lockedUntil) return lockedMessage(entry.lockedUntil, now);
  const left = MAX_FAILURES - entry.failures;
  return left <= 2 ? `كلمة المرور غير صحيحة. متبقٍّ ${left === 1 ? "محاولة واحدة" : "محاولتان"} قبل إيقاف الدخول مؤقتًا` : "كلمة المرور غير صحيحة";
}

/** A correct password clears the address's count. */
export async function recordSuccess(key: string): Promise<void> {
  await setLoginAttempts(key, null);
}
