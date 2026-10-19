/**
 * Dashboard roles. "admin": everything. "callcenter": follows the website orders only
 * (home with order counts, orders, customers, new-order alert); no products, prices, offers, reports or settings.
 */
export type Role = "admin" | "callcenter";

export const ROLE_LABELS: Record<Role, string> = { admin: "مدير", callcenter: "خدمة العملاء" };
