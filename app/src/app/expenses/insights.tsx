import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Alert,
  LayoutAnimation,
  UIManager,
  Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import Reanimated, { SharedValue, useAnimatedStyle } from 'react-native-reanimated';
import { supabase } from '@/lib/supabase';
import { PieChart, BarChart } from 'react-native-gifted-charts';
import { DL, DLFonts } from '@/constants/design';
import {
  fetchCategories,
  deleteTransaction,
  ExpenseCategory,
  Transaction,
} from '@/lib/expensesApi';
import {
  getPeriodRange,
  fetchTransactionsForRange,
  computePeriodStats,
  computeMoMChange,
  PeriodMode,
  PeriodRange,
  TxLite,
  PeriodStats,
} from '@/lib/insightsApi';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// ─── Constants ────────────────────────────────────────────────────────────────
const INCOME_COLOR  = '#22C55E';
const EXPENSE_COLOR = '#EF4444';
const ACCENT        = '#8B7CFF';

const CHART_COLORS = [
  '#8B7CFF', '#F59E0B', '#3B82F6', '#EC4899',
  '#10B981', '#EF4444', '#A78BFA', '#06B6D4',
  '#84CC16', '#F97316',
];

const PERIOD_MODES: { key: PeriodMode; label: string }[] = [
  { key: 'month', label: 'MONTH' },
  { key: '3m',    label: '3M'    },
  { key: '6m',    label: '6M'    },
  { key: 'ytd',   label: 'YTD'   },
];

// ─── Demo mode fallback ────────────────────────────────────────────────────────
const DEMO_CATEGORIES: ExpenseCategory[] = [
  { id: 'cat-1', name: 'Food',      icon: 'Utensils', color: '#F59E0B', is_default: true, type: 'expense', user_id: null, created_at: '' },
  { id: 'cat-2', name: 'Transport', icon: 'Car',      color: '#3B82F6', is_default: true, type: 'expense', user_id: null, created_at: '' },
  { id: 'cat-3', name: 'Bills',     icon: 'CreditCard',color: '#EF4444',is_default: true, type: 'expense', user_id: null, created_at: '' },
  { id: 'cat-6', name: 'Health',    icon: 'Heart',    color: '#10B981', is_default: true, type: 'expense', user_id: null, created_at: '' },
  { id: 'cat-7', name: 'Other',     icon: 'Coins',    color: '#6B7280', is_default: true, type: 'expense', user_id: null, created_at: '' },
];

// ─── Swipe delete action ──────────────────────────────────────────────────────
function DeleteAction({
  drag,
  onDelete,
}: {
  drag: SharedValue<number>;
  onDelete: () => void;
}) {
  const styleAnim = useAnimatedStyle(() => ({
    transform: [{ translateX: drag.value + 72 }],
  }));
  return (
    <Reanimated.View style={[sStyles.deleteAction, styleAnim]}>
      <Pressable style={sStyles.deleteActionInner} onPress={onDelete}>
        <Text style={sStyles.deleteActionIcon}>🗑</Text>
        <Text style={sStyles.deleteActionText}>DELETE</Text>
      </Pressable>
    </Reanimated.View>
  );
}

