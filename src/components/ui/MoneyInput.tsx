import { useEffect, useState, type ChangeEvent, type InputHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

interface Props extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'value' | 'onChange'> {
  /** Numeric value (state of truth). */
  value: number;
  /** Called with the parsed number on every keystroke. */
  onChange: (n: number) => void;
  /** Minimum allowed. Defaults to 0. */
  min?: number;
  /** Maximum allowed. */
  max?: number;
}

// Narrow no-break space — matches the rest of the app's number formatting
// and prevents the display from wrapping mid-number.
const NNBSP = ' ';

function format(n: number): string {
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, NNBSP);
}

function parse(text: string): number {
  // Strip everything that isn't a digit; treat empty as 0.
  const digits = text.replace(/\D/g, '');
  if (digits === '') return 0;
  return Number(digits);
}

/**
 * Numeric input with live thin-space thousands grouping (5000 → "5 000").
 *
 * Two reasons this exists rather than `<input type="number">`:
 *
 * 1. **Clearing works.** Native controlled number inputs with `value={0}`
 *    refuse to go empty — you can't backspace the last "0". This component
 *    holds its own text buffer, so an empty string is allowed in display
 *    even while the bound numeric value is 0.
 *
 * 2. **Live formatting.** Lets the cashier see "1 250 000" instead of
 *    "1250000" while they type a price.
 *
 * The external API is still `{ value: number, onChange: (n: number) => void }`,
 * so call sites change minimally.
 */
export function MoneyInput({ value, onChange, min = 0, max, className, ...rest }: Props) {
  // Local text buffer: lets the field be visually empty even when value === 0.
  const [text, setText] = useState<string>(value > 0 ? format(value) : '');

  // Re-sync if the parent resets the value (e.g., after a save). Don't fire
  // if our current text already parses to the same number — avoids fighting
  // the user while they type.
  useEffect(() => {
    if (parse(text) === value) return;
    setText(value > 0 ? format(value) : '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value;
    if (raw === '') {
      setText('');
      onChange(0);
      return;
    }
    let n = parse(raw);
    if (max !== undefined && n > max) n = max;
    if (n < min) n = min;
    setText(format(n));
    onChange(n);
  }

  return (
    <input
      type="text"
      inputMode="numeric"
      autoComplete="off"
      value={text}
      onChange={handleChange}
      className={cn('input tnum', className)}
      {...rest}
    />
  );
}
