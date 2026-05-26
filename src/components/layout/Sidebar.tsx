import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Factory,
  ShoppingCart,
  CreditCard,
  Wallet,
  Users,
  Calendar,
  BarChart3,
  Settings as SettingsIcon,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useT } from '@/i18n/LanguageProvider';
import { useAuth } from '@/auth/AuthProvider';
import type { TranslationKey } from '@/i18n/translations';

interface NavItem {
  to: string;
  labelKey: TranslationKey;
  icon: LucideIcon;
  superAdminOnly?: boolean;
}

const nav: NavItem[] = [
  { to: '/',           labelKey: 'nav.dashboard',  icon: LayoutDashboard },
  { to: '/production', labelKey: 'nav.production', icon: Factory },
  { to: '/sales',      labelKey: 'nav.sales',      icon: ShoppingCart },
  { to: '/debts',      labelKey: 'nav.debts',      icon: CreditCard },
  { to: '/expenses',   labelKey: 'nav.expenses',   icon: Wallet },
  { to: '/workers',    labelKey: 'nav.workers',    icon: Users,     superAdminOnly: true },
  { to: '/calendar',   labelKey: 'nav.calendar',   icon: Calendar,  superAdminOnly: true },
  { to: '/reports',    labelKey: 'nav.reports',    icon: BarChart3, superAdminOnly: true },
];

function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(w => w[0]?.toUpperCase() ?? '')
    .join('');
}

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

export function Sidebar({ open, onClose }: SidebarProps) {
  const t = useT();
  const { currentUser } = useAuth();
  const isSuperAdmin = currentUser?.role === 'super_admin';

  const items = nav.filter(i => !i.superAdminOnly || isSuperAdmin);

  return (
    <>
      {open && (
        <div
          className="lg:hidden fixed inset-0 z-30 bg-black/30 animate-fadeIn"
          onClick={onClose}
        />
      )}
      <aside
        className={cn(
          'fixed lg:sticky top-0 left-0 z-40 h-screen w-[240px] shrink-0 bg-bg border-r border-border flex flex-col transition-transform',
          open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
        )}
      >
        {/* logo */}
        <div className="px-5 py-5 border-b border-border">
          <div className="font-semibold tracking-tight text-[15px]">ProTrack</div>
        </div>

        {/* nav */}
        <nav className="flex-1 overflow-y-auto px-2.5 py-3 space-y-0.5">
          {items.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              onClick={onClose}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm font-medium transition',
                  isActive
                    ? 'bg-surface-2 text-fg'
                    : 'text-fg-muted hover:bg-surface hover:text-fg',
                )
              }
            >
              <item.icon className="w-4 h-4 shrink-0" />
              <span>{t(item.labelKey)}</span>
            </NavLink>
          ))}
        </nav>

        {/* settings + user */}
        <div className="border-t border-border p-2.5 space-y-0.5">
          <NavLink
            to="/settings"
            onClick={onClose}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm font-medium transition',
                isActive
                  ? 'bg-surface-2 text-fg'
                  : 'text-fg-muted hover:bg-surface hover:text-fg',
              )
            }
          >
            <SettingsIcon className="w-4 h-4 shrink-0" />
            <span>{t('nav.settings')}</span>
          </NavLink>
        </div>

        <div className="px-3 py-3 border-t border-border flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-surface-2 border border-border flex items-center justify-center text-xs font-semibold">
            {currentUser ? initials(currentUser.name) : '·'}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[13px] font-medium truncate">{currentUser?.name ?? '—'}</div>
            <div className="text-[11px] text-fg-muted truncate">
              {currentUser ? t(`role.${currentUser.role}` as TranslationKey) : ''}
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
