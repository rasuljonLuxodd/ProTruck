import { cn } from '@/lib/utils';

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('bg-surface-2 animate-pulse rounded', className)} />;
}

export function StatCardSkeleton() {
  return (
    <div className="card p-5">
      <Skeleton className="h-3 w-24 mb-4" />
      <Skeleton className="h-8 w-40 mb-3" />
      <Skeleton className="h-3 w-32" />
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
