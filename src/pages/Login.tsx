import { useEffect, useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Lock, Mail, User as UserIcon } from 'lucide-react';
import { supabase } from '@/data/supabaseClient';
import { useAuth } from '@/auth/AuthProvider';
import { useT, useLanguage } from '@/i18n/LanguageProvider';
import { useTheme } from '@/theme/ThemeProvider';
import type { Language } from '@/types';
import { cn } from '@/lib/utils';

const LANGS: Array<{ code: Language; label: string }> = [
  { code: 'uz', label: "O'Z" },
  { code: 'en', label: 'EN' },
  { code: 'ru', label: 'RU' },
];

type Mode = 'signin' | 'signup';

export default function Login() {
  const t = useT();
  const { lang, setLang } = useLanguage();
  const { theme, toggle } = useTheme();
  const { signIn, currentUser, refresh } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? '/';

  const [mode, setMode] = useState<Mode>('signin');
  const [hasAnyUser, setHasAnyUser] = useState<boolean | null>(null);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // First-time? Detect whether any profile exists. If not, force signup mode.
  useEffect(() => {
    let active = true;
    void (async () => {
      const { count } = await supabase
        .from('profiles')
        .select('id', { count: 'exact', head: true });
      if (!active) return;
      const any = (count ?? 0) > 0;
      setHasAnyUser(any);
      if (!any) setMode('signup');
    })();
    return () => {
      active = false;
    };
  }, []);

  if (currentUser) return <Navigate to={from} replace />;

  async function handleSignIn(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const result = await signIn(email, password);
    setBusy(false);
    if (result.ok) {
      navigate(from, { replace: true });
    } else {
      setError(t('auth.invalid'));
    }
  }

  async function handleSignUp(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const { data, error: err } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { name: name.trim() } },
    });
    setBusy(false);
    if (err) {
      const msg = err.message.toLowerCase();
      if (msg.includes('user already registered')) setError(t('auth.duplicate'));
      else if (msg.includes('password')) setError(t('auth.weakPassword'));
      else setError(err.message);
      return;
    }
    if (data.session) {
      await refresh();
      navigate(from, { replace: true });
    } else {
      // Email confirmation flow — tell user to check inbox.
      setMode('signin');
      setError(null);
    }
  }

  const isSignUp = mode === 'signup';
  const submit = isSignUp ? handleSignUp : handleSignIn;

  return (
    <div className="min-h-screen flex flex-col bg-bg">
      <header className="flex items-center justify-between px-6 py-5">
        <div className="font-semibold tracking-tight">ProTrack</div>
        <div className="flex items-center gap-2">
          <div className="flex border border-border rounded-lg overflow-hidden">
            {LANGS.map(opt => (
              <button
                key={opt.code}
                onClick={() => setLang(opt.code)}
                className={cn(
                  'px-2.5 py-1 text-xs font-medium transition',
                  lang === opt.code ? 'bg-fg text-bg' : 'text-fg-muted hover:bg-surface',
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <button
            onClick={toggle}
            className="px-3 py-1.5 border border-border rounded-lg text-xs text-fg-muted hover:bg-surface transition"
          >
            {theme === 'dark' ? t('common.dark') : t('common.light')}
          </button>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-4">
        <div className="w-full max-w-[400px]">
          <div className="mb-8">
            <h1 className="text-2xl font-semibold tracking-tight">
              {isSignUp ? t('auth.signUpTitle') : t('auth.signInTitle')}
            </h1>
            <p className="mt-1.5 text-sm text-fg-muted">
              {isSignUp ? t('auth.signUpSubtitle') : t('auth.signInSubtitle')}
            </p>
          </div>

          <form onSubmit={submit} className="space-y-4">
            {isSignUp && (
              <div>
                <label className="label">{t('auth.name')}</label>
                <div className="relative">
                  <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-fg-subtle pointer-events-none" />
                  <input
                    type="text"
                    className="input pl-9"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="Admin"
                    required
                  />
                </div>
              </div>
            )}

            <div>
              <label className="label">{t('auth.email')}</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-fg-subtle pointer-events-none" />
                <input
                  type="email"
                  className="input pl-9"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  autoFocus
                  required
                />
              </div>
            </div>

            <div>
              <label className="label">{t('auth.password')}</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-fg-subtle pointer-events-none" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="input pl-9 pr-9"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={isSignUp ? 6 : undefined}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-fg-subtle hover:text-fg transition"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="text-sm text-negative bg-negative/5 border border-negative/20 rounded-lg px-3 py-2">
                {error}
              </div>
            )}

            <button type="submit" className="btn-primary w-full" disabled={busy}>
              {busy ? '…' : isSignUp ? t('auth.signUp') : t('auth.signIn')}
            </button>

            {!isSignUp && hasAnyUser && (
              <div className="text-center">
                <Link
                  to="/forgot-password"
                  className="text-sm text-fg-muted hover:text-fg transition"
                >
                  {t('auth.forgot')}
                </Link>
              </div>
            )}
          </form>

          {/* Once any user exists, signup is closed — only super admin can
              create users via Settings → Users. */}
          {hasAnyUser === false && (
            <div className="mt-8 pt-6 border-t border-border text-xs text-fg-muted text-center">
              {t('auth.signUpSubtitle')}
            </div>
          )}
        </div>
      </main>

      <footer className="px-6 py-5 text-xs text-fg-subtle text-center">
        © {new Date().getFullYear()} ProTrack
      </footer>
    </div>
  );
}
