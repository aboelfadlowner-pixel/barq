/**
 * Normalizes Arabic text for search, same rules as v29 `norm`:
 * lowercases, removes diacritics and tatweel, and unifies alef / yaa / taa marbuta forms.
 */
export function normalizeArabic(value: string): string {
  return String(value)
    .toLowerCase()
    .replace(/[ً-ٟـ]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .trim();
}
