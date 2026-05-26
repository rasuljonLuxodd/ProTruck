import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type Tone = 'fg' | 'mute' | 'positive' | 'negative' | 'warning';

const styles: Record<Tone, string> = {
  fg:       'bg-fg text-bg',
  mute:     'bg-surface-2 text-fg-muted border border-border',
  positive: 'bg-positive/10 text-positive border border-positive/20',
  negative: 'bg-negative/10 text-negative border border-negative/20',
  warning:  'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20',
};

export function Badge({
  tone = 'mute',
  children,
  className,
}: {
  tone?: Tone;
  children: ReactNode;
  className?: string;
}) {
  return <span className={cn('badge', styles[tone], className)}>{children}</span>;
}
