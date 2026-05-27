import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Factory,
  ShoppingCart,
  CreditCard,
  Wallet,
  Users,
  UserSquare,
  Calendar,
  BarChart3,
  Settings as SettingsIcon,
  PanelLeftClose,
  PanelLeft,
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
  { to: '/customers',  labelKey: 'nav.customers',  icon: UserSquare },
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

const COLLAPSE_KEY = 'protrack:sidebarCollapsed';

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

export function Sidebar({ open, onClose }: SidebarProps) {
  const t = useT();
  const { currentUser } = useAuth();
  const isSuperAdmin = currentUser?.role === 'super_admin';

  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem(COLLAPSE_KEY) === '1';
  });
  useEffect(() => {
    window.localStorage.setItem(COLLAPSE_KEY, collapsed ? '1' : '0');
  }, [collapsed]);

  const items = nav.filter(i => !i.superAdminOnly || isSuperAdmin);
  const width = collapsed ? 64 : 240;

  return (
    <>
      {open && (
        <div
          className="lg:hidden fixed inset-0 z-30 bg-black/30 animate-fadeIn"
          onClick={onClose}
        />
      )}
      <aside
        style={{ width }}
        className={cn(
          'fixed lg:sticky top-0 left-0 z-40 h-screen shrink-0 bg-bg border-r border-border flex flex-col transition-[width,transform] duration-200',
          open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
        )}
      >
        {/* logo + collapse toggle */}
        <div className={cn('px-5 py-5 border-b border-border flex items-center', collapsed ? 'justify-center px-2' : 'justify-between')}>
          {!collapsed ? (
            <div className="display text-[18px] leading-none">ProTrack</div>
          ) : (
            <div
              className="w-7 h-7 rounded-md flex items-center justify-center text-[11px] font-bold"
              style={{ background: 'rgb(var(--accent))', color: 'rgb(var(--accent-fg))' }}
            >P</div>
          )}
          <button
            onClick={() => setCollapsed(c => !c)}
            className="hidden lg:inline-flex items-center justify-center w-7 h-7 rounded-md text-fg-muted hover:text-fg hover:bg-surface transition"
            title={collapsed ? 'Expand' : 'Collapse'}
          >
            {collapsed ? <PanelLeft className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
          </button>
        </div>

        {/* nav */}
        <nav className={cn('flex-1 overflow-y-auto py-3 space-y-0.5', collapsed ? 'px-1.5' : 'px-2.5')}>
          {items.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              onClick={onClose}
              title={collapsed ? t(item.labelKey) : undefined}
              className={({ isActive }) =>
                cn(
                  'group relative flex items-center gap-2.5 rounded-lg text-sm font-medium transition-all duration-150',
                  collapsed ? 'justify-center px-2 py-2' : 'px-2.5 py-2',
                  isActive
                    ? 'bg-surface-2 text-fg shadow-sm'
                    : 'text-fg-muted hover:bg-surface hover:text-fg',
                )
              }
            >
              {({ isActive }) => (
                <>
                  {/* Active accent bar — saffron, picks up the editorial brand color */}
                  {isActive && !collapsed && (
                    <span
                      aria-hidden
                      className="absolute -left-2.5 top-1.5 bottom-1.5 w-0.5 rounded-r-full"
                      style={{ background: 'rgb(var(--accent))' }}
                    />
                  )}
                  <item.icon
                    className={cn(
                      'w-4 h-4 shrink-0 transition-transform',
                      'group-hover:scale-110',
                      isActive && 'text-fg',
                    )}
                  />
                  {!collapsed && <span>{t(item.labelKey)}</span>}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* settings + user */}
        <div className={cn('border-t border-border py-2.5 space-y-0.5', collapsed ? 'px-1.5' : 'px-2.5')}>
          <NavLink
            to="/settings"
            onClick={onClose}
            title={collapsed ? t('nav.settings') : undefined}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-2.5 rounded-lg text-sm font-medium transition',
                collapsed ? 'justify-center px-2 py-2' : 'px-2.5 py-2',
                isActive
                  ? 'bg-surface-2 text-fg'
                  : 'text-fg-muted hover:bg-surface hover:text-fg',
              )
            }
          >
            <SettingsIcon className="w-4 h-4 shrink-0" />
            {!collapsed && <span>{t('nav.settings')}</span>}
          </NavLink>
        </div>

        <div className={cn('py-3 border-t border-border flex items-center gap-2.5', collapsed ? 'px-2 justify-center' : 'px-3')}>
          <div className="w-8 h-8 rounded-full bg-surface-2 border border-border flex items-center justify-center text-xs font-semibold shrink-0">
            {currentUser ? initials(currentUser.name) : '·'}
          </div>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-medium truncate">{currentUser?.name ?? '—'}</div>
              <div className="text-[11px] text-fg-muted truncate">
                {currentUser ? t(`role.${currentUser.role}` as TranslationKey) : ''}
              </div>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
