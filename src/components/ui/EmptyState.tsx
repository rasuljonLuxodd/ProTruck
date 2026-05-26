import type { LucideIcon } from 'lucide-react';
import { Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  icon?: LucideIcon;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
  /**
   * Optional secondary slot (e.g. "Import CSV" link, learn-more link).
   */
  secondary?: React.ReactNode;
}

/**
 * Onboarding card shown when a page has zero rows. Replaces the gray
 * "Ma'lumot yo'q" text with a friendlier first-time experience.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  className,
  secondary,
}: Props) {
  return (
    <div
      className={cn(
        'card flex flex-col items-center text-center px-6 py-12',
        className,
      )}
    >
      {Icon ? (
        <div className="w-12 h-12 rounded-full bg-surface-2 border border-border flex items-center justify-center mb-4">
          <Icon className="w-5 h-5 text-fg-muted" />
        </div>
      ) : null}
      <h3 className="text-base font-semibold tracking-tight">{title}</h3>
      {description ? (
        <p className="mt-1.5 text-sm text-fg-muted max-w-sm">{description}</p>
      ) : null}
      {onAction && actionLabel ? (
        <button onClick={onAction} className="btn-primary mt-5">
          <Plus className="w-3.5 h-3.5" />
          {actionLabel}
        </button>
      ) : null}
      {secondary ? <div className="mt-3">{secondary}</div> : null}
    </div>
  );
}
