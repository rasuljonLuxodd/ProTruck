import { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';
import { useT } from '@/i18n/LanguageProvider';

/**
 * Lightweight PWA install prompt.
 *
 * Browsers fire `beforeinstallprompt` once they decide the site is
 * installable (HTTPS, manifest valid, SW registered, "engagement"
 * heuristics met). We stash the event, show a slim toast at the
 * bottom-right, and call `prompt()` when the user clicks Install.
 *
 * iOS Safari doesn't fire this event — there's no equivalent API, the
 * user has to do "Share → Add to Home Screen" manually. We don't try
 * to detect iOS here; we just stay quiet on platforms that don't fire
 * the event.
 *
 * Dismissals are remembered in localStorage so we don't pester someone
 * who decided not to install.
 */

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISS_KEY = 'protrack:installPromptDismissedAt';
const DISMISS_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 days

export function InstallPrompt() {
  const t = useT();
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const dismissedAt = Number(localStorage.getItem(DISMISS_KEY) ?? 0);
    const stale = dismissedAt && Date.now() - dismissedAt > DISMISS_TTL_MS;
    if (dismissedAt && !stale) return; // user said no recently

    function onPrompt(e: Event) {
      e.preventDefault();
      setPrompt(e as BeforeInstallPromptEvent);
      setOpen(true);
    }
    window.addEventListener('beforeinstallprompt', onPrompt);
    return () => window.removeEventListener('beforeinstallprompt', onPrompt);
  }, []);

  async function install() {
    if (!prompt) return;
    await prompt.prompt();
    const { outcome } = await prompt.userChoice;
    if (outcome === 'dismissed') {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    }
    setPrompt(null);
    setOpen(false);
  }

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setOpen(false);
  }

  if (!open || !prompt) return null;

  return (
    <div
      role="dialog"
      aria-label={t('install.title')}
      className="fixed z-40 bottom-4 right-4 left-4 md:left-auto md:max-w-sm card p-4 shadow-lg animate-slideIn no-print"
    >
      <div className="flex items-start gap-3">
        <div
          className="shrink-0 inline-flex items-center justify-center w-10 h-10 rounded-lg"
          style={{ background: 'rgb(var(--accent))', color: 'rgb(var(--accent-fg))' }}
        >
          <Download className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-sm">{t('install.title')}</h3>
          <p className="text-xs text-fg-muted mt-1 leading-relaxed">{t('install.body')}</p>
          <div className="mt-3 flex gap-2">
            <button onClick={install} className="btn-primary !text-xs !py-1.5">
              {t('install.cta')}
            </button>
            <button onClick={dismiss} className="btn-ghost !text-xs !py-1.5">
              {t('install.notNow')}
            </button>
          </div>
        </div>
        <button
          onClick={dismiss}
          aria-label={t('install.notNow')}
          className="text-fg-subtle hover:text-fg transition shrink-0"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
