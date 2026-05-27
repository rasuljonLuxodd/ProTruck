import { formatUZS, formatDate } from '@/lib/format';
import type { Language } from '@/types';

/**
 * Normalize a customer phone number to E.164-ish digits suitable for the
 * `wa.me/<phone>` deep link (which wants digits only, no `+`).
 *
 * Heuristics for Uzbekistan:
 *   - If we get 12 digits starting with `998`, assume that's the full
 *     international number and use it as-is
 *   - If we get 9 digits starting with `9` (the local mobile format),
 *     prepend `998`
 *   - Otherwise return whatever we have — could be a foreign number,
 *     wa.me will error if it's bad
 *
 * Returns `null` if the input has no digits at all.
 */
export function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, '');
  if (!digits) return null;
  if (digits.length === 12 && digits.startsWith('998')) return digits;
  if (digits.length === 9 && digits.startsWith('9')) return `998${digits}`;
  // Many users will save numbers with leading 0 in their head — strip a
  // leading 0 if what's left looks UZ-shaped
  if (digits.length === 10 && digits.startsWith('0')) {
    const rest = digits.slice(1);
    if (rest.startsWith('9')) return `998${rest}`;
  }
  return digits;
}

interface ReminderOpts {
  customerName: string;
  amount: number;
  dueDate?: string;
  lang: Language;
}

/**
 * Build the templated reminder message. Keeps it friendly — collection
 * messages in Uzbekistan tend to be polite ("hurmatli") rather than
 * aggressive, and that tone reads better in WhatsApp than a robotic
 * dunning letter.
 */
export function buildReminderText({ customerName, amount, dueDate, lang }: ReminderOpts): string {
  const amountStr = formatUZS(amount).replace(/ /g, ' ').replace(/ /g, ' ');
  const dueStr = dueDate ? formatDate(dueDate) : '';

  if (lang === 'ru') {
    return [
      `Здравствуйте, ${customerName}!`,
      `У вас остаток задолженности ${amountStr}.`,
      dueStr ? `Срок оплаты: ${dueStr}.` : '',
      'Пожалуйста, оплатите при первой возможности.',
      'Спасибо!',
    ].filter(Boolean).join('\n');
  }
  if (lang === 'en') {
    return [
      `Hello ${customerName},`,
      `You have an outstanding balance of ${amountStr}.`,
      dueStr ? `Due date: ${dueStr}.` : '',
      'Please settle when convenient.',
      'Thank you!',
    ].filter(Boolean).join('\n');
  }
  // default: uz
  return [
    `Hurmatli ${customerName},`,
    `Sizda ${amountStr} miqdorida qarz mavjud.`,
    dueStr ? `Muddat: ${dueStr}.` : '',
    "Iltimos, imkon boricha to'lab bering.",
    'Rahmat!',
  ].filter(Boolean).join('\n');
}

/**
 * Build the wa.me URL. Returns null when the phone can't be normalized —
 * caller should disable the button or fall back to SMS.
 */
export function waMeUrl(phone: string, text: string): string | null {
  const normalized = normalizePhone(phone);
  if (!normalized) return null;
  return `https://wa.me/${normalized}?text=${encodeURIComponent(text)}`;
}

/**
 * Build an `sms:` URL for fallback when WhatsApp isn't an option. Some
 * native dialers support `?body=`, others ignore it but still open with
 * the recipient. Returns null if the phone can't be normalized.
 */
export function smsUrl(phone: string, text: string): string | null {
  const normalized = normalizePhone(phone);
  if (!normalized) return null;
  // sms: scheme: use leading + so iOS/Android know it's international
  return `sms:+${normalized}?body=${encodeURIComponent(text)}`;
}

export type DueStatus = 'overdue' | 'dueToday' | 'dueSoon' | 'noDue' | 'upcoming';

/**
 * Classify the due-date status. "dueSoon" is within 3 days.
 */
export function dueStatus(dueDate: string | undefined, now: Date = new Date()): DueStatus {
  if (!dueDate) return 'noDue';
  const t0 = new Date(dueDate);
  if (isNaN(t0.getTime())) return 'noDue';
  t0.setHours(0, 0, 0, 0);
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((t0.getTime() - today.getTime()) / 86_400_000);
  if (diff < 0)  return 'overdue';
  if (diff === 0) return 'dueToday';
  if (diff <= 3) return 'dueSoon';
  return 'upcoming';
}
