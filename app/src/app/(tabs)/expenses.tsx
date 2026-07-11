import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import Reanimated, { SharedValue, useAnimatedStyle } from 'react-native-reanimated';
import { DL, DLFonts, TIER_COLOR } from '@/constants/design';
import { fetchCategories, fetchTransactions, deleteTransaction, ExpenseCategory, Transaction } from '@/lib/expensesApi';
import {
  getCachedExpenseCategories,
  saveCachedExpenseCategories,
  getCachedTransactions,
  saveCachedTransactions,
  reconcileTransactions,
} from '@/lib/database';

// ─── Colors ──────────────────────────────────────────────────────────────────
const INCOME_COLOR  = '#22C55E';
const EXPENSE_COLOR = '#EF4444';
const NET_POS_COLOR = '#22C55E';
const NET_NEG_COLOR = '#EF4444';

// ─── Demo-mode data ───────────────────────────────────────────────────────────
const MOCK_EXPENSE_CATS: ExpenseCategory[] = [
  { id: 'cat-1', name: 'Food',          icon: 'Utensils',    color: '#F59E0B', is_default: true, type: 'expense', user_id: null, created_at: '' },
  { id: 'cat-2', name: 'Transport',     icon: 'Car',         color: '#3B82F6', is_default: true, type: 'expense', user_id: null, created_at: '' },
  { id: 'cat-3', name: 'Shopping',      icon: 'ShoppingBag', color: '#EC4899', is_default: true, type: 'expense', user_id: null, created_at: '' },
  { id: 'cat-4', name: 'Bills',         icon: 'CreditCard',  color: '#EF4444', is_default: true, type: 'expense', user_id: null, created_at: '' },
  { id: 'cat-5', name: 'Entertainment', icon: 'Tv',          color: '#8B5CF6', is_default: true, type: 'expense', user_id: null, created_at: '' },
  { id: 'cat-6', name: 'Health',        icon: 'Heart',       color: '#10B981', is_default: true, type: 'expense', user_id: null, created_at: '' },
  { id: 'cat-7', name: 'Other',         icon: 'Coins',       color: '#6B7280', is_default: true, type: 'expense', user_id: null, created_at: '' },
];

const getMockTransactions = (monthStr: string): Transaction[] => [
  {
    id: 'tx-1', user_id: 'user', amount: 150.00, category_id: 'cat-1',
    note: 'Dinner at pizzeria', occurred_at: `${monthStr}-08`,
    source: 'manual', linked_item_id: null, type: 'expense', created_at: '',
    category: MOCK_EXPENSE_CATS[0],
  },
  {
    id: 'tx-2', user_id: 'user', amount: 45.50, category_id: 'cat-2',
    note: 'Uber to office', occurred_at: `${monthStr}-10`,
    source: 'manual', linked_item_id: null, type: 'expense', created_at: '',
    category: MOCK_EXPENSE_CATS[1],
  },
  {
    id: 'tx-3', user_id: 'user', amount: 1200.00, category_id: 'cat-3',
    note: 'Aesthetic Room Floor Mirror', occurred_at: `${monthStr}-11`,
    source: 'wishlist_link', linked_item_id: 'mirror-id', type: 'expense', created_at: '',
    category: MOCK_EXPENSE_CATS[2],
  },
  {
    id: 'tx-4', user_id: 'user', amount: 32000.00, category_id: 'inc-1',
    note: 'Monthly Salary', occurred_at: `${monthStr}-01`,
    source: 'manual', linked_item_id: null, type: 'income', created_at: '',
    category: { id: 'inc-1', name: 'Salary', icon: 'Banknote', color: '#22C55E', is_default: true, type: 'income', user_id: null, created_at: '' },
  },
  {
    id: 'tx-5', user_id: 'user', amount: 500.00, category_id: 'inc-3',
    note: 'Birthday gift', occurred_at: `${monthStr}-05`,
    source: 'manual', linked_item_id: null, type: 'income', created_at: '',
    category: { id: 'inc-3', name: 'Gift', icon: 'Gift', color: '#A78BFA', is_default: true, type: 'income', user_id: null, created_at: '' },
  },
];

