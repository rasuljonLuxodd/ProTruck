import { MapPin } from 'lucide-react';
import { Select } from '@/components/ui/Select';
import { useActiveLocation } from '@/state/LocationProvider';

/**
 * Small location picker pinned to the page header. Only renders when
 * the business has 2+ locations — a single-shop owner doesn't need
 * the chrome.
 *
 * Selection persists to localStorage via the LocationProvider so it
 * survives reloads.
 */
export function LocationSwitcher() {
  const { current, locations, setCurrent } = useActiveLocation();
  if (locations.length < 2) return null;

  return (
    <div className="flex items-center gap-1.5 bg-surface border border-border rounded-lg px-1.5 py-0.5 no-print">
      <MapPin className="w-3.5 h-3.5 text-fg-muted shrink-0" />
      <Select
        value={current?.id ?? ''}
        onChange={setCurrent}
        options={locations.map(l => ({
          value: l.id,
          label: l.shortCode || l.name,
          hint: l.shortCode ? l.name : undefined,
        }))}
        className="!w-auto min-w-[120px] [&>button]:!border-0 [&>button]:!py-1 [&>button]:!px-1.5 [&>button]:bg-transparent"
      />
    </div>
  );
}
