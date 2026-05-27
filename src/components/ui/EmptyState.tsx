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
 * Onboarding card shown when a page has zero rows. Replaces the bland
 * "no data" text with something that gives the user a clear next step
 * and a bit of atmosphere — concentric rings behind the icon to break
 * the flat-rectangle feel of the rest of the UI.
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
        'card flex flex-col items-center text-center px-6 py-16 animate-fadeIn relative overflow-hidden',
        className,
      )}
    >
      {/* Soft radial accent behind the icon — visible only as atmosphere */}
      <div
        aria-hidden
        className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-64 opacity-40 pointer-events-none"
        style={{
          background:
            'radial-gradient(circle, rgb(var(--fg) / 0.045), transparent 65%)',
        }}
      />

      {Icon ? (
        <div className="relative mb-5">
          {/* Concentric rings — these are pure decoration, very subtle */}
          <div className="absolute inset-0 -m-3 rounded-full border border-border opacity-50" />
          <div className="absolute inset-0 -m-6 rounded-full border border-border opacity-25" />
          <div className="relative w-14 h-14 rounded-full bg-surface-2 border border-border flex items-center justify-center">
            <Icon className="w-5 h-5 text-fg-muted" strokeWidth={1.75} />
          </div>
        </div>
      ) : null}
      <h3 className="text-base font-semibold tracking-tight relative">{title}</h3>
      {description ? (
        <p className="mt-1.5 text-sm text-fg-muted max-w-sm relative leading-relaxed">{description}</p>
      ) : null}
      {onAction && actionLabel ? (
        <button onClick={onAction} className="btn-primary mt-6 group relative">
          <Plus className="w-3.5 h-3.5 transition-transform group-hover:rotate-90" />
          {actionLabel}
        </button>
      ) : null}
      {secondary ? <div className="mt-3 relative">{secondary}</div> : null}
    </div>
  );
}
