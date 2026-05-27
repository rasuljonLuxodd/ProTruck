import type { Expense, Product, Sale, ExpenseCategory } from '@/types';

// ============================================================
// Smart expense category suggestions
// ============================================================

/**
 * Looks at past expenses and guesses the right category for a
 * description the user is typing. Used by the Expenses form: as the
 * cashier types "Elektr to'lovi", we suggest category=Elektr.
 *
 * Algorithm is intentionally simple:
 *   1. Normalize the input (lowercase, strip punctuation)
 *   2. For each past expense, compute a similarity score: substring
 *      match on tokens + Levenshtein-ish character overlap
 *   3. Pick the category whose past expenses have the highest score
 *
 * Returns null when nothing matches strongly enough — we'd rather
 * show no suggestion than the wrong one.
 */
export function suggestExpenseCategory(
  description: string,
  history: Expense[],
): ExpenseCategory | null {
  const q = normalize(description);
  if (q.length < 3 || history.length === 0) return null;

  // Tally scores per category
  const scores = new Map<ExpenseCategory, number>();
  for (const e of history) {
    const target = normalize(e.description);
    const s = similarity(q, target);
    if (s < 0.4) continue; // below confidence floor — skip
    scores.set(e.category, (scores.get(e.category) ?? 0) + s);
  }
  if (scores.size === 0) return null;

  let best: ExpenseCategory | null = null;
  let bestScore = 0;
  for (const [cat, score] of scores) {
    if (score > bestScore) { bestScore = score; best = cat; }
  }
  return best;
}

