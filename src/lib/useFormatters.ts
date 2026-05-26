import { useCallback } from 'react';
import { useLanguage } from '@/i18n/LanguageProvider';
import { formatDateLocale } from './format';

/**
 * Returns a locale-aware date formatter bound to the current language.
 * UZ shows "26-may, 2026", EN "May 26, 2026", RU "26 мая 2026".
 *
 * Components prefer this over the raw ISO `formatDate` for any date that's
 * shown directly to the user. `formatDate` (YYYY-MM-DD) is still appropriate
 * for sort keys, CSV exports, and tabular alignment.
 */
export function useFormatDate(): (iso: string | undefined | null) => string {
  const { lang } = useLanguage();
  return useCallback((iso) => formatDateLocale(iso, lang), [lang]);
}
