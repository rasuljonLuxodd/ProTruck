import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Mail } from 'lucide-react';
import { supabase } from '@/data/supabaseClient';
import { useT } from '@/i18n/LanguageProvider';

export default function ForgotPassword() {
  const t = useT();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
    setSent(true);
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
            <h1 className="text-2xl font-semibold tracking-tight">{t('auth.forgotTitle')}</h1>
            <p className="mt-1.5 text-sm text-fg-muted">{t('auth.forgotSubtitle')}</p>
          </div>

          {sent ? (
            <div className="bg-positive/5 border border-positive/20 text-positive text-sm rounded-lg px-4 py-3">
              {t('auth.linkSent')}
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              <div>
                <label className="label">{t('auth.email')}</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-fg-subtle pointer-events-none" />
                  <input
                    type="email"
                    required
                    autoFocus
                    className="input pl-9"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="you@example.com"
                  />
                </div>
              </div>
              {error && (
                <div className="text-sm text-negative bg-negative/5 border border-negative/20 rounded-lg px-3 py-2">
                  {error}
                </div>
              )}
              <button type="submit" className="btn-primary w-full" disabled={busy}>
                {busy ? '…' : t('auth.sendLink')}
              </button>
            </form>
          )}
        </div>
      </main>
    </div>
  );
}
