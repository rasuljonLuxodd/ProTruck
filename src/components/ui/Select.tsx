import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePopoverPosition } from '@/lib/usePopoverPosition';

export interface SelectOption<T extends string = string> {
  value: T;
  label: string;
  /** Optional small text under the label (e.g. stock count). */
  hint?: string;
  /** Optional leading visual (color dot, icon). */
  leading?: ReactNode;
}

interface Props<T extends string> {
  value: T;
  onChange: (next: T) => void;
  options: SelectOption<T>[];
  /** Shown when the value doesn't match any option. */
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  /** Visible label inside the trigger when no value (default "—"). */
  emptyLabel?: string;
}

/**
 * Themed dropdown that replaces the native <select>. The native widget's
 * popup is rendered by the OS / browser and can't be styled, which broke
 * the app's dark theme. This builds the popup ourselves so it matches.
 *
 * Keyboard:
 *   - Space / Enter to open
 *   - Arrow Up / Down navigate
 *   - Enter to select
 *   - Escape to close
 *
 * Closes on outside click and option click.
 */
export function Select<T extends string>({
  value, onChange, options, placeholder, disabled, className, emptyLabel = '—',
}: Props<T>) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const current = options.find(o => o.value === value);
  const { coords, width } = usePopoverPosition(triggerRef, open, {
    preferredWidth: 240,
    preferredHeight: Math.min(280, Math.max(80, options.length * 36 + 16)),
    matchTriggerWidth: true,
  });

  // Reset active highlight to the current selection each time we open.
  useEffect(() => {
    if (!open) return;
    const idx = Math.max(0, options.findIndex(o => o.value === value));
    setActive(idx);
    // scroll the active option into view
    requestAnimationFrame(() => {
      listRef.current?.children[idx]?.scrollIntoView({ block: 'nearest' });
    });
  }, [open, options, value]);

  // Close on outside click (anywhere outside trigger + portaled popover).
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if (listRef.current?.contains(target)) return;
      setOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  function pick(next: T) {
    onChange(next);
    setOpen(false);
  }

  function onKey(e: React.KeyboardEvent) {
    if (disabled) return;
    if (!open && (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown')) {
      e.preventDefault();
      setOpen(true);
      return;
    }
    if (!open) return;
    if (e.key === 'Escape') { setOpen(false); return; }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive(a => Math.min(options.length - 1, a + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive(a => Math.max(0, a - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const opt = options[active];
      if (opt) pick(opt.value);
    }
  }

  return (
    <div className={cn('relative', className)}>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen(o => !o)}
        onKeyDown={onKey}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={cn(
          'input w-full flex items-center justify-between gap-2 text-left',
          disabled && 'opacity-60 cursor-not-allowed',
        )}
      >
        <span className={cn('flex items-center gap-2 min-w-0 truncate', !current && 'text-fg-subtle')}>
          {current?.leading}
          <span className="truncate">
            {current ? current.label : (placeholder ?? emptyLabel)}
          </span>
          {current?.hint && (
            <span className="text-fg-subtle text-xs">{current.hint}</span>
          )}
        </span>
        <ChevronDown
          className={cn(
            'w-4 h-4 text-fg-muted shrink-0 transition-transform',
            open && 'rotate-180',
          )}
        />
      </button>

      {open && coords && createPortal(
        <ul
          ref={listRef}
          role="listbox"
          style={{ position: 'fixed', top: coords.top, left: coords.left, width }}
          className="z-[100] max-h-64 overflow-y-auto rounded-lg border border-border bg-bg shadow-lg animate-scaleIn py-1"
        >
          {options.length === 0 ? (
            <li className="px-3 py-2 text-sm text-fg-subtle text-center">—</li>
          ) : (
            options.map((o, i) => {
              const selected = o.value === value;
              const highlighted = i === active;
              return (
                <li
                  key={String(o.value)}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => pick(o.value)}
                  className={cn(
                    'flex items-center gap-2 px-3 py-2 text-sm cursor-pointer transition',
                    highlighted && 'bg-surface',
                  )}
                >
                  {o.leading}
                  <span className="flex-1 min-w-0 truncate">{o.label}</span>
                  {o.hint && (
                    <span className="text-fg-subtle text-xs tnum">{o.hint}</span>
                  )}
                  {selected && <Check className="w-3.5 h-3.5 text-fg-muted shrink-0" />}
                </li>
              );
            })
          )}
        </ul>,
        document.body,
      )}
    </div>
  );
}
