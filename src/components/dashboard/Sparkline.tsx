import { useMemo } from 'react';

interface Props {
  values: number[];
  /** SVG width in CSS pixels. Height is fixed per `size`. */
  width?: number;
  /** Small (24px), medium (40px), large (64px). */
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  /** Stroke color, defaults to currentColor. */
  stroke?: string;
  /** Show a soft gradient fill under the line. */
  filled?: boolean;
}

/**
 * Tiny SVG sparkline — no recharts overhead per cell. Renders a polyline
 * with optional gradient area. Used in the welcome hero metric and could
 * be reused inline anywhere a single-line trend is helpful.
 */
export function Sparkline({
  values, width = 120, size = 'md', className, stroke = 'currentColor', filled = true,
}: Props) {
  const height = size === 'sm' ? 24 : size === 'lg' ? 64 : 40;

  const path = useMemo(() => {
    if (values.length < 2) return { line: '', area: '' };
    const min = Math.min(...values);
    const max = Math.max(...values);
    const span = max - min || 1;
    const stepX = width / (values.length - 1);
    const points = values.map((v, i) => {
      const x = i * stepX;
      const y = height - ((v - min) / span) * (height - 4) - 2; // 2px padding
      return [x, y] as const;
    });
    const line = points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
    const area = `${line} L ${width} ${height} L 0 ${height} Z`;
    return { line, area };
  }, [values, width, height]);

  if (values.length < 2) {
    return (
      <svg width={width} height={height} className={className} aria-hidden>
        <line x1={0} y1={height / 2} x2={width} y2={height / 2}
              stroke={stroke} strokeWidth={1} strokeDasharray="3 3" opacity={0.25} />
      </svg>
    );
  }

  const gradId = `spark-${Math.random().toString(36).slice(2, 8)}`;
  return (
    <svg width={width} height={height} className={className} aria-hidden>
      {filled && (
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor={stroke} stopOpacity={0.25} />
            <stop offset="100%" stopColor={stroke} stopOpacity={0} />
          </linearGradient>
        </defs>
      )}
      {filled && <path d={path.area} fill={`url(#${gradId})`} />}
      <path d={path.line} fill="none" stroke={stroke} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
