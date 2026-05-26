import type { TranslationKey } from '@/i18n/translations';

/** Returns the i18n key for the right greeting given the local hour. */
export function greetingKey(date: Date = new Date()): TranslationKey {
  const h = date.getHours();
  if (h >= 5  && h < 12) return 'greet.morning';
  if (h >= 12 && h < 18) return 'greet.afternoon';
  if (h >= 18 && h < 22) return 'greet.evening';
  return 'greet.night';
}

export function dayOfWeekKey(date: Date = new Date()): TranslationKey {
  // .getDay() → 0 Sun..6 Sat — matches our 'dow.0'..'dow.6' keys.
  return `dow.${date.getDay()}` as TranslationKey;
}

/**
 * Relative-time helper: "Just now" / "12 min ago" / "3 h ago" / formatted date.
 * Returns a tuple [translationKey, replacements] or [null, formattedDate]
 * if the timestamp is older than 12 hours.
 */
export function relativeTime(iso: string, now: Date = new Date()): {
  key: TranslationKey | null;
  n?: number;
  fallback?: string;
} {
  const t = new Date(iso).getTime();
  const diffMs = now.getTime() - t;
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1)   return { key: 'dash.justNow' };
  if (minutes < 60)  return { key: 'dash.minAgo', n: minutes };
  const hours = Math.floor(minutes / 60);
  if (hours < 12)    return { key: 'dash.hoursAgo', n: hours };
  return { key: null };
}
