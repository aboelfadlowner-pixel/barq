"use client";

/** Error from the admin API: `message` is the server's Arabic message, `fields` the per-field form errors. */
export class AdminApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly fields: Record<string, string> = {},
  ) {
    super(message);
  }
}

/**
 * Calls the backend API from the dashboard. Sends/receives JSON and throws AdminApiError on failure.
 * A 401 (session expired) sends the user back to the login page.
 */
export async function api<T>(path: string, options: { method?: string; body?: unknown } = {}): Promise<T> {
  const response = await fetch(path, {
    method: options.method ?? "GET",
    headers: options.body === undefined ? undefined : { "Content-Type": "application/json" },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    cache: "no-store",
  });
  const data = await response.json().catch(() => ({}));
  if (response.status === 401 && !path.endsWith("/login")) {
    window.location.href = `/admin/login?next=${encodeURIComponent(window.location.pathname)}`;
  }
  if (!response.ok) throw new AdminApiError(data.error || "حدث خطأ، حاول مرة أخرى", response.status, data.fields);
  return data as T;
}

/** "1,250.5 ج.م" */
export const egp = (amount: number) => `${amount.toLocaleString("en-US", { maximumFractionDigits: 2 })} ج.م`;

/** Date and time in Cairo, e.g. "17/10 · 3:45 م". */
export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("ar-EG-u-nu-latn", {
    timeZone: "Africa/Cairo",
    day: "numeric",
    month: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** Quantity with its unit: "2" pieces or "0.75 كجم". */
export const formatQty = (quantity: number, weighed: boolean) => (weighed ? `${quantity} كجم` : `${quantity}`);

/** Uploads an image file (already resized by `ImagePicker`) and returns its public URL. */
export async function uploadImage(file: Blob): Promise<string> {
  const response = await fetch("/api/admin/uploads", { method: "POST", headers: { "Content-Type": file.type }, body: file });
  const data = await response.json().catch(() => ({}));
  if (response.status === 401) window.location.href = `/admin/login?next=${encodeURIComponent(window.location.pathname)}`;
  if (!response.ok || !data.url) throw new AdminApiError(data.error || "تعذّر رفع الصورة، حاول مرة أخرى", response.status);
  return data.url as string;
}
