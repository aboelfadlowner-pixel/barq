"use client";

/**
 * Saves rows as a CSV file that Excel opens directly (UTF-8 with BOM so Arabic shows correctly).
 * Every cell is quoted, so commas and new lines inside names and addresses are kept.
 */
export function downloadCsv(fileName: string, rows: (string | number)[][]) {
  const text = rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob(["﻿" + text], { type: "text/csv;charset=utf-8" }));
  const link = Object.assign(document.createElement("a"), { href: url, download: fileName });
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
