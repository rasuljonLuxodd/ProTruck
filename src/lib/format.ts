export function formatUZS(value: number | undefined | null): string {
  const n = Number(value ?? 0);
  if (!isFinite(n)) return 'UZS 0';
  const sign = n < 0 ? '−' : '';
  // non-breaking thin spaces between thousands so big numbers don't wrap
  const absStr = Math.abs(Math.round(n))
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return `${sign}UZS ${absStr}`;
}

export function formatNumber(value: number | undefined | null): string {
  const n = Number(value ?? 0);
  if (!isFinite(n)) return '0';
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

export function formatDate(iso: string | undefined | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function toInputDate(iso: string | undefined | null): string {
  return formatDate(iso) || formatDate(new Date().toISOString());
}

export function fromInputDate(value: string): string {
  if (!value) return new Date().toISOString();
  return new Date(`${value}T12:00:00`).toISOString();
}

export function daysBetween(fromISO: string, toISO: string = new Date().toISOString()): number {
  const a = new Date(fromISO).getTime();
  const b = new Date(toISO).getTime();
  return Math.max(0, Math.floor((b - a) / (1000 * 60 * 60 * 24)));
}

export function percentChange(current: number, previous: number): number {
  if (previous === 0) {
    if (current === 0) return 0;
    return 100;
  }
  return ((current - previous) / Math.abs(previous)) * 100;
}

export function formatPercent(value: number): string {
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(1)}%`;
}
