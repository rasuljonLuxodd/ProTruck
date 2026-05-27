import { formatUZS } from '@/lib/format';

interface TooltipPayloadItem {
  name: string;
  value: number;
  color: string;
  dataKey: string;
}

interface Props {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: string;
  /**
   * If provided, format the values as money. Otherwise renders the raw
   * number (used for production / quantity series).
   */
  asMoney?: boolean;
}

/**
 * Themed Recharts tooltip — replaces the default white-bordered rectangle
 * with a card that matches the app's surface system. Uses tabular numerals
 * so columns of numbers line up and feels like a real data product, not
 * a chart out of the box.
 */
export function ChartTooltip({ active, payload, label, asMoney = false }: Props) {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div
      className="rounded-lg border border-border-strong bg-bg shadow-lg px-3 py-2 min-w-[140px]"
      style={{ pointerEvents: 'none' }}
    >
      {label && (
        <div className="text-[10px] font-medium uppercase tracking-wider text-fg-subtle mb-1.5">
          {label}
        </div>
      )}
      <div className="space-y-1">
        {payload.map(p => (
          <div key={p.dataKey} className="flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-1.5 min-w-0">
              <span
                aria-hidden
                className="w-1.5 h-1.5 rounded-full shrink-0"
                style={{ background: p.color }}
              />
              <span className="text-fg-muted truncate">{p.name}</span>
            </div>
            <span className="font-semibold tnum text-fg">
              {asMoney ? formatUZS(p.value) : new Intl.NumberFormat('en-US').format(p.value)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
