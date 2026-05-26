import { Link } from 'react-router-dom';
import {
  ShoppingCart, Factory, Receipt, UserPlus, type LucideIcon,
} from 'lucide-react';
import { useT } from '@/i18n/LanguageProvider';
import { useAuth } from '@/auth/AuthProvider';
import { cn } from '@/lib/utils';
import type { TranslationKey } from '@/i18n/translations';

interface Action {
  labelKey: TranslationKey;
  to: string;
  icon: LucideIcon;
  superAdminOnly?: boolean;
}

const ACTIONS: Action[] = [
  { labelKey: 'dash.quick.newSale',       to: '/sales',      icon: ShoppingCart },
  { labelKey: 'dash.quick.newProduction', to: '/production', icon: Factory },
  { labelKey: 'dash.quick.newExpense',    to: '/expenses',   icon: Receipt },
  { labelKey: 'dash.quick.newWorker',     to: '/workers',    icon: UserPlus, superAdminOnly: true },
];

/**
 * One-tap shortcuts to the four most common write actions. Hidden when
 * the user can't access the target route (e.g. admins don't see workers).
 */
export function QuickActions() {
  const t = useT();
  const { currentUser } = useAuth();
  const isSuperAdmin = currentUser?.role === 'super_admin';

  return (
    <div className="flex flex-wrap gap-2 animate-slideIn stagger-1">
      {ACTIONS
        .filter(a => !a.superAdminOnly || isSuperAdmin)
        .map(a => (
          <Link
            key={a.to}
            to={a.to}
            className={cn(
              'flex items-center gap-2 px-3 py-2 rounded-lg',
              'bg-surface border border-border text-sm font-medium',
              'hover:bg-surface-2 hover:border-border-strong transition',
            )}
          >
            <a.icon className="w-4 h-4 text-fg-muted" />
            {t(a.labelKey)}
          </Link>
        ))}
    </div>
  );
}
