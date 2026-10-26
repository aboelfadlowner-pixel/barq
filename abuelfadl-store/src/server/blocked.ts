import type { BlockedPhone } from "../types/order";
import { mutate, read } from "./db";
import { ApiError, assertValid } from "./errors";
import { cleanPhone, isMobile } from "./orders";

/**
 * Numbers blocked from ordering on the website (fake orders, repeated refusals). Only the manager blocks or unblocks;
 * the call center sees the list (a "رقم محظور" badge on orders and customers). Old orders of a blocked number stay.
 * The check itself is in `createOrder`.
 */

/** Blocked numbers, newest first. */
export async function listBlocked(): Promise<BlockedPhone[]> {
  return [...((await read()).blockedPhones ?? [])].reverse();
}

export function blockPhone(input: { phone?: unknown; reason?: unknown }): Promise<BlockedPhone> {
  return mutate((data) => {
    const phone = cleanPhone(String(input.phone ?? ""));
    if (!isMobile(phone)) assertValid({ phone: "رقم موبايل غير صحيح" });
    const blocked = (data.blockedPhones ??= []);
    const existing = blocked.find((entry) => entry.phone === phone);
    if (existing) return existing;
    const entry: BlockedPhone = {
      phone,
      reason: String(input.reason ?? "")
        .trim()
        .slice(0, 200),
      blockedAt: new Date().toISOString(),
    };
    blocked.push(entry);
    return entry;
  });
}

export function unblockPhone(value: unknown): Promise<{ phone: string }> {
  return mutate((data) => {
    const phone = cleanPhone(String(value ?? ""));
    const blocked = data.blockedPhones ?? [];
    if (!blocked.some((entry) => entry.phone === phone)) throw new ApiError(404, "هذا الرقم غير محظور");
    data.blockedPhones = blocked.filter((entry) => entry.phone !== phone);
    return { phone };
  });
}
