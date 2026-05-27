import { supabase } from '@/data/supabaseClient';

/**
 * Tables that get included in a backup. Order matters for restore: parents
 * before children, so foreign keys resolve. (We use UPSERT which doesn't
 * strictly require ordering, but keeping it tidy makes debugging easier.)
 *
 * We intentionally DO NOT back up:
 *   - profiles (auth-managed, would clash with auth.users)
 *   - settings (per-user, not business data)
 */
const TABLES = [
  'products',
  'workers',
  'suppliers',
  'customer_credit_limits',
  'recurring_expenses',
  'production_logs',
  'bom_items',
  'sales',
  'debts',
  'debt_payments',
  'expenses',
  'worker_payments',
  'worker_attendance',
  'action_logs',
] as const;

type TableName = typeof TABLES[number];

const SCHEMA_VERSION = 2;

export interface BackupFile {
  schemaVersion: number;
  createdAt: string;
  appVersion: string;
  /** Each key is a table name, value is an array of rows (snake_case). */
  data: Record<TableName, unknown[]>;
}

/**
 * Pull every table down and bundle it into a single JSON object. We use
 * a generous default range to avoid Supabase's PostgREST 1000-row limit
 * silently truncating large backups.
 */
export async function exportAllData(appVersion = 'dev'): Promise<BackupFile> {
  const data = {} as Record<TableName, unknown[]>;
  for (const table of TABLES) {
    const { data: rows, error } = await supabase
      .from(table)
      .select('*')
      .range(0, 999_999);
    if (error) {
      throw new Error(`Failed to export ${table}: ${error.message}`);
    }
    data[table] = rows ?? [];
  }
  return {
    schemaVersion: SCHEMA_VERSION,
    createdAt: new Date().toISOString(),
    appVersion,
    data,
  };
}

/** Triggers a browser download of the backup as `protrack-YYYY-MM-DD.json`. */
export function downloadBackup(file: BackupFile): void {
  const blob = new Blob([JSON.stringify(file, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const slug = file.createdAt.slice(0, 10);
  const a = document.createElement('a');
  a.href = url;
  a.download = `protrack-backup-${slug}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export interface ImportSummary {
  /** Rows successfully merged per table. */
  applied: Record<string, number>;
  /** Tables that errored (e.g. partial import). */
  errors: Array<{ table: string; message: string }>;
}

/**
 * Restore from a backup. Uses UPSERT by primary key so importing is
 * non-destructive: existing rows with the same id get overwritten, but
 * rows not in the backup are left untouched. That's deliberately
 * conservative — a full destructive restore would need an RPC with
 * service-role privileges, which is out of scope for v1.
 *
 * Callers should wrap this in a confirm dialog.
 */
export async function importAllData(file: BackupFile): Promise<ImportSummary> {
  if (!file || typeof file !== 'object' || !file.data) {
    throw new Error('invalid_backup_file');
  }
  if (file.schemaVersion > SCHEMA_VERSION) {
    throw new Error(`backup_too_new (schema ${file.schemaVersion}, app expects ≤${SCHEMA_VERSION})`);
  }

  const applied: Record<string, number> = {};
  const errors: ImportSummary['errors'] = [];

  for (const table of TABLES) {
    const rows = file.data[table];
    if (!Array.isArray(rows) || rows.length === 0) {
      applied[table] = 0;
      continue;
    }
    // Chunk to keep the request size sane for large datasets
    const CHUNK = 500;
    let success = 0;
    for (let i = 0; i < rows.length; i += CHUNK) {
      const slice = rows.slice(i, i + CHUNK);
      const { error } = await supabase
        .from(table)
        .upsert(slice, { onConflict: 'id', ignoreDuplicates: false });
      if (error) {
        errors.push({ table, message: error.message });
        break;
      }
      success += slice.length;
    }
    applied[table] = success;
  }

  return { applied, errors };
}

/**
 * Parse a File object as a backup. Throws on invalid JSON or wrong shape.
 */
export async function readBackupFile(f: File): Promise<BackupFile> {
  const text = await f.text();
  const parsed = JSON.parse(text);
  if (typeof parsed.schemaVersion !== 'number' || !parsed.data) {
    throw new Error('invalid_backup_file');
  }
  return parsed as BackupFile;
}
