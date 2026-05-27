import { useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Download, Upload, Database, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useT } from '@/i18n/LanguageProvider';
import { useToast } from '@/components/ui/Toast';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { SystemHealthCard } from '@/components/settings/SystemHealthCard';
import {
  exportAllData, downloadBackup, readBackupFile, importAllData,
  type BackupFile, type ImportSummary,
} from '@/lib/backup';

/**
 * Backup & restore UI. Lives in Settings → Backup (super_admin only).
 *
 * Export: pulls every table, packages as JSON with a schema-version
 * marker, downloads as `protrack-backup-YYYY-MM-DD.json`.
 *
 * Import: reads a backup JSON, UPSERTs into each table (so existing rows
 * with the same id get overwritten, rows not in the backup are left
 * untouched). Wrapped in a confirm dialog because even a merge import
 * can clobber edits made since the backup was taken.
 */
export function BackupSection() {
  const t = useT();
  const { toast } = useToast();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [pending, setPending] = useState<BackupFile | null>(null);
  const [summary, setSummary] = useState<ImportSummary | null>(null);

  async function handleExport() {
    setExporting(true);
    try {
      const file = await exportAllData(import.meta.env.VITE_APP_VERSION ?? 'dev');
      downloadBackup(file);
      toast(t('backup.exportDone'));
    } catch (err) {
      toast(err instanceof Error ? err.message : t('toast.error'), 'error');
    } finally {
      setExporting(false);
    }
  }

  function pickFile() {
    fileRef.current?.click();
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      const parsed = await readBackupFile(f);
      setPending(parsed);
    } catch (err) {
      toast(err instanceof Error ? err.message : t('backup.invalidFile'), 'error');
    } finally {
      // clear input so the same file can be re-selected
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function confirmRestore() {
    if (!pending) return;
    setImporting(true);
    try {
      const result = await importAllData(pending);
      setSummary(result);
      // every query is now potentially stale
      qc.invalidateQueries();
      if (result.errors.length === 0) {
        toast(t('backup.importDone'));
      } else {
        toast(t('backup.importPartial'), 'error');
      }
    } catch (err) {
      toast(err instanceof Error ? err.message : t('toast.error'), 'error');
    } finally {
      setImporting(false);
      setPending(null);
    }
  }

  // Quick counts for the confirm dialog message
  const pendingCount = pending
    ? Object.values(pending.data).reduce((s, arr) => s + (Array.isArray(arr) ? arr.length : 0), 0)
    : 0;
  const pendingDate = pending ? pending.createdAt.slice(0, 19).replace('T', ' ') : '';

  return (
    <div className="space-y-4">
      <SystemHealthCard />

      <header>
        <h1 className="display text-[20px] leading-none flex items-center gap-2">
          <Database className="w-5 h-5" />
          {t('backup.title')}
        </h1>
        <p className="text-sm text-fg-muted mt-1.5 max-w-prose leading-relaxed">
          {t('backup.intro')}
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Export */}
        <div className="card p-5">
          <div className="flex items-start gap-3 mb-3">
            <div className="icon-chip">
              <Download className="w-4 h-4" />
            </div>
            <div className="flex-1">
              <h2 className="font-semibold">{t('backup.exportTitle')}</h2>
              <p className="text-xs text-fg-muted mt-1 leading-relaxed">
                {t('backup.exportDesc')}
              </p>
            </div>
          </div>
          <button
            onClick={handleExport}
            disabled={exporting}
            className="btn-primary w-full"
          >
            <Download className="w-3.5 h-3.5" />
            {exporting ? '…' : t('backup.exportNow')}
          </button>
        </div>

        {/* Import */}
        <div className="card p-5">
          <div className="flex items-start gap-3 mb-3">
            <div className="icon-chip">
              <Upload className="w-4 h-4" />
            </div>
            <div className="flex-1">
              <h2 className="font-semibold">{t('backup.importTitle')}</h2>
              <p className="text-xs text-fg-muted mt-1 leading-relaxed">
                {t('backup.importDesc')}
              </p>
            </div>
          </div>
          <button
            onClick={pickFile}
            disabled={importing}
            className="btn-secondary w-full"
          >
            <Upload className="w-3.5 h-3.5" />
            {importing ? '…' : t('backup.chooseFile')}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            onChange={onFile}
            className="hidden"
          />
        </div>
      </div>

      {/* Last import summary */}
      {summary && (
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-3">
            {summary.errors.length === 0 ? (
              <CheckCircle2 className="w-4 h-4 text-positive" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-amber-500" />
            )}
            <h2 className="font-semibold">{t('backup.summaryTitle')}</h2>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>{t('backup.colTable')}</th>
                <th className="text-right">{t('backup.colImported')}</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(summary.applied).map(([table, count]) => (
                <tr key={table}>
                  <td className="font-mono text-xs">{table}</td>
                  <td className="text-right font-mono tnum">{count}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {summary.errors.length > 0 && (
            <ul className="mt-3 space-y-1 text-xs text-negative">
              {summary.errors.map((e, i) => (
                <li key={i}>
                  <span className="font-mono">{e.table}</span>: {e.message}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <ConfirmDialog
        open={!!pending}
        title={t('backup.confirmTitle')}
        message={
          pending
            ? t('backup.confirmMessage')
                .replace('{count}', String(pendingCount))
                .replace('{date}', pendingDate)
            : ''
        }
        onConfirm={confirmRestore}
        onCancel={() => setPending(null)}
      />
    </div>
  );
}
