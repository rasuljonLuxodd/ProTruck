import { useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Lock, Mail } from 'lucide-react';
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

/**
 * Login page. Sign-up is intentionally NOT exposed here — the super admin
 * creates user accounts from Settings → Users. Self-registration would let
 * anyone discover the URL and request access, which is not what this app
 * is for (a single business gives credentials to its own staff).
 */
export default function Login() {
  const t = useT();
  const { lang, setLang } = useLanguage();
  const { theme, toggle } = useTheme();
  const { signIn, verifyMfa, currentUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? '/';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // MFA state — if signIn returns mfaRequired, we ask for the 6-digit code.
  const [mfaFactorId, setMfaFactorId] = useState<string | null>(null);
  const [mfaCode, setMfaCode] = useState('');

  if (currentUser) return <Navigate to={from} replace />;

  async function handleSignIn(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const result = await signIn(email, password);
    setBusy(false);
    if (result.ok) {
      navigate(from, { replace: true });
    } else if ('mfaRequired' in result) {
      setMfaFactorId(result.factorId);
      setError(null);
    } else {
      setError(t('auth.invalid'));
    }
  }

  async function handleMfaVerify(e: FormEvent) {
    e.preventDefault();
    if (!mfaFactorId) return;
    setError(null);
    setBusy(true);
    const result = await verifyMfa(mfaFactorId, mfaCode);
    setBusy(false);
    if (result.ok) {
      navigate(from, { replace: true });
    } else {
      setError(t('set.mfaInvalid'));
      setMfaCode('');
    }
  }

  const isMfa = !!mfaFactorId;
  const submit = isMfa ? handleMfaVerify : handleSignIn;

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
              {isMfa ? t('set.mfaTitle') : t('auth.signInTitle')}
            </h1>
            <p className="mt-1.5 text-sm text-fg-muted">
              {isMfa ? t('set.mfaScan') : t('auth.signInSubtitle')}
            </p>
          </div>

          <form onSubmit={submit} className="space-y-4">
            {isMfa ? (
              <div>
                <label className="label">{t('set.mfaCode')}</label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  required
                  autoFocus
                  className="input tnum text-center text-lg tracking-widest"
                  value={mfaCode}
                  onChange={e => setMfaCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="123456"
                />
              </div>
            ) : (
              <>
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
              </>
            )}

            {error && (
              <div className="text-sm text-negative bg-negative/5 border border-negative/20 rounded-lg px-3 py-2">
                {error}
              </div>
            )}

            <button type="submit" className="btn-primary w-full" disabled={busy || (isMfa && mfaCode.length !== 6)}>
              {busy ? '…' : isMfa ? t('set.mfaVerify') : t('auth.signIn')}
            </button>

            {!isMfa && (
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

          <div className="mt-8 pt-6 border-t border-border text-xs text-fg-subtle text-center leading-relaxed">
            {t('auth.invitedOnly')}
          </div>
        </div>
      </main>

      <footer className="px-6 py-5 text-xs text-fg-subtle text-center">
        © {new Date().getFullYear()} ProTrack
      </footer>
    </div>
  );
}
