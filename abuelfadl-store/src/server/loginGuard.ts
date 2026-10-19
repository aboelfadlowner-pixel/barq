import { ApiError } from "./errors";

/**
 * Locks dashboard login for a while after too many wrong passwords from the same address, so a password cannot be
 * guessed by trying many. Counts live in memory (per server instance) until there is a database; a restart clears them.
 */
const MAX_FAILURES = 5;
const WINDOW_MS = 15 * 60 * 1000;
const LOCK_MS = 15 * 60 * 1000;

interface Attempts {
  failures: number;
  /** When the first failure of the current window happened. */
  since: number;
  lockedUntil: number;
}

const globalState = globalThis as typeof globalThis & { __afLoginAttempts?: Map<string, Attempts> };
const attempts = (globalState.__afLoginAttempts ??= new Map());

/** The caller's address as the proxy reports it (Vercel sets x-forwarded-for), else one shared bucket. */
export function clientKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || request.headers.get("x-real-ip") || "local";
}

const minutesLeft = (until: number, now: number) => Math.max(1, Math.ceil((until - now) / 60000));

/** Throws 429 while this address is locked. */
export function assertNotLocked(key: string, now = Date.now()): void {
  const entry = attempts.get(key);
  if (entry && entry.lockedUntil > now) {
    throw new ApiError(429, `محاولات دخول خاطئة كثيرة. حاول مرة أخرى بعد ${minutesLeft(entry.lockedUntil, now)} دقيقة`);
  }
}

/** Records a wrong password and returns the message to show (with the attempts left, or the lock). */
export function recordFailure(key: string, now = Date.now()): string {
  let entry = attempts.get(key);
  if (!entry || now - entry.since > WINDOW_MS || (entry.lockedUntil && entry.lockedUntil <= now)) {
    entry = { failures: 0, since: now, lockedUntil: 0 };
  }
  entry.failures += 1;
  if (entry.failures >= MAX_FAILURES) entry.lockedUntil = now + LOCK_MS;
  attempts.set(key, entry);
  prune(now);
  if (entry.lockedUntil) return `محاولات دخول خاطئة كثيرة. حاول مرة أخرى بعد ${minutesLeft(entry.lockedUntil, now)} دقيقة`;
  const left = MAX_FAILURES - entry.failures;
  return left <= 2 ? `كلمة المرور غير صحيحة. متبقٍّ ${left === 1 ? "محاولة واحدة" : "محاولتان"} قبل إيقاف الدخول مؤقتًا` : "كلمة المرور غير صحيحة";
}

/** A correct password clears the address's count. */
export function recordSuccess(key: string): void {
  attempts.delete(key);
}

/** Drops stale entries so the map cannot grow without bound. */
function prune(now: number): void {
  if (attempts.size < 1000) return;
  for (const [key, entry] of attempts) {
    if (entry.lockedUntil <= now && now - entry.since > WINDOW_MS) attempts.delete(key);
  }
}
