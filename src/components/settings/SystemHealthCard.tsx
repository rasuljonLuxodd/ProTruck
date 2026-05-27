import { useEffect, useState } from 'react';
import { CheckCircle2, AlertTriangle, RefreshCw, Database, Wifi, WifiOff, Server } from 'lucide-react';
import { supabase } from '@/data/supabaseClient';
import { useT } from '@/i18n/LanguageProvider';
import { cn } from '@/lib/utils';

type Status = 'idle' | 'checking' | 'ok' | 'fail';

interface CheckRow {
  label: string;
  detail: string;
  status: Status;
  icon: typeof Database;
}

/**
 * Diagnostic card the super_admin can use to verify the app is talking
 * to Supabase correctly. Pings the configured project, reports the URL
 * + auth status + online flag.
 *
 * Pure read-only — calling refresh hits the DB but doesn't write
 * anything, so it's safe to spam.
 */
export function SystemHealthCard() {
  const t = useT();
  const [checks, setChecks] = useState<CheckRow[]>([]);
  const [running, setRunning] = useState(false);

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? 'not set';
  const backend = import.meta.env.VITE_BACKEND ?? 'supabase';

  async function runChecks() {
    setRunning(true);
    const rows: CheckRow[] = [];

    // 1) Online flag
    rows.push({
      label: t('sys.online'),
      detail: navigator.onLine ? t('sys.connected') : t('sys.offline'),
      status: navigator.onLine ? 'ok' : 'fail',
      icon: navigator.onLine ? Wifi : WifiOff,
    });

    // 2) Backend setting
    rows.push({
      label: t('sys.backend'),
      detail: backend,
      status: backend === 'supabase' ? 'ok' : 'fail',
      icon: Server,
    });

    // 3) Supabase URL
    rows.push({
      label: 'Supabase URL',
      detail: supabaseUrl,
      status: supabaseUrl.includes('supabase.co') ? 'ok' : 'fail',
      icon: Database,
    });

    setChecks([...rows]);

    // 4) Auth session
    const sessionRes = await supabase.auth.getSession();
    rows.push({
      label: t('sys.session'),
      detail: sessionRes.data.session
        ? `${sessionRes.data.session.user.email ?? 'authenticated'}`
        : t('sys.noSession'),
      status: sessionRes.data.session ? 'ok' : 'fail',
      icon: CheckCircle2,
    });
    setChecks([...rows]);

    // 5) Live DB ping — count profiles. If RLS is wired the request
    // succeeds and we get a number back; if anything's wrong we see
    // the error message.
    const start = performance.now();
    const pingRes = await supabase.from('profiles').select('id', { count: 'exact', head: true });
    const ms = Math.round(performance.now() - start);
    rows.push({
      label: t('sys.dbPing'),
      detail: pingRes.error ? pingRes.error.message : `${ms} ms`,
      status: pingRes.error ? 'fail' : 'ok',
      icon: pingRes.error ? AlertTriangle : CheckCircle2,
    });
    setChecks([...rows]);
    setRunning(false);
  }

  // Auto-run on mount so opening the section already shows fresh data.
  useEffect(() => { void runChecks(); /* eslint-disable-line react-hooks/exhaustive-deps */ }, []);

  const allOk = checks.length > 0 && checks.every(c => c.status === 'ok');

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="display text-[20px] leading-none flex items-center gap-2">
            <Server className="w-4 h-4" />
            {t('sys.title')}
          </h2>
          <p className="text-xs text-fg-muted mt-1.5 max-w-prose leading-relaxed">
            {t('sys.intro')}
          </p>
        </div>
        <button
          className="btn-secondary !text-xs"
          onClick={runChecks}
          disabled={running}
          title={t('sys.refresh')}
        >
          <RefreshCw className={cn('w-3.5 h-3.5', running && 'animate-spin')} />
          <span className="hidden sm:inline">{t('sys.refresh')}</span>
        </button>
      </div>

      {checks.length > 0 && (
        <div className={cn(
          'mb-3 flex items-center gap-2 px-3 py-2 rounded-lg border text-sm',
          allOk
            ? 'bg-positive/5 border-positive/30 text-positive'
            : 'bg-amber-500/5 border-amber-500/30 text-amber-700 dark:text-amber-400',
        )}>
          {allOk ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
          <span className="font-medium">
            {allOk ? t('sys.allOk') : t('sys.someFailing')}
          </span>
        </div>
      )}

      <ul className="space-y-1.5">
        {checks.map((c, i) => (
          <li
            key={i}
            className="flex items-center justify-between gap-3 px-3 py-2 bg-surface border border-border rounded-lg"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <c.icon className={cn(
                'w-4 h-4 shrink-0',
                c.status === 'ok'   && 'text-positive',
                c.status === 'fail' && 'text-negative',
                c.status === 'idle' && 'text-fg-subtle',
                c.status === 'checking' && 'text-fg-muted animate-pulse',
              )} />
              <span className="text-sm font-medium">{c.label}</span>
            </div>
            <span className="text-xs font-mono text-fg-muted truncate max-w-[60%]">{c.detail}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