type TypeFilter = 'all' | 'expense' | 'income';

// ─── Swipe delete action component ───────────────────────────────────────────
function DeleteAction({
  prog,
  drag,
  onDelete,
}: {
  prog: SharedValue<number>;
  drag: SharedValue<number>;
  onDelete: () => void;
}) {
  const styleAnim = useAnimatedStyle(() => ({
    transform: [{ translateX: drag.value + 80 }],
  }));

  return (
    <Reanimated.View style={[styles.deleteAction, styleAnim]}>
      <Pressable style={styles.deleteActionInner} onPress={onDelete}>
        <Text style={styles.deleteActionIcon}>🗑</Text>
        <Text style={styles.deleteActionText}>DELETE</Text>
      </Pressable>
    </Reanimated.View>
  );
}

export default function FinancesScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [categories,   setCategories]   = useState<ExpenseCategory[]>(() => getCachedExpenseCategories());
  const [transactions, setTransactions] = useState<Transaction[]>(() => getCachedTransactions());
  const [loading,      setLoading]      = useState(() => getCachedTransactions().length === 0);
  const [refreshing,   setRefreshing]   = useState(false);
  const [isDemoMode,   setIsDemoMode]   = useState(false);
  const [typeFilter,   setTypeFilter]   = useState<TypeFilter>('all');
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<Set<string>>(new Set());

  // Track swipeable refs so we can close them programmatically
  const swipeableRefs = useRef<Record<string, any>>({});

  const [currentMonth, setCurrentMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

  // ─── Load data ────────────────────────────────────────────────────────────
  const loadData = useCallback(async (silent = false) => {
    if (!silent && getCachedTransactions().length === 0) setLoading(true);
    try {
      const [cats, txs] = await Promise.all([
        fetchCategories(),
        fetchTransactions(currentMonth),
      ]);
      setCategories((prev) => {
        saveCachedExpenseCategories(cats);
        return cats;
      });
      setTransactions((prev) => {
        const reconciled = reconcileTransactions(prev, txs);
        saveCachedTransactions(reconciled);
        return reconciled;
      });
      setIsDemoMode(false);
    } catch (err: any) {
      console.error('Fetch finances data failed:', err);
      const errMsg = String(err.message || err.details || '');
      if (
        errMsg.includes('PGRST205') ||
        errMsg.includes('expense_categories') ||
        errMsg.includes('transactions') ||
        errMsg.includes('schema cache')
      ) {
        setIsDemoMode(true);
        setCategories(MOCK_EXPENSE_CATS);
        setTransactions(getMockTransactions(currentMonth));
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [currentMonth]);

  useFocusEffect(
    useCallback(() => {
      const cachedCats = getCachedExpenseCategories();
      const cachedTxs = getCachedTransactions();
      if (cachedCats.length > 0) setCategories(cachedCats);
      if (cachedTxs.length > 0) setTransactions(cachedTxs);
      
      const hasCache = cachedTxs.length > 0;
      loadData(hasCache);
    }, [loadData])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData(true);
  }, [loadData]);

  // ─── Month navigation ─────────────────────────────────────────────────────
  const handlePrevMonth = () => {
    const [year, month] = currentMonth.split('-').map(Number);
    const prev = new Date(year, month - 2, 1);
    setCurrentMonth(`${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`);
    setTypeFilter('all');
  };
  const handleNextMonth = () => {
    const [year, month] = currentMonth.split('-').map(Number);
    const next = new Date(year, month, 1);
    setCurrentMonth(`${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`);
    setTypeFilter('all');
  };

  const monthLabel = useMemo(() => {
    const [year, month] = currentMonth.split('-').map(Number);
    return new Date(year, month - 1, 1)
      .toLocaleString('default', { month: 'long', year: 'numeric' })
      .toUpperCase();
  }, [currentMonth]);

  // ─── Delete with confirmation + optimistic UI ─────────────────────────────
  const handleDeleteRequest = useCallback((tx: Transaction) => {
    // Close the swipeable to reset visual state during the alert
    swipeableRefs.current[tx.id]?.close();

    const label = tx.note || tx.category?.name || (tx.type === 'income' ? 'Income' : 'Expense');
    const amountLabel = `₹${Number(tx.amount).toFixed(2)}`;

    Alert.alert(
      'Delete Transaction?',
      `"${label}" — ${amountLabel}\n\nThis cannot be undone.${tx.source === 'wishlist_link' ? '\n\nNote: The linked wishlist item will remain acquired.' : ''}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => confirmDelete(tx),
        },
      ],
      { cancelable: true }
    );
  }, []);

  const confirmDelete = useCallback(async (tx: Transaction) => {
    if (isDemoMode) {
      // Demo mode: just remove locally
      setTransactions((prev) => prev.filter((t) => t.id !== tx.id));
      return;
    }

    // Optimistic remove
    setTransactions((prev) => prev.filter((t) => t.id !== tx.id));

    try {
      await deleteTransaction(tx.id);
      // Success — nothing more to do, row already gone
    } catch (err: any) {
      // Rollback: restore the row
      setTransactions((prev) => {
        // Re-insert in correct date-sorted position
        const restored = [...prev, tx].sort((a, b) => {
          const dateDiff = b.occurred_at.localeCompare(a.occurred_at);
          if (dateDiff !== 0) return dateDiff;
          return b.created_at.localeCompare(a.created_at);
        });
        return restored;
      });
      Alert.alert(
        'Delete Failed',
        `Could not delete this transaction. Please check your connection and try again.\n\n${err.message || ''}`,
        [{ text: 'OK' }]
      );
    }
  }, [isDemoMode]);

  // ─── Totals ───────────────────────────────────────────────────────────────
  const { totalIncome, totalExpenses, netAmount } = useMemo(() => {
    const totalIncome   = transactions.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0);
    const totalExpenses = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0);
    return { totalIncome, totalExpenses, netAmount: totalIncome - totalExpenses };
  }, [transactions]);

  // ─── Filter ───────────────────────────────────────────────────────────────
  const filteredTransactions = useMemo(() => {
    let txs = transactions;
    if (typeFilter !== 'all') {
      txs = txs.filter((tx) => tx.type === typeFilter);
    }
    if (selectedCategoryIds.size > 0) {
      txs = txs.filter((tx) => {
        const catId = tx.category_id || 'other';
        return selectedCategoryIds.has(catId);
      });
    }
    return txs;
  }, [transactions, typeFilter, selectedCategoryIds]);

  // ─── Hero total ───────────────────────────────────────────────────────────
  const heroTotal = useMemo(() => {
    if (typeFilter === 'expense') return -totalExpenses;
    if (typeFilter === 'income')  return totalIncome;
    return netAmount;
  }, [typeFilter, totalExpenses, totalIncome, netAmount]);

  const heroColor = useMemo(() => {
    if (typeFilter === 'expense') return EXPENSE_COLOR;
    if (typeFilter === 'income')  return INCOME_COLOR;
    return netAmount >= 0 ? NET_POS_COLOR : NET_NEG_COLOR;
  }, [typeFilter, netAmount]);

  // ─── Expense-only data for insights/breakdown ──────────────────────────────
  const expenseOnlyTxns = useMemo(() => transactions.filter(t => t.type === 'expense'), [transactions]);

  const categoryBreakdown = useMemo(() => {
    const mapping: Record<string, { category: ExpenseCategory; amount: number }> = {};
    expenseOnlyTxns.forEach((tx) => {
      const cat = tx.category || {
        id: 'other',
        name: 'Other',
        color: '#6B7280',
        icon: 'Coins',
        is_default: true,
        type: 'expense',
        user_id: null,
        created_at: '',
      };
      const catId = cat.id || 'other';
      if (!mapping[catId]) mapping[catId] = { category: cat as ExpenseCategory, amount: 0 };
      mapping[catId].amount += Number(tx.amount);
    });
    return Object.values(mapping).filter(i => i.amount > 0).sort((a, b) => b.amount - a.amount);
  }, [expenseOnlyTxns]);

  const handleToggleCategoryFilter = useCallback((catId: string) => {
    setSelectedCategoryIds((prev) => {
      const next = new Set(prev);
      if (next.has(catId)) {
        next.delete(catId);
      } else {
        next.add(catId);
      }
      return next;
    });
  }, []);

  useEffect(() => {
    setSelectedCategoryIds(new Set());
  }, [typeFilter, currentMonth]);

  const insights = useMemo(() => {
    if (expenseOnlyTxns.length === 0) return null;
    const biggestSingle = expenseOnlyTxns.reduce((max, tx) =>
      Number(tx.amount) > Number(max.amount) ? tx : max, expenseOnlyTxns[0]);
    const topCategory = categoryBreakdown.length > 0 ? categoryBreakdown[0] : null;
    return { biggestSingle, topCategory };
  }, [expenseOnlyTxns, categoryBreakdown]);

  // ─── Group by date ────────────────────────────────────────────────────────
  const groupedTransactions = useMemo(() => {
    const groups: Record<string, Transaction[]> = {};
    filteredTransactions.forEach((tx) => {
      if (!groups[tx.occurred_at]) groups[tx.occurred_at] = [];
      groups[tx.occurred_at].push(tx);
    });
    return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]));
  }, [filteredTransactions]);

  // ─── Helpers ──────────────────────────────────────────────────────────────
  const formatDateHeader = (dateStr: string) => {
    const [y, m, d] = dateStr.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    const today = new Date();
    const yesterday = new Date(); yesterday.setDate(today.getDate() - 1);
    if (date.toDateString() === today.toDateString())     return 'TODAY';
    if (date.toDateString() === yesterday.toDateString()) return 'YESTERDAY';
    return date.toLocaleDateString('default', { weekday: 'short', month: 'short', day: 'numeric' }).toUpperCase();
  };

  const fmt = (n: number) =>
    Math.abs(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <View style={styles.screen}>
      {isDemoMode && (
        <View style={[styles.demoBanner, { paddingTop: insets.top }]}>
          <Text style={styles.demoBannerText}>
            ⚠️ DEMO MODE: Database tables not found. Run SQL in Supabase SQL editor to sync.
          </Text>
        </View>
      )}

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <View style={[styles.header, { paddingTop: isDemoMode ? 8 : insets.top + 8 }]}>
        <View style={styles.titleRow}>
          <View>
            <Text style={styles.eyebrow}>FINANCES</Text>
            <Text style={styles.title}>Ledger</Text>
          </View>
          <Pressable
            style={({ pressed }) => [styles.manageCategoriesBtn, pressed && { opacity: 0.8 }]}
            onPress={() => router.push('/expenses/categories')}
          >
            <Text style={styles.manageCategoriesBtnText}>CATEGORIES ⚙</Text>
          </Pressable>
        </View>

        {/* Month Selector */}
        <View style={styles.monthSelector}>
          <Pressable style={styles.monthArrow} onPress={handlePrevMonth}>
            <Text style={styles.monthArrowText}>←</Text>
          </Pressable>
          <Text style={styles.monthLabelText}>{monthLabel}</Text>
          <Pressable style={styles.monthArrow} onPress={handleNextMonth}>
            <Text style={styles.monthArrowText}>→</Text>
          </Pressable>
        </View>

        {/* Hero total */}
        <View style={styles.heroBanner}>
          <Text style={styles.heroEyebrow}>
            {typeFilter === 'expense' ? 'TOTAL SPENT' : typeFilter === 'income' ? 'TOTAL EARNED' : 'NET THIS MONTH'}
          </Text>
          <Text style={[styles.heroAmount, { color: heroColor }]}>
            {typeFilter === 'expense' ? '-' : typeFilter === 'income' ? '+' : netAmount >= 0 ? '+' : '-'}
            ₹{fmt(Math.abs(heroTotal))}
          </Text>
          {typeFilter === 'all' && (
            <View style={styles.heroSubRow}>
              <Text style={[styles.heroSubItem, { color: INCOME_COLOR }]}>↑ ₹{fmt(totalIncome)}</Text>
              <Text style={styles.heroSubDivider}>  ·  </Text>
              <Text style={[styles.heroSubItem, { color: EXPENSE_COLOR }]}>↓ ₹{fmt(totalExpenses)}</Text>
            </View>
          )}
        </View>

        {/* Type filter chips */}
        <View style={styles.filterChipRow}>
          {(['all', 'expense', 'income'] as TypeFilter[]).map((f) => (
            <Pressable
              key={f}
              style={[
                styles.filterChip,
                typeFilter === f && f === 'income'  && { borderColor: INCOME_COLOR,  backgroundColor: 'rgba(34,197,94,0.12)'   },
                typeFilter === f && f === 'expense' && { borderColor: EXPENSE_COLOR, backgroundColor: 'rgba(239,68,68,0.12)'   },
                typeFilter === f && f === 'all'     && { borderColor: '#8B7CFF',     backgroundColor: 'rgba(139,124,255,0.12)' },
              ]}
              onPress={() => setTypeFilter(f)}
            >
              <Text style={[
                styles.filterChipText,
                typeFilter === f && f === 'income'  && { color: INCOME_COLOR  },
                typeFilter === f && f === 'expense' && { color: EXPENSE_COLOR },
                typeFilter === f && f === 'all'     && { color: '#8B7CFF'     },
              ]}>
                {f.toUpperCase()}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* ── Scroll area ──────────────────────────────────────────────────────── */}
      {loading ? (
        <View style={styles.centered}><ActivityIndicator color={DL.muted} size="large" /></View>
      ) : (
        <ScrollView
          style={styles.scrollArea}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 85 }]}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh}
              tintColor={DL.muted} colors={[DL.soon]} progressBackgroundColor={DL.card} />
          }
        >
          {/* Insights (expense-only) */}
          {insights && (
            <Pressable
              style={({ pressed }) => [styles.insightsCard, pressed && { opacity: 0.85 }]}
              onPress={() => router.push({
                pathname: '/expenses/insights',
                params: { month: currentMonth },
              })}
            >
              <View style={styles.insightsHeaderRow}>
                <Text style={styles.sectionHeader}>INSIGHTS (EXPENSES)</Text>
                <Text style={styles.sectionChevron}>VIEW DETAIL ›</Text>
              </View>
              <View style={styles.insightsRow}>
                {insights.topCategory && (
                  <View style={styles.insightCol}>
                    <Text style={styles.insightLabel}>TOP CATEGORY</Text>
                    <Text style={styles.insightValText} numberOfLines={1}>{insights.topCategory.category.name}</Text>
                    <Text style={styles.insightSubtext}>₹{Math.round(insights.topCategory.amount).toLocaleString()}</Text>
                  </View>
                )}
                {insights.biggestSingle && (
                  <View style={styles.insightCol}>
                    <Text style={styles.insightLabel}>BIGGEST SPEND</Text>
                    <Text style={styles.insightValText} numberOfLines={1}>
                      {insights.biggestSingle.note || insights.biggestSingle.category?.name || 'Item'}
                    </Text>
                    <Text style={styles.insightSubtext}>₹{Math.round(insights.biggestSingle.amount).toLocaleString()}</Text>
                  </View>
                )}
                <View style={styles.insightCol}>
                  <Text style={[styles.insightLabel, { color: netAmount >= 0 ? INCOME_COLOR : EXPENSE_COLOR }]}>
                    NET CHANGE
                  </Text>
                  <Text style={[styles.insightValText, { color: netAmount >= 0 ? INCOME_COLOR : EXPENSE_COLOR }]}>
                    {netAmount >= 0 ? '+' : '-'}₹{Math.round(Math.abs(netAmount)).toLocaleString()}
                  </Text>
                  <Text style={styles.insightSubtext}>income − expenses</Text>
                </View>
              </View>
            </Pressable>
          )}

          {/* Expense category breakdown */}
          {categoryBreakdown.length > 0 && (typeFilter === 'all' || typeFilter === 'expense') && (
            <View style={styles.breakdownCard}>
              <Text style={styles.sectionHeader}>EXPENSE CATEGORIES</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.breakdownRow}>
                {categoryBreakdown.map((item) => {
                  const pct = totalExpenses > 0 ? (item.amount / totalExpenses) * 100 : 0;
                  const catId = item.category.id || 'other';
                  const isSelected = selectedCategoryIds.has(catId);
                  const isAnySelected = selectedCategoryIds.size > 0;
                  const isPillActive = !isAnySelected || isSelected;

                  return (
                    <Pressable
                      key={catId}
                      onPress={() => handleToggleCategoryFilter(catId)}
                      style={[
                        styles.categoryPill,
                        !isPillActive && { opacity: 0.35 },
                        isSelected && { borderColor: item.category.color, borderWidth: 1.5 },
                      ]}
                    >
                      <View style={[styles.categoryColorDot, { backgroundColor: item.category.color }]} />
                      <Text style={styles.categoryPillName}>{item.category.name}</Text>
                      <Text style={styles.categoryPillAmount}>
                        {pct > 0 && pct < 1 ? '<1%' : `${pct.toFixed(0)}%`}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          )}

          {/* Transaction list */}
          {transactions.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateIcon}>🪙</Text>
              <Text style={styles.emptyStateTitle}>No Transactions</Text>
              <Text style={styles.emptyStateText}>
                Nothing logged for this month yet. Tap + to add an expense or income entry.
              </Text>
            </View>
          ) : filteredTransactions.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateIcon}>🔍</Text>
              <Text style={styles.emptyStateTitle}>
                No {typeFilter === 'expense' ? 'Expenses' : 'Income'} This Month
              </Text>
              <Text style={styles.emptyStateText}>
                Switch to ALL to see all transactions, or tap + to add a new entry.
              </Text>
            </View>
          ) : (
            <View style={styles.transactionLog}>
              {groupedTransactions.map(([date, txs]) => (
                <View key={date} style={styles.dayGroup}>
                  <View style={styles.dayHeaderRow}>
                    <Text style={styles.dayHeader}>{formatDateHeader(date)}</Text>
                    <Text style={styles.dayTotal}>
                      {txs.some(t => t.type === 'income') && txs.some(t => t.type === 'expense')
                        ? `net ₹${fmt(txs.reduce((s, t) => s + (t.type === 'income' ? Number(t.amount) : -Number(t.amount)), 0))}`
                        : txs[0]?.type === 'income'
                          ? `+₹${fmt(txs.reduce((s, t) => s + Number(t.amount), 0))}`
                          : `-₹${fmt(txs.reduce((s, t) => s + Number(t.amount), 0))}`
                      }
                    </Text>
                  </View>

                  <View style={styles.dayBox}>
                    {txs.map((tx, idx) => {
                      const isIncome = tx.type === 'income';
                      const catColor = tx.category?.color || (isIncome ? INCOME_COLOR : '#6B7280');

                      return (
                        <ReanimatedSwipeable
                          key={tx.id}
                          ref={(ref) => { swipeableRefs.current[tx.id] = ref; }}
                          friction={2}
                          rightThreshold={40}
                          renderRightActions={(prog, drag) => (
                            <DeleteAction
                              prog={prog}
                              drag={drag}
                              onDelete={() => handleDeleteRequest(tx)}
                            />
                          )}
                          containerStyle={[idx > 0 && styles.txDivider]}
                          childrenContainerStyle={styles.txSwipeChild}
                        >
                          <Pressable
                            style={({ pressed }) => [styles.txRow, pressed && { opacity: 0.7 }]}
                            onPress={() => router.push({
                              pathname: '/expenses/transaction',
                              params: {
                                id: tx.id,
                                amount: tx.amount,
                                note: tx.note || '',
                                category_id: tx.category_id,
                                occurred_at: tx.occurred_at,
                                linked_item_id: tx.linked_item_id || 'null',
                                source: tx.source,
                                type: tx.type,
                              },
                            })}
                          >
                            {/* Icon */}
                            <View style={styles.txIconWrap}>
                              {isIncome && <View style={styles.txIncomeStripe} />}
                              <View style={[styles.txIconBox, { backgroundColor: catColor + '33' }]}>
                                <Text style={[styles.txIconSymbol, { color: catColor }]}>
                                  {tx.category?.name.charAt(0) || (isIncome ? '↑' : '↓')}
                                </Text>
                              </View>
                            </View>

                            <View style={styles.txInfo}>
                              <Text style={styles.txNote} numberOfLines={1}>
                                {tx.note || tx.category?.name || (isIncome ? 'Income' : 'Expense')}
                              </Text>
                              <Text style={styles.txMeta}>
                                {isIncome ? '✦ INCOME' : tx.source === 'wishlist_link' ? '✓ WISHLIST' : 'MANUAL'}
                                {tx.category ? `  ·  ${tx.category.name}` : ''}
                              </Text>
                            </View>

                            <Text style={[styles.txAmount, { color: isIncome ? INCOME_COLOR : EXPENSE_COLOR }]}>
                              {isIncome ? '+' : '-'}₹{Number(tx.amount).toFixed(2)}
                            </Text>
                          </Pressable>
                        </ReanimatedSwipeable>
                      );
                    })}
                  </View>
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      )}

      {/* FAB */}
      <Pressable
        style={({ pressed }) => [styles.fab, pressed && { opacity: 0.9, transform: [{ scale: 0.95 }] }]}
        onPress={() => router.push('/expenses/transaction')}
      >
        <Text style={styles.fabText}>+</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen:          { flex: 1, backgroundColor: DL.bg },
  header: {
    paddingHorizontal: 20,
    backgroundColor: '#0B0D10',
    borderBottomWidth: 1,
    borderBottomColor: '#161822',
    paddingBottom: 14,
  },
  titleRow:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 12 },
  eyebrow:         { fontSize: 10, letterSpacing: 2.5, color: DL.muted, fontFamily: DLFonts.mono, marginBottom: 2, fontWeight: '500' },
  title:           { fontSize: 26, fontWeight: '800', color: DL.text },
  manageCategoriesBtn: { borderColor: '#242830', borderWidth: 1.2, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  manageCategoriesBtnText: { fontSize: 9, fontFamily: DLFonts.mono, color: DL.muted, fontWeight: 'bold', letterSpacing: 1 },
  monthSelector:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#13161C', borderRadius: 12, paddingVertical: 8, paddingHorizontal: 12, marginBottom: 14, borderWidth: 1, borderColor: '#1C202A' },
  monthArrow:      { paddingHorizontal: 10, paddingVertical: 4 },
  monthArrowText:  { color: DL.text, fontSize: 15, fontFamily: DLFonts.mono, fontWeight: 'bold' },
  monthLabelText:  { fontFamily: DLFonts.mono, fontSize: 12, fontWeight: 'bold', color: DL.text, letterSpacing: 1.5 },
  heroBanner:      { marginBottom: 12 },
  heroEyebrow:     { fontFamily: DLFonts.mono, fontSize: 9, color: DL.muted, letterSpacing: 1, marginBottom: 4 },
  heroAmount:      { fontFamily: DLFonts.mono, fontSize: 34, fontWeight: '800', letterSpacing: -1 },
  heroSubRow:      { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  heroSubItem:     { fontFamily: DLFonts.mono, fontSize: 11, fontWeight: '700' },
  heroSubDivider:  { color: DL.muted, fontFamily: DLFonts.mono, fontSize: 11 },
  filterChipRow:   { flexDirection: 'row', gap: 8 },
  filterChip:      { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, borderWidth: 1.2, borderColor: '#1C202A', backgroundColor: 'transparent' },
  filterChipText:  { fontFamily: DLFonts.mono, fontSize: 9, fontWeight: 'bold', color: DL.muted, letterSpacing: 1 },
  scrollArea:      { flex: 1 },
  scrollContent:   { paddingTop: 16, paddingHorizontal: 16 },
  centered:        { flex: 1, justifyContent: 'center', alignItems: 'center' },
  insightsCard:    { backgroundColor: DL.card, borderColor: DL.border, borderWidth: 1.2, borderRadius: 20, padding: 16, marginBottom: 16 },
  insightsHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionChevron:  { fontFamily: DLFonts.mono, fontSize: 8, color: '#8B7CFF', letterSpacing: 1, fontWeight: 'bold' },
  sectionHeader:   { fontFamily: DLFonts.mono, fontSize: 10, color: DL.muted, letterSpacing: 1.5, marginBottom: 12 },
  insightsRow:     { flexDirection: 'row', gap: 12 },
  insightCol:      { flex: 1 },
  insightLabel:    { fontFamily: DLFonts.mono, fontSize: 8, color: '#FF3333', letterSpacing: 1, marginBottom: 4 },
  insightValText:  { fontFamily: DLFonts.sans, fontSize: 14, fontWeight: '700', color: DL.text, marginBottom: 2 },
  insightSubtext:  { fontFamily: DLFonts.mono, fontSize: 9, color: DL.muted },
  breakdownCard:   { marginBottom: 18 },
  breakdownRow:    { gap: 8, paddingVertical: 2 },
  categoryPill:    { flexDirection: 'row', alignItems: 'center', backgroundColor: DL.card, borderColor: DL.border, borderWidth: 1.2, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 7, gap: 6 },
  categoryColorDot:{ width: 6, height: 6, borderRadius: 3 },
  categoryPillName:{ fontFamily: DLFonts.sans, fontSize: 12, color: DL.text },
  categoryPillAmount:{ fontFamily: DLFonts.mono, fontSize: 10, color: DL.muted, marginLeft: 2 },
  transactionLog:  { flexDirection: 'column', gap: 16 },
  dayGroup:        { flexDirection: 'column', gap: 6 },
  dayHeaderRow:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  dayHeader:       { fontFamily: DLFonts.mono, fontSize: 10, color: DL.muted, letterSpacing: 1 },
  dayTotal:        { fontFamily: DLFonts.mono, fontSize: 10, color: DL.muted, letterSpacing: 0.5 },
  dayBox: {
    backgroundColor: DL.card,
    borderColor: DL.border,
    borderWidth: 1.2,
    borderRadius: 20,
    overflow: 'hidden',
  },
  // Swipe layout: Swipeable manages the outer divider, children get the white surface
  txDivider:       { borderTopWidth: 1, borderTopColor: '#161822' },
  txSwipeChild:    { backgroundColor: DL.card },
  txRow:           { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
  // Delete action revealed on swipe-left
  deleteAction: {
    width: 80,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#EF4444',
  },
  deleteActionInner: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 3,
  },
  deleteActionIcon:  { fontSize: 18 },
  deleteActionText:  { fontFamily: DLFonts.mono, fontSize: 9, color: '#fff', fontWeight: 'bold', letterSpacing: 1 },
  txIconWrap:      { flexDirection: 'row', alignItems: 'center', gap: 4 },
  txIncomeStripe:  { width: 3, height: 28, borderRadius: 2, backgroundColor: INCOME_COLOR, marginRight: 2 },
  txIconBox:       { width: 36, height: 36, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  txIconSymbol:    { fontSize: 15, fontWeight: 'bold' },
  txInfo:          { flex: 1 },
  txNote:          { fontFamily: DLFonts.sans, fontSize: 14, fontWeight: '600', color: DL.text, marginBottom: 2 },
  txMeta:          { fontFamily: DLFonts.mono, fontSize: 8, color: DL.muted, letterSpacing: 0.5 },
  txAmount:        { fontFamily: DLFonts.mono, fontSize: 14, fontWeight: 'bold' },
  emptyState:      { alignItems: 'center', paddingVertical: 40, paddingHorizontal: 20 },
  emptyStateIcon:  { fontSize: 36, marginBottom: 12 },
  emptyStateTitle: { fontFamily: DLFonts.sans, fontSize: 16, fontWeight: 'bold', color: DL.text, marginBottom: 6 },
  emptyStateText:  { fontFamily: DLFonts.sans, fontSize: 13, color: DL.muted, textAlign: 'center', lineHeight: 18 },
  fab: {
    position: 'absolute', bottom: 24, right: 20,
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: DL.text,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 6, elevation: 6, zIndex: 99,
  },
  fabText:         { fontSize: 28, fontWeight: 'bold', color: '#000000', lineHeight: 34 },
  demoBanner:      { backgroundColor: 'rgba(245, 158, 11, 0.12)', borderBottomWidth: 1, borderColor: 'rgba(245, 158, 11, 0.3)', paddingVertical: 8, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' },
  demoBannerText:  { fontSize: 9, color: '#F59E0B', fontFamily: DLFonts.sans, fontWeight: 'bold', textAlign: 'center' },
});
