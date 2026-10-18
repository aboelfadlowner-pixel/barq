/** Foodics SKU format: "sk-" followed by digits, e.g. "sk-16671". */
export const SKU_PATTERN = /^sk-\d+$/;

/** Cleans what was typed or read from a sheet: trims, removes spaces, lowercases ("SK-0272 " -> "sk-0272"). */
export const normalizeSku = (value: unknown): string =>
  String(value ?? "")
    .replace(/\s+/g, "")
    .toLowerCase();

export const isValidSku = (value: string): boolean => SKU_PATTERN.test(value);
