import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Calendar, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useT } from '@/i18n/LanguageProvider';
import { useFormatDate } from '@/lib/useFormatters';
import { usePopoverPosition } from '@/lib/usePopoverPosition';
import type { TranslationKey } from '@/i18n/translations';

interface Props {
  /** ISO date string YYYY-MM-DD (or full ISO; we slice the date portion). Empty string means "no date". */
  value: string;
  /** Called with a YYYY-MM-DD string, or '' when cleared. */
  onChange: (next: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  /** Allow clearing. */
  clearable?: boolean;
  autoFocus?: boolean;
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}
function toISODate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function parseISODate(s: string): Date | null {
  if (!s) return null;
  const part = s.slice(0, 10);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(part);
  if (!m) return null;
  // Construct in local time at noon to dodge timezone edge cases.
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12);
}

/**
 * Themed popover date picker. Replaces native `<input type="date">` so the
 * calendar matches the app's dark/light palette (browser-native pickers
 * are styled by the OS and clash badly with the design).
 *
 * Layout:
 *  ┌────────────────────────┐
 *  │ ◀  Month YYYY        ▶ │
 *  │ Mo Tu We Th Fr Sa Su   │
 *  │  1  2  3  4  5  6  7   │
 *  │  ...                   │
 *  │ Today          Clear   │
 *  └────────────────────────┘
 */
export function DatePicker({
  value, onChange, placeholder, disabled, className, clearable = false, autoFocus,
}: Props) {
  const t = useT();
  const fmtDate = useFormatDate();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const { coords } = usePopoverPosition(triggerRef, open, {
    preferredWidth: 280,
    preferredHeight: 340,
  });

  const selected = useMemo(() => parseISODate(value), [value]);
  const [viewMonth, setViewMonth] = useState<Date>(() => {
    const base = parseISODate(value) ?? new Date();
    return new Date(base.getFullYear(), base.getMonth(), 1);
  });

  // Re-anchor the visible month when the bound value changes externally.
  useEffect(() => {
    const base = parseISODate(value);
    if (base) setViewMonth(new Date(base.getFullYear(), base.getMonth(), 1));
  }, [value]);

  // Close on outside click (anywhere outside trigger + portal popover).
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if (popoverRef.current?.contains(target)) return;
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  useEffect(() => {
    if (autoFocus) triggerRef.current?.focus();
  }, [autoFocus]);

  // Build the visible 6×7 grid (always 42 cells so the popover height
  // doesn't jitter month to month). Week starts on Monday.
  const cells = useMemo(() => {
    const first = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 1);
    // 0 = Sun..6 = Sat. We want Monday-first → shift.
    const dayOfWeek = (first.getDay() + 6) % 7;
    const gridStart = new Date(first);
    gridStart.setDate(first.getDate() - dayOfWeek);
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(gridStart);
      d.setDate(gridStart.getDate() + i);
      return d;
    });
  }, [viewMonth]);

  const today = useMemo(() => {
    const d = new Date(); d.setHours(0, 0, 0, 0); return d;
  }, []);

  const monthKey = `month.${viewMonth.getMonth() + 1}` as TranslationKey;
  const monthLabel = `${t(monthKey)} ${viewMonth.getFullYear()}`;

  function shiftMonth(delta: number) {
    setViewMonth(m => new Date(m.getFullYear(), m.getMonth() + delta, 1));
  }
  function pick(d: Date) {
    onChange(toISODate(d));
    setOpen(false);
  }
  function goToday() {
    const t0 = new Date();
    pick(t0);
  }
  function clear() {
    onChange('');
    setOpen(false);
  }

  function onTriggerKey(e: React.KeyboardEvent) {
    if (disabled) return;
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(o => !o);
    }
  }

  // Monday-first headers, taken from i18n dowShort. Order: Mon..Sun.
  const headers: Array<{ key: TranslationKey }> = [
    { key: 'dowShort.1' }, { key: 'dowShort.2' }, { key: 'dowShort.3' },
    { key: 'dowShort.4' }, { key: 'dowShort.5' }, { key: 'dowShort.6' },
    { key: 'dowShort.0' },
  ];

  return (
    <div className={cn('relative', className)}>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen(o => !o)}
        onKeyDown={onTriggerKey}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={cn(
          'input w-full flex items-center justify-between gap-2 text-left',
          disabled && 'opacity-60 cursor-not-allowed',
        )}
      >
        <span className={cn('flex items-center gap-2 min-w-0 truncate', !selected && 'text-fg-subtle')}>
          <Calendar className="w-4 h-4 text-fg-muted shrink-0" />
          <span className="truncate">
            {selected ? fmtDate(toISODate(selected)) : (placeholder ?? t('date.pickDate'))}
          </span>
        </span>
        {clearable && selected && !disabled ? (
          <button
            type="button"
            onClick={e => { e.stopPropagation(); clear(); }}
            className="text-fg-subtle hover:text-fg transition"
            aria-label={t('date.clear')}
          >
            <X className="w-3.5 h-3.5" />
          </button>
        ) : null}
      </button>

      {open && coords && createPortal(
        <div
          ref={popoverRef}
          role="dialog"
          style={{ position: 'fixed', top: coords.top, left: coords.left, width: 280 }}
          className="z-[100] rounded-xl border border-border bg-bg shadow-lg animate-scaleIn p-3"
        >
          {/* header */}
          <div className="flex items-center justify-between mb-2">
            <button
              type="button"
              onClick={() => shiftMonth(-1)}
              className="w-7 h-7 rounded-md hover:bg-surface flex items-center justify-center text-fg-muted hover:text-fg transition"
              aria-label="prev month"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="text-sm font-semibold tracking-tight">{monthLabel}</div>
            <button
              type="button"
              onClick={() => shiftMonth(1)}
              className="w-7 h-7 rounded-md hover:bg-surface flex items-center justify-center text-fg-muted hover:text-fg transition"
              aria-label="next month"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* day-of-week headers */}
          <div className="grid grid-cols-7 mb-1">
            {headers.map(h => (
              <div
                key={h.key}
                className="text-[10px] font-medium uppercase tracking-wider text-fg-subtle text-center py-1"
              >
                {t(h.key)}
              </div>
            ))}
          </div>

          {/* day grid */}
          <div className="grid grid-cols-7 gap-0.5">
            {cells.map((d, i) => {
              const inMonth = d.getMonth() === viewMonth.getMonth();
              const isSelected = !!selected && d.getTime() === selected.setHours(0, 0, 0, 0);
              const isToday = d.getTime() === today.getTime();
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => pick(d)}
                  className={cn(
                    'h-8 rounded-md text-xs font-medium tnum flex items-center justify-center transition',
                    !inMonth && 'text-fg-subtle',
                    inMonth && !isSelected && 'text-fg hover:bg-surface',
                    isToday && !isSelected && 'ring-1 ring-inset ring-border-strong',
                    isSelected && 'bg-fg text-bg',
                  )}
                >
                  {d.getDate()}
                </button>
              );
            })}
          </div>

          {/* footer */}
          <div className="mt-2 pt-2 border-t border-border flex items-center justify-between text-xs">
            <button
              type="button"
              onClick={goToday}
              className="px-2 py-1 rounded-md text-fg-muted hover:text-fg hover:bg-surface transition"
            >
              {t('date.today')}
            </button>
            {clearable && (
              <button
                type="button"
                onClick={clear}
                className="px-2 py-1 rounded-md text-fg-muted hover:text-fg hover:bg-surface transition"
              >
                {t('date.clear')}
              </button>
            )}
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