function normalize(s: string): string {
  return s.toLowerCase()
    .replace(/['ʻʼ]/g, '')        // strip Uzbek apostrophes
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Token-overlap + edit-distance hybrid similarity in [0, 1].
 * - Both strings get tokenized on whitespace.
 * - Score = (matched-token count / max-tokens) blended with
 *   (1 - normalized Levenshtein distance over full strings) at 60/40.
 *
 * Bias toward token matches keeps "Elektr to'lovi mart" finding
 * "Elektr to'lovi" without us depending on exact spelling.
 */
function similarity(a: string, b: string): number {
  if (!a || !b) return 0;
  const aTok = a.split(' ').filter(Boolean);
  const bTok = b.split(' ').filter(Boolean);
  if (aTok.length === 0 || bTok.length === 0) return 0;

  // token overlap
  const bSet = new Set(bTok);
  let matched = 0;
  for (const t of aTok) if (bSet.has(t)) matched++;
  const tokenScore = matched / Math.max(aTok.length, bTok.length);

  // edit distance
  const dist = levenshtein(a, b);
  const editScore = 1 - dist / Math.max(a.length, b.length);

  return tokenScore * 0.6 + editScore * 0.4;
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  const n = a.length;
  const m = b.length;
  if (n === 0) return m;
  if (m === 0) return n;
  // Use a single row of memory — O(min(n, m)) instead of O(n*m)
  let prev = new Array(m + 1).fill(0).map((_, i) => i);
  let cur = new Array(m + 1).fill(0);
  for (let i = 1; i <= n; i++) {
    cur[0] = i;
    for (let j = 1; j <= m; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(cur[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    [prev, cur] = [cur, prev];
  }
  return prev[m];
}

// ============================================================
// Demand forecasting → reorder hints
// ============================================================

export interface ReorderHint {
  productId: string;
  productName: string;
  currentStock: number;
  weeklyVelocity: number;  // avg units sold per week, last 4 weeks
  daysUntilStockout: number;
  urgency: 'low' | 'medium' | 'high';
}

/**
 * For each product, compute a 4-week moving-average velocity from sales
 * history and project when it will run out. Return only products that
 * would stock out within a configurable window (default 7 days) —
 * those are what the owner actually needs to act on.
 */
export function computeReorderHints(
  products: Product[],
  sales: Sale[],
  opts: { windowDays?: number; now?: Date } = {},
): ReorderHint[] {
  const windowDays = opts.windowDays ?? 7;
  const now = opts.now ?? new Date();
  const fourWeeksAgo = new Date(now);
  fourWeeksAgo.setDate(now.getDate() - 28);
  const fourWeeksMs = fourWeeksAgo.getTime();

  // Tally units sold per product over the last 28 days
  const unitsByProduct = new Map<string, number>();
  for (const s of sales) {
    const t = new Date(s.date).getTime();
    if (t < fourWeeksMs) continue;
    for (const item of s.items) {
      unitsByProduct.set(item.productId, (unitsByProduct.get(item.productId) ?? 0) + item.quantity);
    }
  }

  const hints: ReorderHint[] = [];
  for (const p of products) {
    const units28 = unitsByProduct.get(p.id) ?? 0;
    if (units28 === 0) continue;  // no recent sales = no forecast

    const weeklyVelocity = units28 / 4;
    const daysUntilStockout = weeklyVelocity > 0
      ? Math.floor((p.stock / weeklyVelocity) * 7)
      : Infinity;

    if (daysUntilStockout > windowDays) continue;

    const urgency: ReorderHint['urgency'] =
      daysUntilStockout <= 2 ? 'high' :
      daysUntilStockout <= 5 ? 'medium' :
      'low';

    hints.push({
      productId: p.id,
      productName: p.name,
      currentStock: p.stock,
      weeklyVelocity,
      daysUntilStockout,
      urgency,
    });
  }

  // Most urgent first
  hints.sort((a, b) => a.daysUntilStockout - b.daysUntilStockout);
  return hints;
}

// ============================================================
// Anomaly detection
// ============================================================

export interface Anomaly {
  type: 'duplicate_expense' | 'large_expense' | 'large_sale';
  severity: 'warn' | 'alert';
  message: string;
  /** ISO date of the suspicious record */
  date: string;
}

/**
 * Scan recent expenses and sales for things worth a second look:
 *   - Two near-identical expenses within 5 minutes (likely double-entry)
 *   - An expense more than 3× the 30-day average expense
 *   - A sale more than 3× the 30-day average sale
 *
 * Keep the rules simple and explainable. The owner can see why each
 * row was flagged — no opaque ML.
 */
export function detectAnomalies(
  expenses: Expense[],
  sales: Sale[],
  now: Date = new Date(),
): Anomaly[] {
  const out: Anomaly[] = [];
  const recentMs = now.getTime() - 30 * 86_400_000;

  // === duplicate expenses ===
  // Group by amount + first-word-of-description, then look for
  // entries within 5 minutes of each other.
  const sortedExp = [...expenses]
    .filter(e => new Date(e.date).getTime() >= recentMs)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  for (let i = 1; i < sortedExp.length; i++) {
    const a = sortedExp[i - 1];
    const b = sortedExp[i];
    const gap = new Date(b.date).getTime() - new Date(a.date).getTime();
    if (gap > 5 * 60 * 1000) continue;
    if (a.amount !== b.amount) continue;
    const aKey = (a.description ?? '').toLowerCase().slice(0, 12);
    const bKey = (b.description ?? '').toLowerCase().slice(0, 12);
    if (aKey === bKey) {
      out.push({
        type: 'duplicate_expense',
        severity: 'warn',
        message: `${a.description} — ${a.amount}`,
        date: b.date,
      });
    }
  }

  // === outlier expenses ===
  const recentExp = expenses.filter(e => new Date(e.date).getTime() >= recentMs);
  if (recentExp.length >= 5) {
    const avg = recentExp.reduce((s, e) => s + e.amount, 0) / recentExp.length;
    const threshold = avg * 3;
    for (const e of recentExp) {
      if (e.amount > threshold) {
        out.push({
          type: 'large_expense',
          severity: 'alert',
          message: `${e.description} — ${e.amount}`,
          date: e.date,
        });
      }
    }
  }

  // === outlier sales ===
  const recentSales = sales.filter(s => new Date(s.date).getTime() >= recentMs);
  if (recentSales.length >= 5) {
    const avg = recentSales.reduce((s, x) => s + x.total, 0) / recentSales.length;
    const threshold = avg * 3;
    for (const s of recentSales) {
      if (s.total > threshold) {
        out.push({
          type: 'large_sale',
          severity: 'warn',
          message: `${s.customerName} — ${s.total}`,
          date: s.date,
        });
      }
    }
  }

  // Most recent first
  out.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  return out;
}
