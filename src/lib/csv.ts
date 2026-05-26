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

/**
 * Minimal CSV parser (handles quoted fields). Strips a leading BOM. Treats
 * the first line as header. Returns rows as objects keyed by header.
 */
export function parseCsv(text: string): Array<Record<string, string>> {
  // Strip BOM
  if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);

  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else {
        field += ch;
      }
    } else {
      if (ch === '"') { inQuotes = true; }
      else if (ch === ',') { row.push(field); field = ''; }
      else if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && text[i + 1] === '\n') i++;
        row.push(field); field = '';
        if (row.length > 1 || row[0] !== '') rows.push(row);
        row = [];
      } else {
        field += ch;
      }
    }
  }
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }

  const [header, ...body] = rows;
  if (!header) return [];
  return body
    .filter(r => r.some(cell => cell.length > 0))
    .map(r => {
      const obj: Record<string, string> = {};
      header.forEach((h, i) => { obj[h.trim()] = (r[i] ?? '').trim(); });
      return obj;
    });
}
