import type { ReactNode } from 'react';
import { Menu, Plus } from 'lucide-react';
import { useT } from '@/i18n/LanguageProvider';
import { NotificationBell } from '@/components/ui/NotificationBell';

interface Props {
  title: string;
  description?: string;
  onMenu?: () => void;
  onAdd?: () => void;
  addLabel?: string;
  rightSlot?: ReactNode;
}

export function PageHeader({ title, description, onMenu, onAdd, addLabel, rightSlot }: Props) {
  const t = useT();
  return (
    <header className="flex items-start justify-between gap-4 mb-6">
      <div className="flex items-start gap-3 min-w-0">
        <button
          onClick={onMenu}
          className="lg:hidden inline-flex items-center justify-center w-9 h-9 border border-border rounded-lg hover:bg-surface hover:border-border-strong transition shrink-0"
          aria-label="menu"
        >
          <Menu className="w-4 h-4" />
        </button>
        <div className="min-w-0">
          {/* Small accent dot before the title — adds rhythm and signals "you're here" */}
          <div className="flex items-center gap-2.5 min-w-0">
            <span
              aria-hidden
              className="w-1.5 h-1.5 rounded-full bg-fg shrink-0"
            />
            <h1 className="text-2xl font-semibold tracking-tight truncate">{title}</h1>
          </div>
          {description ? (
            <p className="mt-1.5 text-sm text-fg-muted">{description}</p>
          ) : null}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {rightSlot}
        <NotificationBell />
        {onAdd ? (
          <button onClick={onAdd} className="btn-primary group">
            <Plus className="w-3.5 h-3.5 transition-transform group-hover:rotate-90" />
            <span className="hidden sm:inline">{addLabel ?? t('common.add')}</span>
          </button>
        ) : null}
      </div>
    </header>
  );
}
