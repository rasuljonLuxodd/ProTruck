import { cn } from '@/lib/utils';

interface SkeletonProps {
  className?: string;
  /** "block" (rectangle) or "circle" (rounded-full). Default block. */
  shape?: 'block' | 'circle';
}

/**
 * Loading placeholder with a slow shimmer wave. The wave is a moving
 * highlight band inside a subtle base color, achieved with a 200%-wide
 * gradient that animates its background-position. This reads as more
 * "alive" than a static gray bar without being distracting.
 */
export function Skeleton({ className, shape = 'block' }: SkeletonProps) {
  return (
    <div
      aria-hidden
      className={cn(
        'animate-shimmer',
        shape === 'circle' ? 'rounded-full' : 'rounded-md',
        className,
      )}
      style={{
        backgroundImage:
          'linear-gradient(90deg, rgb(var(--surface-2)) 0%, rgb(var(--border)) 50%, rgb(var(--surface-2)) 100%)',
        backgroundSize: '200% 100%',
      }}
    />
  );
}

export function StatCardSkeleton() {
  return (
    <div className="card p-5">
      <div className="flex items-start justify-between mb-3">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-8 w-8" />
      </div>
      <Skeleton className="h-8 w-40 mb-3" />
      <div className="flex items-center justify-between gap-3">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-6 w-16" />
      </div>
    </div>
  );
}

export function TableRowSkeleton({ cols = 4 }: { cols?: number }) {
  return (
    <tr>
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-4 py-3 border-b border-border">
          <Skeleton className="h-3.5 w-24" />
        </td>
      ))}
    </tr>
  );
}
