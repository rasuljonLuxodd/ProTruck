import type { ReactNode } from 'react';
import { Menu, Plus } from 'lucide-react';
import { useT } from '@/i18n/LanguageProvider';

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
          className="lg:hidden p-2 border border-border rounded-lg hover:bg-surface transition shrink-0"
          aria-label="menu"
        >
          <Menu className="w-4 h-4" />
        </button>
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight truncate">{title}</h1>
          {description ? (
            <p className="mt-1 text-sm text-fg-muted">{description}</p>
          ) : null}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {rightSlot}
        {onAdd ? (
          <button onClick={onAdd} className="btn-primary">
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{addLabel ?? t('common.add')}</span>
          </button>
        ) : null}
      </div>
    </header>
  );
}
