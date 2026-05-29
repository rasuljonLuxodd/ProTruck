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

/**
 * Display money in any supported currency. UZS uses the existing whole-unit
 * style; USD/EUR/RUB use Intl.NumberFormat with two decimals.
 */
export function formatMoney(
  value: number | undefined | null,
  currency: 'UZS' | 'USD' | 'RUB' | 'EUR' = 'UZS',
): string {
  if (currency === 'UZS') return formatUZS(value);
  const n = Number(value ?? 0);
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(isFinite(n) ? n : 0);
  } catch {
    return `${currency} ${n.toFixed(2)}`;
  }
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

/**
 * Locale-aware date formatter: "27 May 2026", "May 27, 2026", "27 мая 2026".
 *
 * We don't use Intl.DateTimeFormat for Uzbek because the bundled CLDR
 * locale produces output like "2026 M05 27" (the literal letter "M"
 * before the month number) which reads as a software bug to most users.
 * Hardcoded month-name tables give predictable, readable output across
 * all three languages without depending on a particular runtime's CLDR
 * version.
 */
const MONTHS_UZ = [
  'yan', 'fev', 'mar', 'apr', 'may', 'iyn',
  'iyl', 'avg', 'sen', 'okt', 'noy', 'dek',
];
const MONTHS_EN = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];
const MONTHS_RU = [
  'янв', 'фев', 'мар', 'апр', 'мая', 'июн',
  'июл', 'авг', 'сен', 'окт', 'ноя', 'дек',
];

export function formatDateLocale(
  iso: string | undefined | null,
  lang: 'uz' | 'en' | 'ru' = 'en',
): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const day = d.getDate();
  const monthIdx = d.getMonth();
  const year = d.getFullYear();
  if (lang === 'en') {
    // "May 27, 2026" — standard US/EN format
    return `${MONTHS_EN[monthIdx]} ${day}, ${year}`;
  }
  // UZ & RU both use day-month-year ordering
  const months = lang === 'ru' ? MONTHS_RU : MONTHS_UZ;
  return `${day} ${months[monthIdx]} ${year}`;
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
