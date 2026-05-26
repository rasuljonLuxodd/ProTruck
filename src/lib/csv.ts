/**
 * Tiny CSV helper. RFC 4180-ish: quotes fields containing comma/quote/newline.
 * Adds a UTF-8 BOM so Excel opens it with proper encoding for Cyrillic and
 * Uzbek Latin characters.
 */
function escapeCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function buildCsv<T>(
  rows: T[],
  columns: Array<{ key: keyof T; header: string; render?: (row: T) => string }>,
): string {
  const header = columns.map(c => escapeCell(c.header)).join(',');
  const body = rows
    .map(r =>
      columns
        .map(c => escapeCell(c.render ? c.render(r) : (r as Record<keyof T, unknown>)[c.key]))
        .join(','),
    )
    .join('\n');
  return `﻿${header}\n${body}`;
}

export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
