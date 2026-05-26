import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Factory, ShoppingCart, CreditCard, Wallet,
  Users, Calendar, BarChart3, Settings as SettingsIcon, LogOut, Moon, Sun,
  ArrowRight, type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useT } from '@/i18n/LanguageProvider';
import { useAuth } from '@/auth/AuthProvider';
import { useTheme } from '@/theme/ThemeProvider';
import type { TranslationKey } from '@/i18n/translations';

interface Command {
  id: string;
  label: string;
  group: 'nav' | 'action';
  icon: LucideIcon;
  run: () => void;
  requiresSuperAdmin?: boolean;
}

interface Props {
  open: boolean;
  onClose: () => void;
}

export function CommandPalette({ open, onClose }: Props) {
  const t = useT();
  const navigate = useNavigate();
  const { currentUser, signOut } = useAuth();
  const { theme, toggle } = useTheme();
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const commands = useMemo<Command[]>(() => {
    const nav = (to: string, key: TranslationKey, icon: LucideIcon, superOnly = false): Command => ({
      id: `nav:${to}`,
      label: t(key),
      group: 'nav',
      icon,
      run: () => { navigate(to); onClose(); },
      requiresSuperAdmin: superOnly,
    });
    return [
      nav('/',           'nav.dashboard',  LayoutDashboard),
      nav('/production', 'nav.production', Factory),
      nav('/sales',      'nav.sales',      ShoppingCart),
      nav('/debts',      'nav.debts',      CreditCard),
      nav('/expenses',   'nav.expenses',   Wallet),
      nav('/workers',    'nav.workers',    Users,       true),
      nav('/calendar',   'nav.calendar',   Calendar,    true),
      nav('/reports',    'nav.reports',    BarChart3,   true),
      nav('/settings',   'nav.settings',   SettingsIcon),
      {
        id: 'action:toggleTheme',
        label: t('palette.toggleTheme'),
        group: 'action',
        icon: theme === 'dark' ? Sun : Moon,
        run: () => { toggle(); onClose(); },
      },
      {
        id: 'action:signOut',
        label: t('palette.signOut'),
        group: 'action',
        icon: LogOut,
        run: () => {
          void signOut().then(() => {
            navigate('/login', { replace: true });
            onClose();
          });
        },
      },
    ];
  }, [t, navigate, onClose, theme, toggle, signOut]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return commands
      .filter(c => !c.requiresSuperAdmin || currentUser?.role === 'super_admin')
      .filter(c => (q ? c.label.toLowerCase().includes(q) : true));
  }, [commands, query, currentUser]);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setActive(0);
    setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);

  useEffect(() => {
    setActive(0);
  }, [query]);

  function handleKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive(a => Math.min(filtered.length - 1, a + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive(a => Math.max(0, a - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      filtered[active]?.run();
    } else if (e.key === 'Escape') {
      onClose();
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[55] flex items-start justify-center pt-[10vh] px-4 animate-fadeIn"
      style={{ background: 'rgb(0 0 0 / 0.4)', backdropFilter: 'blur(6px)' }}
      onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-xl bg-bg border border-border rounded-xl shadow-lg overflow-hidden animate-scaleIn"
      >
        <div className="border-b border-border">
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKey}
            placeholder={t('palette.placeholder')}
            className="w-full bg-transparent px-4 py-3.5 text-sm outline-none placeholder:text-fg-subtle"
          />
        </div>
        <ul className="max-h-[50vh] overflow-y-auto py-1">
          {filtered.length === 0 ? (
            <li className="px-4 py-6 text-sm text-fg-subtle text-center">
              {t('common.empty')}
            </li>
          ) : (
            filtered.map((c, i) => (
              <li
                key={c.id}
                onMouseEnter={() => setActive(i)}
                onClick={c.run}
                className={cn(
                  'flex items-center gap-2.5 px-4 py-2.5 cursor-pointer text-sm',
                  active === i ? 'bg-surface' : '',
                )}
              >
                <c.icon className="w-4 h-4 text-fg-muted shrink-0" />
                <span className="flex-1">{c.label}</span>
                <span className="text-[10px] uppercase tracking-wider text-fg-subtle">
                  {c.group === 'nav' ? t('palette.go') : t('palette.signOut').slice(0, 0) || ''}
                </span>
                {active === i ? <ArrowRight className="w-3.5 h-3.5 text-fg-muted" /> : null}
              </li>
            ))
          )}
        </ul>
        <div className="border-t border-border px-4 py-2 text-[10px] text-fg-subtle flex items-center justify-between">
          <span>↑↓ navigate · ↵ select · esc close</span>
          <kbd className="font-mono">⌘K</kbd>
        </div>
      </div>
    </div>
  );
}
