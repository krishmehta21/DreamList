import { supabase } from './supabase';

// ─── Period types ─────────────────────────────────────────────────────────────
export type PeriodMode = 'month' | '3m' | '6m' | 'ytd';

export interface PeriodRange {
  start: string; // YYYY-MM-DD
  end: string;   // YYYY-MM-DD
  months: string[]; // ['2026-07', '2026-06', ...] in desc order
  label: string;
}

/** Compute start/end dates and month list for a given period mode + anchor month */
export function getPeriodRange(mode: PeriodMode, anchorMonth: string): PeriodRange {
  const [anchorYear, anchorMonthNum] = anchorMonth.split('-').map(Number);
  const anchorEnd = new Date(anchorYear, anchorMonthNum, 0); // last day of anchor month
  const end = `${anchorYear}-${String(anchorMonthNum).padStart(2, '0')}-${String(anchorEnd.getDate()).padStart(2, '0')}`;

  let startDate: Date;
  let label: string;

  if (mode === 'month') {
    startDate = new Date(anchorYear, anchorMonthNum - 1, 1);
    label = new Date(anchorYear, anchorMonthNum - 1, 1)
      .toLocaleString('default', { month: 'long', year: 'numeric' })
      .toUpperCase();
  } else if (mode === '3m') {
    startDate = new Date(anchorYear, anchorMonthNum - 3, 1);
    label = 'LAST 3 MONTHS';
  } else if (mode === '6m') {
    startDate = new Date(anchorYear, anchorMonthNum - 6, 1);
    label = 'LAST 6 MONTHS';
  } else {
    // YTD
    startDate = new Date(anchorYear, 0, 1);
    label = `YTD ${anchorYear}`;
  }

  const start = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}-01`;

  // Build months array (desc)
  const months: string[] = [];
  let cur = new Date(anchorYear, anchorMonthNum - 1, 1);
  const startM = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
  while (cur >= startM) {
    months.push(`${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}`);
    cur = new Date(cur.getFullYear(), cur.getMonth() - 1, 1);
  }

  return { start, end, months, label };
}

// ─── Lightweight transaction row for aggregation (no join) ────────────────────
export interface TxLite {
  category_id: string;
  type: 'expense' | 'income';
  amount: number;
  occurred_at: string;
}

/**
 * Fetch lightweight transaction rows for a date range.
 * Selects only 4 columns — no category join — for fast multi-month aggregation.
 */
export async function fetchTransactionsForRange(start: string, end: string): Promise<TxLite[]> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('transactions')
    .select('category_id, type, amount, occurred_at')
    .eq('user_id', session.user.id)
    .gte('occurred_at', start)
    .lte('occurred_at', end)
    .order('occurred_at', { ascending: true });

  if (error) throw error;
  return (data || []).map(r => ({ ...r, amount: Number(r.amount) }));
}

// ─── Aggregation helpers (pure functions, memoizable at call site) ────────────

export interface CategoryStat {
  category_id: string;
  total: number;
  count: number;
  pct: number; // 0–100
  transactions: TxLite[];
}

export interface PeriodStats {
  totalExpenses: number;
  totalIncome: number;
  net: number;
  avgDailySpend: number;
  daysInPeriod: number;
  categoryStats: CategoryStat[];     // expense categories only, sorted desc
  dailyTotals: { date: string; total: number }[]; // expense totals per day
  byMonth: { month: string; expenses: number; income: number }[]; // for trend charts
  topFrequencyCategory: string | null; // category_id with most transactions
  incomeExpenseRatio: number | null;   // expenses/income * 100, null if no income
}

export function computePeriodStats(
  txns: TxLite[],
  range: PeriodRange
): PeriodStats {
  const expenses = txns.filter(t => t.type === 'expense');
  const income   = txns.filter(t => t.type === 'income');

  const totalExpenses = expenses.reduce((s, t) => s + t.amount, 0);
  const totalIncome   = income.reduce((s, t) => s + t.amount, 0);
  const net = totalIncome - totalExpenses;

  // Days elapsed in period (up to today)
  const today = new Date();
  const periodEnd = new Date(range.end);
  const periodStart = new Date(range.start);
  const effectiveEnd = today < periodEnd ? today : periodEnd;
  const daysElapsed = Math.max(1, Math.ceil((effectiveEnd.getTime() - periodStart.getTime()) / 86400000) + 1);
  const avgDailySpend = totalExpenses / daysElapsed;

  // Category stats (expenses only)
  const catMap: Record<string, { total: number; count: number; transactions: TxLite[] }> = {};
  expenses.forEach(t => {
    if (!catMap[t.category_id]) catMap[t.category_id] = { total: 0, count: 0, transactions: [] };
    catMap[t.category_id].total += t.amount;
    catMap[t.category_id].count += 1;
    catMap[t.category_id].transactions.push(t);
  });
  const categoryStats: CategoryStat[] = Object.entries(catMap)
    .map(([category_id, { total, count, transactions }]) => ({
      category_id,
      total,
      count,
      pct: totalExpenses > 0 ? (total / totalExpenses) * 100 : 0,
      transactions,
    }))
    .sort((a, b) => b.total - a.total);

  // Most frequent category (by transaction count)
  const topFrequencyCategory = categoryStats.length > 0
    ? categoryStats.reduce((max, c) => c.count > max.count ? c : max, categoryStats[0]).category_id
    : null;

  // Daily expense totals
  const dayMap: Record<string, number> = {};
  expenses.forEach(t => {
    dayMap[t.occurred_at] = (dayMap[t.occurred_at] || 0) + t.amount;
  });
  const dailyTotals = Object.entries(dayMap)
    .map(([date, total]) => ({ date, total }))
    .sort((a, b) => a.date.localeCompare(b.date));

  // By-month totals (for trend chart, uses months from range)
  const byMonth = range.months
    .slice()
    .reverse() // asc for chart
    .map(month => {
      const monthExpenses = expenses
        .filter(t => t.occurred_at.startsWith(month))
        .reduce((s, t) => s + t.amount, 0);
      const monthIncome = income
        .filter(t => t.occurred_at.startsWith(month))
        .reduce((s, t) => s + t.amount, 0);
      return { month, expenses: monthExpenses, income: monthIncome };
    });

  const incomeExpenseRatio = totalIncome > 0
    ? (totalExpenses / totalIncome) * 100
    : null;

  return {
    totalExpenses,
    totalIncome,
    net,
    avgDailySpend,
    daysInPeriod: daysElapsed,
    categoryStats,
    dailyTotals,
    byMonth,
    topFrequencyCategory,
    incomeExpenseRatio,
  };
}

/**
 * Compute month-over-month category change.
 * Returns the category that moved the most (% change) between current and prior month.
 */
export function computeMoMChange(
  currentStats: CategoryStat[],
  priorStats: CategoryStat[]
): { category_id: string; pctChange: number; direction: 'up' | 'down' } | null {
  if (currentStats.length === 0) return null;

  const priorMap: Record<string, number> = {};
  priorStats.forEach(c => { priorMap[c.category_id] = c.total; });

  let bestChange: { category_id: string; pctChange: number; direction: 'up' | 'down' } | null = null;

  currentStats.forEach(c => {
    const prior = priorMap[c.category_id] ?? 0;
    if (prior === 0 && c.total === 0) return;
    const pctChange = prior === 0 ? 100 : ((c.total - prior) / prior) * 100;
    const absPct = Math.abs(pctChange);
    if (!bestChange || absPct > Math.abs(bestChange.pctChange)) {
      bestChange = {
        category_id: c.category_id,
        pctChange,
        direction: pctChange >= 0 ? 'up' : 'down',
      };
    }
  });

  return bestChange;
}
