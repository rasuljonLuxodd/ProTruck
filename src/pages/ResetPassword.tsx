import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Lock } from 'lucide-react';
import { supabase } from '@/data/supabaseClient';
import { useT } from '@/i18n/LanguageProvider';

export default function ResetPassword() {
  const t = useT();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recoveryReady, setRecoveryReady] = useState(false);

  // Supabase puts the recovery token in the URL hash; the JS client picks it up
  // via onAuthStateChange with event === 'PASSWORD_RECOVERY'.
  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setRecoveryReady(true);
    });
    // If we already have a session (token in URL fragment), we're good.
    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) setRecoveryReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const { error: err } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
    setDone(true);
    // After 1.5s, sign out and redirect to login so user signs in fresh.
    setTimeout(async () => {
      await supabase.auth.signOut();
      navigate('/login', { replace: true });
    }, 1500);
  }

  return (
    <div className="min-h-screen flex flex-col bg-bg">
      <header className="flex items-center justify-between px-6 py-5">
        <div className="font-semibold tracking-tight">ProTrack</div>
      </header>
      <main className="flex-1 flex items-center justify-center px-4">
        <div className="w-full max-w-[400px]">
          <Link
            to="/login"
            className="inline-flex items-center gap-1.5 text-sm text-fg-muted hover:text-fg transition mb-6"
          >
            <ArrowLeft className="w-4 h-4" />
            {t('auth.backToLogin')}
          </Link>
          <div className="mb-8">
            <h1 className="text-2xl font-semibold tracking-tight">{t('auth.newPasswordTitle')}</h1>
            <p className="mt-1.5 text-sm text-fg-muted">{t('auth.newPasswordSubtitle')}</p>
          </div>

          {done ? (
            <div className="bg-positive/5 border border-positive/20 text-positive text-sm rounded-lg px-4 py-3">
              {t('auth.passwordUpdated')}
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              <div>
                <label className="label">{t('auth.password')}</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-fg-subtle pointer-events-none" />
                  <input
                    type="password"
                    required
                    minLength={6}
                    className="input pl-9"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    autoFocus
                    disabled={!recoveryReady}
                  />
                </div>
                {!recoveryReady && (
                  <p className="mt-2 text-xs text-fg-muted">…</p>
                )}
              </div>
              {error && (
                <div className="text-sm text-negative bg-negative/5 border border-negative/20 rounded-lg px-3 py-2">
                  {error}
                </div>
              )}
              <button type="submit" className="btn-primary w-full" disabled={busy || !recoveryReady}>
                {busy ? '…' : t('auth.updatePassword')}
              </button>
            </form>
          )}
        </div>
      </main>
    </div>
  );
}
