import { useEffect, useState, type FormEvent } from 'react';
import { Shield, ShieldCheck, Loader2 } from 'lucide-react';
import { supabase } from '@/data/supabaseClient';
import { useT } from '@/i18n/LanguageProvider';
import { useToast } from '@/components/ui/Toast';

interface Factor {
  id: string;
  status: 'verified' | 'unverified';
  factor_type: 'totp' | 'phone';
  friendly_name?: string;
}

/**
 * TOTP enrollment using Supabase MFA. Three states:
 * 1. No factor → "Enable" button (calls enroll → returns QR)
 * 2. Unverified factor → show QR + code input → verify
 * 3. Verified factor → "Disable" button
 */
export function TwoFactorSection() {
  const t = useT();
  const { toast } = useToast();
  const [factors, setFactors] = useState<Factor[]>([]);
  const [loading, setLoading] = useState(true);

  // Enrollment state
  const [enrolling, setEnrolling] = useState(false);
  const [qr, setQr] = useState<string | null>(null);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [verifying, setVerifying] = useState(false);

  async function load() {
    setLoading(true);
    const { data } = await supabase.auth.mfa.listFactors();
    // Supabase types are loose here; cast.
    const all = (data?.all as unknown as Factor[]) ?? [];
    setFactors(all);
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, []);

  const verified = factors.find(f => f.status === 'verified');

  async function startEnroll() {
    setEnrolling(true);
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp' });
    setEnrolling(false);
    if (error || !data) {
      toast(error?.message ?? t('toast.error'), 'error');
      return;
    }
    setFactorId(data.id);
    setQr(data.totp.qr_code);
  }

  async function verify(e: FormEvent) {
    e.preventDefault();
    if (!factorId) return;
    setVerifying(true);
    const { data: chal, error: chalErr } = await supabase.auth.mfa.challenge({ factorId });
    if (chalErr || !chal) {
      setVerifying(false);
      toast(chalErr?.message ?? t('toast.error'), 'error');
      return;
    }
    const { error: verErr } = await supabase.auth.mfa.verify({
      factorId,
      challengeId: chal.id,
      code,
    });
    setVerifying(false);
    if (verErr) {
      toast(t('set.mfaInvalid'), 'error');
      return;
    }
    setFactorId(null);
    setQr(null);
    setCode('');
    toast(t('toast.saved'));
    await load();
  }

  async function disable() {
    if (!verified) return;
    const { error } = await supabase.auth.mfa.unenroll({ factorId: verified.id });
    if (error) {
      toast(error.message, 'error');
      return;
    }
    toast(t('toast.saved'));
    await load();
  }

  return (
    <div className="card p-6">
      <div className="flex items-start gap-3 mb-5">
        <div className="w-9 h-9 rounded-lg bg-surface-2 border border-border flex items-center justify-center shrink-0">
          {verified
            ? <ShieldCheck className="w-4 h-4 text-positive" />
            : <Shield className="w-4 h-4 text-fg-muted" />
          }
        </div>
        <div className="flex-1">
          <h2 className="text-base font-semibold tracking-tight">{t('set.mfaTitle')}</h2>
          <p className="text-sm text-fg-muted mt-0.5">{t('set.mfaDesc')}</p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-fg-muted">
          <Loader2 className="w-4 h-4 animate-spin" />
        </div>
      ) : verified ? (
        <div className="flex items-center justify-between">
          <span className="text-sm text-positive">{t('set.mfaActive')}</span>
          <button className="btn-secondary" onClick={disable}>
            {t('set.mfaDisable')}
          </button>
        </div>
      ) : qr ? (
        <form onSubmit={verify} className="space-y-4">
          <div className="bg-white p-3 rounded-lg inline-block">
            <img src={qr} alt="QR" width={180} height={180} />
          </div>
          <p className="text-xs text-fg-muted">{t('set.mfaScan')}</p>
          <div>
            <label className="label">{t('set.mfaCode')}</label>
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              required
              className="input tnum"
              value={code}
              onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
              placeholder="123456"
            />
          </div>
          <button type="submit" className="btn-primary" disabled={verifying || code.length !== 6}>
            {verifying ? '…' : t('set.mfaVerify')}
          </button>
        </form>
      ) : (
        <button className="btn-primary" onClick={startEnroll} disabled={enrolling}>
          {enrolling ? '…' : t('set.mfaEnable')}
        </button>
      )}
    </div>
  );
}
