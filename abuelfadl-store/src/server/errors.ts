/** An error with an HTTP status and an Arabic message that is safe to show in the UI. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    /** Per-field messages for forms, e.g. { price: "السعر لازم يكون أكبر من صفر" }. */
    readonly fields?: Record<string, string>,
  ) {
    super(message);
  }
}

export const notFound = (what: string) => new ApiError(404, `${what} غير موجود`);

/** Throws a 400 ApiError listing every field error, when there is at least one. */
export function assertValid(fields: Record<string, string>) {
  if (Object.keys(fields).length) throw new ApiError(400, "راجع البيانات المكتوبة", fields);
}