// ─── Main screen ─────────────────────────────────────────────────────────────
export default function InsightsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams();

  // Anchor month — passed from Ledger via route param, else current month
  const initialMonth = useMemo(() => {
    if (params.month && typeof params.month === 'string') return params.month;
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }, [params.month]);

  const [anchorMonth,  setAnchorMonth]  = useState(initialMonth);
  const [periodMode,   setPeriodMode]   = useState<PeriodMode>('month');
  const [loading,      setLoading]      = useState(true);
  const [isDemoMode,   setIsDemoMode]   = useState(false);

  // Data
  const [categories,    setCategories]    = useState<ExpenseCategory[]>([]);
  const [txLite,        setTxLite]        = useState<TxLite[]>([]);
  const [priorTxLite,   setPriorTxLite]   = useState<TxLite[]>([]); // prior month for MoM
  const [drillTxns,     setDrillTxns]     = useState<Transaction[]>([]); // full rows for drill-down

  // UI state
  const [expandedCategoryId, setExpandedCategoryId] = useState<string | null>(null);
  const swipeableRefs = useRef<Record<string, any>>({});

  // ─── Computed period range ──────────────────────────────────────────────────
  const periodRange: PeriodRange = useMemo(
    () => getPeriodRange(periodMode, anchorMonth),
    [periodMode, anchorMonth]
  );

  // Prior month range (always single month, for MoM)
  const priorMonthRange: PeriodRange = useMemo(() => {
    const [y, m] = anchorMonth.split('-').map(Number);
    const prior = new Date(y, m - 2, 1);
    const priorStr = `${prior.getFullYear()}-${String(prior.getMonth() + 1).padStart(2, '0')}`;
    return getPeriodRange('month', priorStr);
  }, [anchorMonth]);

  // ─── Load data ──────────────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [cats, txns, priorTxns] = await Promise.all([
        fetchCategories('expense'),
        fetchTransactionsForRange(periodRange.start, periodRange.end),
        fetchTransactionsForRange(priorMonthRange.start, priorMonthRange.end),
      ]);
      setCategories(cats);
      setTxLite(txns);
      setPriorTxLite(priorTxns);
      setIsDemoMode(false);
    } catch (err: any) {
      console.error('Insights load failed:', err);
      setIsDemoMode(true);
      setCategories(DEMO_CATEGORIES);
      // Demo data
      setTxLite([
        { category_id: 'cat-1', type: 'expense', amount: 4200, occurred_at: `${anchorMonth}-05` },
        { category_id: 'cat-1', type: 'expense', amount: 890,  occurred_at: `${anchorMonth}-12` },
        { category_id: 'cat-1', type: 'expense', amount: 320,  occurred_at: `${anchorMonth}-20` },
        { category_id: 'cat-3', type: 'expense', amount: 15000,occurred_at: `${anchorMonth}-01` },
        { category_id: 'cat-3', type: 'expense', amount: 590,  occurred_at: `${anchorMonth}-01` },
        { category_id: 'cat-2', type: 'expense', amount: 444,  occurred_at: `${anchorMonth}-03` },
        { category_id: 'cat-2', type: 'expense', amount: 238,  occurred_at: `${anchorMonth}-08` },
        { category_id: 'cat-7', type: 'expense', amount: 280,  occurred_at: `${anchorMonth}-10` },
        { category_id: 'cat-7', type: 'income',  amount: 32000,occurred_at: `${anchorMonth}-01` },
      ]);
      setPriorTxLite([]);
    } finally {
      setLoading(false);
    }
  }, [periodRange.start, periodRange.end, priorMonthRange.start, priorMonthRange.end, anchorMonth]);

  useEffect(() => { loadData(); }, [loadData]);

  // ─── Computed stats (memoized, only recomputes when data or range changes) ──
  const stats: PeriodStats = useMemo(
    () => computePeriodStats(txLite, periodRange),
    [txLite, periodRange]
  );

  const priorStats = useMemo(
    () => computePeriodStats(priorTxLite, priorMonthRange),
    [priorTxLite, priorMonthRange]
  );

  const momChange = useMemo(
    () => computeMoMChange(stats.categoryStats, priorStats.categoryStats),
    [stats.categoryStats, priorStats.categoryStats]
  );

  // ─── Category lookup map ───────────────────────────────────────────────────
  const catMap = useMemo(() => {
    const m: Record<string, ExpenseCategory> = {};
    categories.forEach(c => { m[c.id] = c; });
    return m;
  }, [categories]);

  // ─── Month navigation (only for MONTH mode) ────────────────────────────────
  const handlePrevMonth = () => {
    const [y, m] = anchorMonth.split('-').map(Number);
    const prev = new Date(y, m - 2, 1);
    setAnchorMonth(`${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`);
    setExpandedCategoryId(null);
  };
  const handleNextMonth = () => {
    const [y, m] = anchorMonth.split('-').map(Number);
    const next = new Date(y, m, 1);
    setAnchorMonth(`${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`);
    setExpandedCategoryId(null);
  };

  // ─── Drill-down — load full transaction rows for a category ───────────────
  const handleToggleCategory = useCallback(async (catId: string) => {
    if (expandedCategoryId === catId) {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setExpandedCategoryId(null);
      setDrillTxns([]);
      return;
    }
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedCategoryId(catId);
    setDrillTxns([]); // reset while loading

    if (isDemoMode) return;

    // Fetch full transaction rows for this category in the period
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data, error } = await supabase
        .from('transactions')
        .select('*, category:expense_categories(*)')
        .eq('user_id', session.user.id)
        .eq('category_id', catId)
        .eq('type', 'expense')
        .gte('occurred_at', periodRange.start)
        .lte('occurred_at', periodRange.end)
        .order('occurred_at', { ascending: false });

      if (!error && data) setDrillTxns(data as Transaction[]);
    } catch (e) {
      console.error('Drill-down fetch failed:', e);
    }
  }, [expandedCategoryId, isDemoMode, periodRange]);

  // ─── Swipe-to-delete in drill-down ────────────────────────────────────────
  const handleDeleteDrillTx = useCallback((tx: Transaction) => {
    swipeableRefs.current[tx.id]?.close();
    const label = tx.note || tx.category?.name || 'Transaction';
    Alert.alert(
      'Delete Transaction?',
      `"${label}" — ₹${Number(tx.amount).toFixed(2)}\n\nThis cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDrillTxns(prev => prev.filter(t => t.id !== tx.id));
            setTxLite(prev => prev.filter(t => !(
              t.category_id === tx.category_id &&
              t.amount === Number(tx.amount) &&
              t.occurred_at === tx.occurred_at
            )));
            try {
              await deleteTransaction(tx.id);
            } catch (err: any) {
              setDrillTxns(prev => [tx, ...prev].sort((a, b) => b.occurred_at.localeCompare(a.occurred_at)));
              Alert.alert('Delete Failed', err.message || 'Could not delete. Please try again.');
            }
          },
        },
      ]
    );
  }, []);

  // ─── Chart data transforms ─────────────────────────────────────────────────
  const pieData = useMemo(() =>
    stats.categoryStats.slice(0, 8).map((c, i) => ({
      value: Math.round(c.total),
      color: catMap[c.category_id]?.color || CHART_COLORS[i % CHART_COLORS.length],
      text: `${c.pct.toFixed(0)}%`,
      label: catMap[c.category_id]?.name || c.category_id,
    })),
    [stats.categoryStats, catMap]
  );

  const barData = useMemo(() =>
    stats.dailyTotals.map(d => ({
      value: Math.round(d.total),
      label: d.date.slice(8), // day number
      frontColor: ACCENT + 'CC',
      topLabelComponent: () => null,
    })),
    [stats.dailyTotals]
  );

  const trendLineData = useMemo(() => {
    // Top 3 expense categories for trend
    const top3 = stats.categoryStats.slice(0, 3);
    return top3.map((c, i) => ({
      label: catMap[c.category_id]?.name || c.category_id,
      color: catMap[c.category_id]?.color || CHART_COLORS[i],
      data: stats.byMonth.map(bm => ({
        value: Math.round(
          txLite
            .filter(t => t.category_id === c.category_id && t.occurred_at.startsWith(bm.month))
            .reduce((s, t) => s + t.amount, 0)
        ),
        label: bm.month.slice(5), // 'MM'
      })),
    }));
  }, [stats, txLite, catMap]);

  // For multi-month bar chart of overall monthly totals
  const monthlyBarData = useMemo(() =>
    stats.byMonth.map(bm => ({
      value: Math.round(bm.expenses),
      label: bm.month.slice(5),
      frontColor: EXPENSE_COLOR + 'BB',
    })),
    [stats.byMonth]
  );

  // ─── Insight callouts ──────────────────────────────────────────────────────
  const topCat = stats.categoryStats[0] ?? null;
  const biggestTx = useMemo(() => {
    const expenseTxns = txLite.filter(t => t.type === 'expense');
    if (!expenseTxns.length) return null;
    return expenseTxns.reduce((max, t) => t.amount > max.amount ? t : max, expenseTxns[0]);
  }, [txLite]);

  const freqCat = stats.topFrequencyCategory
    ? stats.categoryStats.find(c => c.category_id === stats.topFrequencyCategory)
    : null;

  const momCatName = momChange ? (catMap[momChange.category_id]?.name || '—') : null;

  // ─── Helpers ───────────────────────────────────────────────────────────────
  const fmt = (n: number) => Math.abs(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmtShort = (n: number) => {
    if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
    if (n >= 1000)   return `₹${(n / 1000).toFixed(1)}K`;
    return `₹${Math.round(n)}`;
  };

  const maxBarVal = Math.max(...barData.map(d => d.value), 1);

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <View style={styles.screen}>
      {/* ── Fixed Header ──────────────────────────────────────────────────── */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <View style={styles.headerTopRow}>
          <Pressable style={styles.backBtn} onPress={() => router.back()}>
            <Text style={styles.backBtnText}>← LEDGER</Text>
          </Pressable>
          <Text style={styles.headerTitle}>INSIGHTS</Text>
          <View style={{ width: 72 }} />
        </View>

        {/* Period mode chips */}
        <View style={styles.periodChips}>
          {PERIOD_MODES.map(pm => (
            <Pressable
              key={pm.key}
              style={[
                styles.periodChip,
                periodMode === pm.key && { borderColor: ACCENT, backgroundColor: ACCENT + '22' },
              ]}
              onPress={() => { setPeriodMode(pm.key); setExpandedCategoryId(null); }}
            >
              <Text style={[
                styles.periodChipText,
                periodMode === pm.key && { color: ACCENT },
              ]}>
                {pm.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Month prev/next (only for MONTH mode) */}
        {periodMode === 'month' && (
          <View style={styles.monthSelector}>
            <Pressable style={styles.monthArrow} onPress={handlePrevMonth}>
              <Text style={styles.monthArrowText}>←</Text>
            </Pressable>
            <Text style={styles.monthLabel}>{periodRange.label}</Text>
            <Pressable style={styles.monthArrow} onPress={handleNextMonth}>
              <Text style={styles.monthArrowText}>→</Text>
            </Pressable>
          </View>
        )}
        {periodMode !== 'month' && (
          <Text style={styles.periodLabel}>{periodRange.label}</Text>
        )}
      </View>

      {/* ── Scroll area ───────────────────────────────────────────────────── */}
      {loading ? (
        <View style={styles.centered}><ActivityIndicator color={DL.muted} size="large" /></View>
      ) : (
        <ScrollView
          style={styles.scrollArea}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 32 }]}
          showsVerticalScrollIndicator={false}
        >
          {/* ── 1. Hero Numbers ─────────────────────────────────────────── */}
          <View style={styles.heroCard}>
            <Text style={styles.heroEyebrow}>NET FOR PERIOD</Text>
            <Text style={[styles.heroNet, { color: stats.net >= 0 ? INCOME_COLOR : EXPENSE_COLOR }]}>
              {stats.net >= 0 ? '+' : '-'}₹{fmt(Math.abs(stats.net))}
            </Text>

            <View style={styles.heroSubRow}>
              <View style={styles.heroSubItem}>
                <Text style={[styles.heroSubLabel, { color: EXPENSE_COLOR }]}>SPENT</Text>
                <Text style={[styles.heroSubVal, { color: EXPENSE_COLOR }]}>₹{fmt(stats.totalExpenses)}</Text>
              </View>
              <View style={styles.heroSubDivider} />
              <View style={styles.heroSubItem}>
                <Text style={[styles.heroSubLabel, { color: INCOME_COLOR }]}>EARNED</Text>
                <Text style={[styles.heroSubVal, { color: INCOME_COLOR }]}>₹{fmt(stats.totalIncome)}</Text>
              </View>
              <View style={styles.heroSubDivider} />
              <View style={styles.heroSubItem}>
                <Text style={[styles.heroSubLabel, { color: DL.muted }]}>DAILY AVG</Text>
                <Text style={[styles.heroSubVal, { color: DL.text }]}>
                  ₹{fmt(stats.avgDailySpend)}
                </Text>
              </View>
            </View>
          </View>

          {/* ── 2. Donut chart ──────────────────────────────────────────── */}
          {pieData.length > 0 && (
            <View style={styles.chartCard}>
              <Text style={styles.sectionHeader}>SPEND BY CATEGORY</Text>
              <View style={styles.donutWrap}>
                <PieChart
                  data={pieData}
                  donut
                  radius={90}
                  innerRadius={55}
                  innerCircleColor={DL.card}
                  centerLabelComponent={() => (
                    <View style={{ alignItems: 'center' }}>
                      <Text style={styles.donutCenter}>
                        {fmtShort(stats.totalExpenses)}
                      </Text>
                      <Text style={styles.donutCenterSub}>SPENT</Text>
                    </View>
                  )}
                  showText={false}
                />
              </View>
              {/* Legend */}
              <View style={styles.legendGrid}>
                {pieData.map((item, i) => (
                  <View key={i} style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: item.color }]} />
                    <Text style={styles.legendName} numberOfLines={1}>{item.label}</Text>
                    <Text style={styles.legendPct}>{item.text}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* ── 3. Daily bar chart ──────────────────────────────────────── */}
          {barData.length > 0 && (
            <View style={styles.chartCard}>
              <Text style={styles.sectionHeader}>DAILY SPEND</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <BarChart
                  data={barData}
                  width={Math.max(300, barData.length * 28)}
                  height={140}
                  barWidth={18}
                  barBorderRadius={4}
                  spacing={10}
                  noOfSections={4}
                  maxValue={Math.ceil(maxBarVal / 100) * 100}
                  backgroundColor={DL.card}
                  rulesColor={DL.border}
                  rulesType="solid"
                  yAxisColor="transparent"
                  xAxisColor={DL.border}
                  yAxisTextStyle={{ color: DL.muted, fontSize: 9, fontFamily: 'monospace' }}
                  xAxisLabelTextStyle={{ color: DL.muted, fontSize: 9, fontFamily: 'monospace' }}
                  hideYAxisText={false}
                  initialSpacing={8}
                  endSpacing={8}
                  formatYLabel={(v) => fmtShort(Number(v))}
                />
              </ScrollView>
            </View>
          )}

          {/* ── 4. Multi-month trend (only for ≥3M) ─────────────────────── */}
          {periodMode !== 'month' && stats.byMonth.length > 1 && (
            <View style={styles.chartCard}>
              <Text style={styles.sectionHeader}>MONTHLY SPEND TREND</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <BarChart
                  data={monthlyBarData}
                  width={Math.max(280, stats.byMonth.length * 52)}
                  height={160}
                  barWidth={32}
                  barBorderRadius={6}
                  spacing={20}
                  noOfSections={4}
                  backgroundColor={DL.card}
                  rulesColor={DL.border}
                  rulesType="solid"
                  yAxisColor="transparent"
                  xAxisColor={DL.border}
                  yAxisTextStyle={{ color: DL.muted, fontSize: 9, fontFamily: 'monospace' }}
                  xAxisLabelTextStyle={{ color: DL.muted, fontSize: 9, fontFamily: 'monospace' }}
                  initialSpacing={12}
                  endSpacing={12}
                  formatYLabel={(v) => fmtShort(Number(v))}
                />
              </ScrollView>
              {/* Top category trend lines as a color legend bar */}
              {trendLineData.length > 0 && (
                <View style={styles.trendLegend}>
                  {trendLineData.map((t, i) => (
                    <View key={i} style={styles.trendLegendItem}>
                      <View style={[styles.legendDot, { backgroundColor: t.color }]} />
                      <Text style={styles.legendName}>{t.label}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}

          {/* ── 5. Full Category Breakdown List ─────────────────────────── */}
          {stats.categoryStats.length > 0 && (
            <View style={styles.breakdownCard}>
              <Text style={styles.sectionHeader}>CATEGORY BREAKDOWN</Text>
              <Text style={styles.sectionHint}>TAP A CATEGORY TO SEE TRANSACTIONS</Text>
              {stats.categoryStats.map((cat, i) => {
                const info = catMap[cat.category_id];
                const color = info?.color || CHART_COLORS[i % CHART_COLORS.length];
                const name  = info?.name  || cat.category_id;
                const isExpanded = expandedCategoryId === cat.category_id;
                const barPct = stats.categoryStats[0]?.total > 0
                  ? (cat.total / stats.categoryStats[0].total) * 100
                  : 0;

                return (
                  <View key={cat.category_id}>
                    {/* Category row */}
                    <Pressable
                      style={({ pressed }) => [
                        styles.catRow,
                        i > 0 && styles.catRowDivider,
                        isExpanded && { backgroundColor: color + '0D' },
                        pressed && { opacity: 0.75 },
                      ]}
                      onPress={() => handleToggleCategory(cat.category_id)}
                    >
                      <View style={[styles.catColorDot, { backgroundColor: color }]} />
                      <View style={styles.catInfo}>
                        <View style={styles.catTopRow}>
                          <Text style={styles.catName}>{name}</Text>
                          <Text style={styles.catAmount}>₹{fmt(cat.total)}</Text>
                        </View>
                        <View style={styles.catBarRow}>
                          <View style={styles.catBarBg}>
                            <View style={[styles.catBarFill, { width: `${barPct}%`, backgroundColor: color }]} />
                          </View>
                          <Text style={styles.catPct}>{cat.pct.toFixed(0)}%</Text>
                        </View>
                        <Text style={styles.catCount}>{cat.count} transaction{cat.count !== 1 ? 's' : ''}</Text>
                      </View>
                      <Text style={[styles.catChevron, isExpanded && { transform: [{ rotate: '90deg' }] }]}>›</Text>
                    </Pressable>

                    {/* Drill-down accordion */}
                    {isExpanded && (
                      <View style={styles.drillDownContainer}>
                        {isDemoMode ? (
                          <Text style={styles.drillDemoText}>
                            Demo mode — connect to Supabase to see real transactions.
                          </Text>
                        ) : drillTxns.length === 0 ? (
                          <ActivityIndicator color={DL.muted} size="small" style={{ marginVertical: 16 }} />
                        ) : (
                          drillTxns.map((tx, txIdx) => (
                            <ReanimatedSwipeable
                              key={tx.id}
                              ref={(ref) => { swipeableRefs.current[tx.id] = ref; }}
                              friction={2}
                              rightThreshold={40}
                              renderRightActions={(_prog, drag) => (
                                <DeleteAction drag={drag} onDelete={() => handleDeleteDrillTx(tx)} />
                              )}
                              containerStyle={txIdx > 0 ? styles.drillTxDivider : undefined}
                            >
                              <View style={styles.drillTxRow}>
                                <View style={styles.txInfo}>
                                  <Text style={styles.txNote} numberOfLines={1}>
                                    {tx.note || name}
                                  </Text>
                                  <Text style={styles.txMeta}>
                                    {tx.occurred_at}
                                    {tx.source === 'wishlist_link' ? '  ·  ✓ WISHLIST' : ''}
                                  </Text>
                                </View>
                                <Text style={[styles.txAmount, { color: EXPENSE_COLOR }]}>
                                  -₹{Number(tx.amount).toFixed(2)}
                                </Text>
                              </View>
                            </ReanimatedSwipeable>
                          ))
                        )}
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          )}

          {/* ── 6. Insight Callouts ─────────────────────────────────────── */}
          <Text style={[styles.sectionHeader, { marginTop: 8, marginBottom: 8, paddingHorizontal: 4 }]}>
            INSIGHTS
          </Text>
          <View style={styles.calloutGrid}>

            {/* Top Category */}
            {topCat && (
              <View style={[styles.calloutCard, { borderColor: catMap[topCat.category_id]?.color + '55' || DL.border }]}>
                <Text style={[styles.calloutLabel, { color: catMap[topCat.category_id]?.color || DL.muted }]}>
                  TOP CATEGORY
                </Text>
                <Text style={styles.calloutVal} numberOfLines={1}>
                  {catMap[topCat.category_id]?.name || topCat.category_id}
                </Text>
                <Text style={styles.calloutSub}>
                  ₹{fmt(topCat.total)}  ·  {topCat.pct.toFixed(0)}% of spend
                </Text>
              </View>
            )}

            {/* Biggest single spend */}
            {biggestTx && (
              <View style={styles.calloutCard}>
                <Text style={[styles.calloutLabel, { color: EXPENSE_COLOR }]}>BIGGEST SPEND</Text>
                <Text style={styles.calloutVal} numberOfLines={1}>
                  {catMap[biggestTx.category_id]?.name || biggestTx.category_id}
                </Text>
                <Text style={styles.calloutSub}>₹{fmt(biggestTx.amount)}</Text>
              </View>
            )}

            {/* Net change */}
            <View style={[styles.calloutCard, { borderColor: (stats.net >= 0 ? INCOME_COLOR : EXPENSE_COLOR) + '44' }]}>
              <Text style={[styles.calloutLabel, { color: stats.net >= 0 ? INCOME_COLOR : EXPENSE_COLOR }]}>
                NET CHANGE
              </Text>
              <Text style={[styles.calloutVal, { color: stats.net >= 0 ? INCOME_COLOR : EXPENSE_COLOR }]}>
                {stats.net >= 0 ? '+' : '-'}₹{fmtShort(Math.abs(stats.net))}
              </Text>
              <Text style={styles.calloutSub}>income − expenses</Text>
            </View>

            {/* Month-over-month */}
            {momChange && momCatName && (
              <View style={styles.calloutCard}>
                <Text style={[styles.calloutLabel, { color: momChange.direction === 'up' ? EXPENSE_COLOR : INCOME_COLOR }]}>
                  MONTH-OVER-MONTH
                </Text>
                <Text style={styles.calloutVal} numberOfLines={1}>{momCatName}</Text>
                <Text style={[styles.calloutSub, { color: momChange.direction === 'up' ? EXPENSE_COLOR : INCOME_COLOR }]}>
                  {momChange.direction === 'up' ? '↑' : '↓'} {Math.abs(momChange.pctChange).toFixed(0)}% vs last month
                </Text>
              </View>
            )}

            {/* Most frequent */}
            {freqCat && (
              <View style={styles.calloutCard}>
                <Text style={[styles.calloutLabel, { color: ACCENT }]}>MOST FREQUENT</Text>
                <Text style={styles.calloutVal} numberOfLines={1}>
                  {catMap[freqCat.category_id]?.name || freqCat.category_id}
                </Text>
                <Text style={styles.calloutSub}>
                  {freqCat.count} transactions this period
                </Text>
              </View>
            )}

            {/* Income / expense ratio — only if income exists */}
            {stats.incomeExpenseRatio !== null && (
              <View style={[styles.calloutCard, { borderColor: '#8B7CFF44' }]}>
                <Text style={[styles.calloutLabel, { color: ACCENT }]}>SPEND RATIO</Text>
                <Text style={styles.calloutVal}>
                  {stats.incomeExpenseRatio.toFixed(0)}%
                </Text>
                <Text style={styles.calloutSub}>
                  of earned income spent this period
                </Text>
              </View>
            )}

          </View>

          {/* Empty state */}
          {stats.categoryStats.length === 0 && !loading && (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>📊</Text>
              <Text style={styles.emptyTitle}>No expense data</Text>
              <Text style={styles.emptyText}>Log some expenses to see insights for this period.</Text>
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}

// ─── Drill-down swipe styles ──────────────────────────────────────────────────
const sStyles = StyleSheet.create({
  deleteAction: {
    width: 72,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: EXPENSE_COLOR,
    borderRadius: 12,
    overflow: 'hidden',
  },
  deleteActionInner: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 2,
  },
  deleteActionIcon: { fontSize: 16 },
  deleteActionText: {
    fontFamily: 'monospace',
    fontSize: 8,
    color: '#fff',
    fontWeight: 'bold',
    letterSpacing: 1,
  },
});

// ─── Main styles ──────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: DL.bg },

  // Header
  header: {
    backgroundColor: '#0B0D10',
    borderBottomWidth: 1,
    borderBottomColor: '#161822',
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  backBtn: { paddingVertical: 6 },
  backBtnText: {
    fontFamily: DLFonts.mono,
    fontSize: 10,
    color: DL.muted,
    letterSpacing: 1,
  },
  headerTitle: {
    fontFamily: DLFonts.mono,
    fontSize: 13,
    fontWeight: 'bold',
    color: DL.text,
    letterSpacing: 3,
  },

  // Period chips
  periodChips: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  periodChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1.2,
    borderColor: '#1C202A',
  },
  periodChipText: {
    fontFamily: DLFonts.mono,
    fontSize: 9,
    fontWeight: 'bold',
    color: DL.muted,
    letterSpacing: 1,
  },

  // Month selector
  monthSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#13161C',
    borderRadius: 10,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: '#1C202A',
  },
  monthArrow: { paddingHorizontal: 8, paddingVertical: 2 },
  monthArrowText: {
    color: DL.text,
    fontSize: 14,
    fontFamily: DLFonts.mono,
    fontWeight: 'bold',
  },
  monthLabel: {
    fontFamily: DLFonts.mono,
    fontSize: 11,
    fontWeight: 'bold',
    color: DL.text,
    letterSpacing: 1,
  },
  periodLabel: {
    fontFamily: DLFonts.mono,
    fontSize: 11,
    color: ACCENT,
    letterSpacing: 1,
    textAlign: 'center',
    paddingVertical: 4,
  },

  // Scroll
  scrollArea: { flex: 1 },
  scrollContent: { paddingTop: 16, paddingHorizontal: 16, gap: 16 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  // Hero card
  heroCard: {
    backgroundColor: DL.card,
    borderColor: DL.border,
    borderWidth: 1.2,
    borderRadius: 24,
    padding: 20,
  },
  heroEyebrow: {
    fontFamily: DLFonts.mono,
    fontSize: 9,
    color: DL.muted,
    letterSpacing: 2,
    marginBottom: 6,
  },
  heroNet: {
    fontFamily: DLFonts.mono,
    fontSize: 36,
    fontWeight: '800',
    letterSpacing: -1,
    marginBottom: 16,
  },
  heroSubRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 0,
  },
  heroSubItem: { flex: 1, alignItems: 'center', gap: 3 },
  heroSubLabel: {
    fontFamily: DLFonts.mono,
    fontSize: 8,
    letterSpacing: 1,
    fontWeight: 'bold',
  },
  heroSubVal: {
    fontFamily: DLFonts.mono,
    fontSize: 13,
    fontWeight: '700',
    color: DL.text,
  },
  heroSubDivider: {
    width: 1,
    backgroundColor: DL.border,
    marginVertical: 4,
  },

  // Charts
  chartCard: {
    backgroundColor: DL.card,
    borderColor: DL.border,
    borderWidth: 1.2,
    borderRadius: 24,
    padding: 16,
    overflow: 'hidden',
  },
  sectionHeader: {
    fontFamily: DLFonts.mono,
    fontSize: 10,
    color: DL.muted,
    letterSpacing: 1.5,
    marginBottom: 14,
  },
  sectionHint: {
    fontFamily: DLFonts.mono,
    fontSize: 8,
    color: DL.muted,
    letterSpacing: 1,
    marginTop: -10,
    marginBottom: 12,
  },
  donutWrap: { alignItems: 'center', marginBottom: 16 },
  donutCenter: {
    fontFamily: DLFonts.mono,
    fontSize: 14,
    fontWeight: '800',
    color: DL.text,
  },
  donutCenterSub: {
    fontFamily: DLFonts.mono,
    fontSize: 8,
    color: DL.muted,
    letterSpacing: 1,
  },
  legendGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6, width: '47%' },
  legendDot: { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  legendName: {
    fontFamily: DLFonts.sans,
    fontSize: 11,
    color: DL.text,
    flex: 1,
  },
  legendPct: {
    fontFamily: DLFonts.mono,
    fontSize: 10,
    color: DL.muted,
    minWidth: 32,
    textAlign: 'right',
  },
  trendLegend: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 10,
    flexWrap: 'wrap',
  },
  trendLegendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },

  // Category breakdown
  breakdownCard: {
    backgroundColor: DL.card,
    borderColor: DL.border,
    borderWidth: 1.2,
    borderRadius: 24,
    padding: 16,
    overflow: 'hidden',
  },
  catRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 4,
    gap: 12,
  },
  catRowDivider: {
    borderTopWidth: 1,
    borderTopColor: '#161822',
  },
  catColorDot: { width: 10, height: 10, borderRadius: 5, flexShrink: 0 },
  catInfo: { flex: 1, gap: 4 },
  catTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  catName: { fontFamily: DLFonts.sans, fontSize: 14, fontWeight: '600', color: DL.text },
  catAmount: { fontFamily: DLFonts.mono, fontSize: 13, fontWeight: '700', color: DL.text },
  catBarRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  catBarBg: {
    flex: 1,
    height: 3,
    backgroundColor: '#161822',
    borderRadius: 2,
    overflow: 'hidden',
  },
  catBarFill: { height: 3, borderRadius: 2 },
  catPct: { fontFamily: DLFonts.mono, fontSize: 9, color: DL.muted, minWidth: 28, textAlign: 'right' },
  catCount: { fontFamily: DLFonts.mono, fontSize: 8, color: DL.muted, letterSpacing: 0.5 },
  catChevron: {
    fontFamily: DLFonts.sans,
    fontSize: 20,
    color: DL.muted,
    marginLeft: 4,
  },

  // Drill-down
  drillDownContainer: {
    backgroundColor: '#0A0C10',
    marginHorizontal: -4,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 4,
  },
  drillDemoText: {
    fontFamily: DLFonts.sans,
    fontSize: 12,
    color: DL.muted,
    textAlign: 'center',
    padding: 16,
  },
  drillTxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#0A0C10',
    gap: 12,
  },
  drillTxDivider: {
    borderTopWidth: 1,
    borderTopColor: '#161822',
  },
  txInfo: { flex: 1 },
  txNote: {
    fontFamily: DLFonts.sans,
    fontSize: 13,
    fontWeight: '600',
    color: DL.text,
    marginBottom: 2,
  },
  txMeta: {
    fontFamily: DLFonts.mono,
    fontSize: 8,
    color: DL.muted,
    letterSpacing: 0.5,
  },
  txAmount: { fontFamily: DLFonts.mono, fontSize: 13, fontWeight: 'bold' },

  // Callout grid
  calloutGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  calloutCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: DL.card,
    borderColor: DL.border,
    borderWidth: 1.2,
    borderRadius: 20,
    padding: 14,
    gap: 4,
  },
  calloutLabel: {
    fontFamily: DLFonts.mono,
    fontSize: 8,
    letterSpacing: 1,
    color: DL.muted,
    marginBottom: 2,
  },
  calloutVal: {
    fontFamily: DLFonts.sans,
    fontSize: 18,
    fontWeight: '700',
    color: DL.text,
  },
  calloutSub: {
    fontFamily: DLFonts.mono,
    fontSize: 9,
    color: DL.muted,
  },

  // Empty state
  emptyState: { alignItems: 'center', paddingVertical: 48 },
  emptyIcon: { fontSize: 40, marginBottom: 12 },
  emptyTitle: {
    fontFamily: DLFonts.sans,
    fontSize: 16,
    fontWeight: 'bold',
    color: DL.text,
    marginBottom: 6,
  },
  emptyText: {
    fontFamily: DLFonts.sans,
    fontSize: 13,
    color: DL.muted,
    textAlign: 'center',
    lineHeight: 18,
  },
});
