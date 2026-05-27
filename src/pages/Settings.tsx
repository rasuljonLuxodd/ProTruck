import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, Plus, Trash2, Edit, User as UserIcon, Sliders, Users as UsersIcon, Sun, Moon, Download, Upload, Database, History, Wallet } from 'lucide-react';
import { Layout } from '@/components/layout/Layout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Modal } from '@/components/ui/Modal';
import { Field } from '@/components/ui/Field';
import { Badge } from '@/components/ui/Badge';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useT, useLanguage } from '@/i18n/LanguageProvider';
import { useTheme } from '@/theme/ThemeProvider';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/auth/AuthProvider';
import { useUsers, useUpdateUser, useDeleteUser } from '@/hooks/useUsers';
import { supabase } from '@/data/supabaseClient';
import { TwoFactorSection } from '@/components/settings/TwoFactorSection';
import { BackupSection } from '@/components/settings/BackupSection';
import { ActivitySection } from '@/components/settings/ActivitySection';
import { AccountsSection } from '@/components/settings/AccountsSection';
import { Select } from '@/components/ui/Select';
import { formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { Language, Role, User } from '@/types';
import type { TranslationKey } from '@/i18n/translations';

const LANGS: Array<{ code: Language; label: string }> = [
  { code: 'uz', label: "O'zbek" },
  { code: 'en', label: 'English' },
  { code: 'ru', label: 'Русский' },
];

type SectionKey = 'profile' | 'preferences' | 'users' | 'accounts' | 'activity' | 'backup';

export default function Settings() {
  const t = useT();
  const navigate = useNavigate();
  const { currentUser, signOut } = useAuth();
  const { lang, setLang } = useLanguage();
  const { theme, setTheme } = useTheme();

  const [section, setSection] = useState<SectionKey>('profile');

  if (!currentUser) return null;

  const sections: Array<{ key: SectionKey; label: string; icon: typeof UserIcon; visible: boolean }> = [
    { key: 'profile',     label: t('set.profile'),     icon: UserIcon, visible: true },
    { key: 'preferences', label: t('set.preferences'), icon: Sliders,  visible: true },
    { key: 'users',       label: t('set.users'),       icon: UsersIcon, visible: currentUser.role === 'super_admin' },
    { key: 'accounts',    label: t('set.accounts'),    icon: Wallet,    visible: currentUser.role === 'super_admin' },
    { key: 'activity',    label: t('set.activity'),    icon: History,   visible: currentUser.role === 'super_admin' },
    { key: 'backup',      label: t('set.backup'),      icon: Database,  visible: currentUser.role === 'super_admin' },
  ];

  async function handleSignOut() {
    await signOut();
    navigate('/login', { replace: true });
  }

  return (
    <Layout>
      {({ openMenu }) => (
        <>
          <PageHeader
            title={t('nav.settings')}
            onMenu={openMenu}
            rightSlot={
              <button onClick={handleSignOut} className="btn-secondary">
                <LogOut className="w-3.5 h-3.5" />
                {t('auth.signOut')}
              </button>
            }
          />

          <div className="grid grid-cols-12 gap-6">
            {/* section nav */}
            <aside className="col-span-12 md:col-span-3">
              <nav className="flex md:flex-col gap-1 overflow-x-auto md:overflow-visible">
                {sections.filter(s => s.visible).map(s => (
                  <button
                    key={s.key}
                    onClick={() => setSection(s.key)}
                    className={cn(
                      'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition whitespace-nowrap',
                      section === s.key
                        ? 'bg-surface text-fg'
                        : 'text-fg-muted hover:bg-surface hover:text-fg',
                    )}
                  >
                    <s.icon className="w-4 h-4" />
                    {s.label}
                  </button>
                ))}
              </nav>
            </aside>

            {/* section body */}
            <section className="col-span-12 md:col-span-9">
              {section === 'profile' && <ProfileSectionWithMfa />}
              {section === 'preferences' && (
                <PreferencesSection
                  lang={lang}
                  setLang={setLang}
                  theme={theme}
                  setTheme={setTheme}
                />
              )}
              {section === 'users' && currentUser.role === 'super_admin' && <UsersSection />}
              {section === 'accounts' && currentUser.role === 'super_admin' && <AccountsSection />}
              {section === 'activity' && currentUser.role === 'super_admin' && <ActivitySection />}
              {section === 'backup' && currentUser.role === 'super_admin' && <BackupSection />}
            </section>
          </div>
        </>
      )}
    </Layout>
  );
}

function ProfileSection() {
  const t = useT();
  const { toast } = useToast();
  const { currentUser, refresh } = useAuth();
  const updateUser = useUpdateUser();

  const [name, setName] = useState(currentUser!.name);
  const [email, setEmail] = useState(currentUser!.email);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!currentUser) return;
    setBusy(true);
    try {
      // 1) Update name in profiles (handled via repository).
      if (name.trim() !== currentUser.name) {
        await new Promise<void>((resolve, reject) => {
          updateUser.mutate(
            { id: currentUser.id, patch: { name: name.trim() } },
            { onSuccess: () => resolve(), onError: reject },
          );
        });
      }

      // 2) Email + password via Supabase Auth (these live in auth.users).
      const authPatch: { email?: string; password?: string } = {};
      if (email.trim().toLowerCase() !== currentUser.email.trim().toLowerCase()) {
        authPatch.email = email.trim();
      }
      if (password.trim()) authPatch.password = password;

      if (Object.keys(authPatch).length > 0) {
        const { error } = await supabase.auth.updateUser(authPatch);
        if (error) {
          toast(error.message, 'error');
          setBusy(false);
          return;
        }
        // Mirror email into profiles so the Users table stays current.
        if (authPatch.email) {
          await supabase.from('profiles').update({ email: authPatch.email }).eq('id', currentUser.id);
        }
      }

      await refresh();
      setPassword('');
      toast(t('toast.saved'));
    } catch (err) {
      const msg =
        err instanceof Error && err.message === 'duplicate_email'
          ? t('set.duplicateEmail')
          : t('toast.error');
      toast(msg, 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card p-6">
      <h2 className="text-lg font-semibold tracking-tight mb-1">{t('set.profile')}</h2>
      <p className="text-sm text-fg-muted mb-6">
        {currentUser?.email}
      </p>
      <form onSubmit={save} className="space-y-4 max-w-md">
        <Field label={t('set.name')}>
          <input className="input" value={name} onChange={e => setName(e.target.value)} required />
        </Field>
        <Field label={t('set.email')}>
          <input type="email" className="input" value={email} onChange={e => setEmail(e.target.value)} required />
        </Field>
        <Field label={t('set.newPassword')} hint={t('set.newPasswordHint')}>
          <input
            type="password"
            className="input"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="••••••••"
          />
        </Field>
        <button type="submit" className="btn-primary" disabled={busy}>
          {busy ? '…' : t('set.saveProfile')}
        </button>
      </form>
    </div>
  );
}

function ProfileSectionWithMfa() {
  return (
    <div className="space-y-4">
      <ProfileSection />
      <TwoFactorSection />
    </div>
  );
}

function PreferencesSection({
  lang, setLang, theme, setTheme,
}: {
  lang: Language;
  setLang: (l: Language) => void;
  theme: 'light' | 'dark';
  setTheme: (t: 'light' | 'dark') => void;
}) {
  const t = useT();
  return (
    <div className="card p-6 space-y-8">
      <div>
        <h2 className="text-lg font-semibold tracking-tight mb-4">{t('common.language')}</h2>
        <div className="grid grid-cols-3 gap-2 max-w-md">
          {LANGS.map(opt => (
            <button
              key={opt.code}
              onClick={() => setLang(opt.code)}
              className={cn(
                'px-3 py-2.5 rounded-lg border text-sm font-medium transition',
                lang === opt.code
                  ? 'bg-fg text-bg border-fg'
                  : 'border-border text-fg hover:bg-surface',
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="border-t border-border pt-8">
        <h2 className="text-lg font-semibold tracking-tight mb-4">{t('common.theme')}</h2>
        <div className="grid grid-cols-2 gap-2 max-w-md">
          <button
            onClick={() => setTheme('light')}
            className={cn(
              'flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border text-sm font-medium transition',
              theme === 'light'
                ? 'bg-fg text-bg border-fg'
                : 'border-border text-fg hover:bg-surface',
            )}
          >
            <Sun className="w-4 h-4" />
            {t('common.light')}
          </button>
          <button
            onClick={() => setTheme('dark')}
            className={cn(
              'flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border text-sm font-medium transition',
              theme === 'dark'
                ? 'bg-fg text-bg border-fg'
                : 'border-border text-fg hover:bg-surface',
            )}
          >
            <Moon className="w-4 h-4" />
            {t('common.dark')}
          </button>
        </div>
      </div>
    </div>
  );
}

function UsersSection() {
  const t = useT();
  const { toast } = useToast();
  const { currentUser, refresh, createUser } = useAuth();
  const { data: users = [] } = useUsers();
  const updateUser = useUpdateUser();
  const deleteUser = useDeleteUser();
  const [creating, setCreating] = useState(false);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [confirmDel, setConfirmDel] = useState<User | null>(null);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<Role>('admin');

  function reset() {
    setEditing(null);
    setName(''); setEmail(''); setPassword(''); setRole('admin');
  }
  function startAdd() { reset(); setOpen(true); }
  function startEdit(u: User) {
    setEditing(u); setName(u.name); setEmail(u.email); setPassword(''); setRole(u.role);
    setOpen(true);
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    if (editing) {
      // Edit existing user: update name + role via profiles. Email/password
      // changes for other users would need a service-role edge function;
      // self-edits go through the Profile section.
      const patch: Partial<User> = { name: name.trim(), role };
      const isSelf = editing.id === currentUser?.id;
      updateUser.mutate(
        { id: editing.id, patch },
        {
          onSuccess: async () => {
            if (isSelf) await refresh();
            toast(t('toast.saved'));
            setOpen(false);
            reset();
          },
          onError: (err: unknown) => {
            const msg = err instanceof Error && err.message === 'forbidden_role_change'
              ? t('toast.error')
              : err instanceof Error && err.message === 'duplicate_email'
                ? t('set.duplicateEmail')
                : t('toast.error');
            toast(msg, 'error');
          },
        },
      );
    } else {
      if (!password.trim()) return;
      setCreating(true);
      const result = await createUser({
        name: name.trim(),
        email: email.trim(),
        password,
        role,
      });
      setCreating(false);
      if (result.ok) {
        toast(t('toast.saved'));
        setOpen(false);
        reset();
      } else {
        const msg = result.error === 'duplicate_email'
          ? t('set.duplicateEmail')
          : result.error === 'weak_password'
            ? t('auth.weakPassword')
            : t('toast.error');
        toast(msg, 'error');
      }
    }
  }

  function handleDelete() {
    if (!confirmDel) return;
    deleteUser.mutate(confirmDel.id, {
      onSuccess: () => { toast(t('toast.deleted')); setConfirmDel(null); },
      onError: () => toast(t('toast.error'), 'error'),
    });
  }

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between p-6 border-b border-border">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">{t('set.users')}</h2>
          <p className="text-sm text-fg-muted mt-0.5">{users.length}</p>
        </div>
        <button className="btn-primary" onClick={startAdd}>
          <Plus className="w-3.5 h-3.5" />
          {t('set.addUser')}
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>{t('set.name')}</th>
              <th>{t('set.email')}</th>
              <th>{t('set.role')}</th>
              <th>{t('common.date')}</th>
              <th className="text-right">{t('common.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {users.map(u => {
              const isSelf = u.id === currentUser?.id;
              return (
                <tr key={u.id}>
                  <td className="font-medium">
                    {u.name}
                    {isSelf && <span className="ml-2 text-xs text-fg-muted">(you)</span>}
                  </td>
                  <td className="font-mono text-xs text-fg-muted">{u.email}</td>
                  <td>
                    <Badge tone={u.role === 'super_admin' ? 'fg' : 'mute'}>
                      {t(`role.${u.role}` as TranslationKey)}
                    </Badge>
                  </td>
                  <td className="text-fg-muted">{formatDate(u.createdAt)}</td>
                  <td className="text-right space-x-1 whitespace-nowrap">
                    <button className="btn-ghost !py-1.5" onClick={() => startEdit(u)}>
                      <Edit className="w-3.5 h-3.5" />
                    </button>
                    {!isSelf && (
                      <button className="btn-ghost !py-1.5 text-negative hover:text-negative" onClick={() => setConfirmDel(u)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Modal
        open={open}
        onClose={() => { setOpen(false); reset(); }}
        title={editing ? t('set.editUser') : t('set.addUser')}
        footer={
          <>
            <button className="btn-secondary" onClick={() => { setOpen(false); reset(); }}>{t('common.cancel')}</button>
            <button className="btn-primary" form="user-form" type="submit" disabled={creating}>
              {creating ? '…' : t('common.save')}
            </button>
          </>
        }
      >
        <form id="user-form" onSubmit={save} className="space-y-4">
          <Field label={t('set.name')}>
            <input className="input" value={name} onChange={e => setName(e.target.value)} required />
          </Field>
          <Field label={t('set.email')}>
            <input
              type="email"
              className="input disabled:opacity-60"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              disabled={!!editing}
            />
          </Field>
          {!editing && (
            <Field label={t('set.newPassword')}>
              <input
                type="password"
                className="input"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={6}
              />
            </Field>
          )}
          <Field label={t('set.role')}>
            <Select
              value={role}
              onChange={setRole}
              options={[
                { value: 'admin' as const,       label: t('role.admin') },
                { value: 'super_admin' as const, label: t('role.super_admin') },
              ]}
            />
          </Field>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!confirmDel}
        message={confirmDel ? `${confirmDel.name} (${confirmDel.email})` : undefined}
        onConfirm={handleDelete}
        onCancel={() => setConfirmDel(null)}
      />
    </div>
  );
}
