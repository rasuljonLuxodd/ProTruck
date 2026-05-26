import { Link } from 'react-router-dom';
import { Check, ArrowRight, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useT } from '@/i18n/LanguageProvider';

export interface OnboardingStep {
  /** translation key for the step label */
  labelKey: 'welcome.step1' | 'welcome.step2' | 'welcome.step3' | 'welcome.step4';
  descKey:  'welcome.step1Desc' | 'welcome.step2Desc' | 'welcome.step3Desc' | 'welcome.step4Desc';
  to: string;
  done: boolean;
  icon: LucideIcon;
}

interface Props {
  steps: OnboardingStep[];
}

/**
 * First-run experience for the Dashboard. Replaces the four-zeros card grid
 * with a guided checklist when the user hasn't done anything yet. Steps mark
 * themselves complete as data exists for each entity.
 */
export function OnboardingChecklist({ steps }: Props) {
  const t = useT();
  const completed = steps.filter(s => s.done).length;
  const total = steps.length;
  const allDone = completed === total;
  const progressPct = (completed / total) * 100;

  return (
    <div className="card overflow-hidden">
      <div className="px-6 pt-6 pb-5 border-b border-border">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-xl font-semibold tracking-tight">
              {allDone ? t('welcome.complete') : t('welcome.title')}
            </h2>
            <p className="mt-1 text-sm text-fg-muted">{t('welcome.subtitle')}</p>
          </div>
          <div className="text-right tnum shrink-0">
            <div className="text-xs text-fg-muted">{t('welcome.progress')}</div>
            <div className="text-2xl font-semibold mt-0.5">{completed}<span className="text-fg-subtle">/{total}</span></div>
          </div>
        </div>
        <div className="mt-4 h-1.5 bg-surface-2 rounded-full overflow-hidden">
          <div
            className={cn(
              'h-full transition-all duration-500',
              allDone ? 'bg-positive' : 'bg-fg',
            )}
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      <ol>
        {steps.map((s, i) => (
          <li
            key={s.labelKey}
            className={cn(
              'border-b border-border last:border-0 transition',
              s.done && 'bg-surface/60',
            )}
          >
            <Link
              to={s.to}
              className="flex items-start gap-4 px-6 py-4 hover:bg-surface transition group"
            >
              <span
                className={cn(
                  'mt-0.5 w-7 h-7 rounded-full border flex items-center justify-center shrink-0 transition',
                  s.done
                    ? 'bg-positive border-positive text-white'
                    : 'bg-bg border-border text-fg-muted',
                )}
              >
                {s.done ? <Check className="w-3.5 h-3.5" /> : <span className="text-xs font-semibold tnum">{i + 1}</span>}
              </span>
              <div className="flex-1 min-w-0">
                <div className={cn('text-sm font-medium', s.done && 'text-fg-muted line-through decoration-fg-subtle')}>
                  {t(s.labelKey)}
                </div>
                <div className="text-xs text-fg-muted mt-0.5">{t(s.descKey)}</div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <s.icon className={cn('w-4 h-4', s.done ? 'text-fg-subtle' : 'text-fg-muted')} />
                <ArrowRight
                  className={cn(
                    'w-4 h-4 transition',
                    s.done ? 'text-fg-subtle' : 'text-fg-muted group-hover:text-fg group-hover:translate-x-0.5',
                  )}
                />
              </div>
            </Link>
          </li>
        ))}
      </ol>
    </div>
  );
}
