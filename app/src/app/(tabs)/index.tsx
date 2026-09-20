import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  RefreshControl,
  ActivityIndicator,
  TextInput,
  Modal,
  Vibration,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import Reanimated, { SharedValue, useAnimatedStyle } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { DL, DLFonts } from '@/constants/design';
import { useBudget } from '@/context/BudgetContext';
import { Transaction } from '@/lib/expensesApi';
import { CustomAlert as Alert } from '@/components/CustomAlert';
import {
  PlusIcon,
  TrashIcon,
  CopyIcon,
  ShieldLockIcon,
  CheckIcon,
  LayersIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CalendarIcon,
  ArrowDownIcon,
  ArrowUpRightIcon,
  ContactlessIcon,
  AnalyticsIcon,
  TargetIcon,
} from '@/components/ui/TabIcons';
import { CategoryIcon, getCategoryEmoji } from '@/components/ui/CategoryIcon';
import { parseTransactionNote } from '@/lib/subcategories';

// ─── Swipe Action Components ──────────────────────────────────────────────────

function DeleteSwipeAction({
  prog,
  drag,
  onDelete,
}: {
  prog: SharedValue<number>;
  drag: SharedValue<number>;
  onDelete: () => void;
}) {
  const animStyle = useAnimatedStyle(() => {
    const scale = Math.min(1, Math.max(0.5, prog.value));
    return {
      transform: [
        { translateX: drag.value + 76 },
        { scale },
      ],
      opacity: prog.value,
    };
  });

  return (
    <Reanimated.View style={[styles.deleteActionWrap, animStyle]}>
      <Pressable style={styles.actionBtnInner} onPress={onDelete}>
        <TrashIcon color="#FFFFFF" size={18} />
        <Text style={styles.actionBtnText}>DELETE</Text>
      </Pressable>
    </Reanimated.View>
  );
}

function DuplicateSwipeAction({
  prog,
  drag,
  onDuplicate,
}: {
  prog: SharedValue<number>;
  drag: SharedValue<number>;
  onDuplicate: () => void;
}) {
  const animStyle = useAnimatedStyle(() => {
    const scale = Math.min(1, Math.max(0.5, prog.value));
    return {
      transform: [
        { translateX: drag.value - 76 },
        { scale },
      ],
      opacity: prog.value,
    };
  });

  return (
    <Reanimated.View style={[styles.duplicateActionWrap, animStyle]}>
      <Pressable style={styles.actionBtnInner} onPress={onDuplicate}>
        <CopyIcon color="#FFFFFF" size={18} />
        <Text style={[styles.actionBtnText, { color: '#06B6D4' }]}>REPEAT</Text>
      </Pressable>
    </Reanimated.View>
  );
}

// ─── Memoized Transaction Item Component ──────────────────────────────────────

const TransactionRow = React.memo(function TransactionRow({
  tx,
  isSelectMode,
  isSelected,
  onToggleSelect,
  onPress,
  onLongPress,
  onDuplicate,
  onDelete,
}: {
  tx: Transaction;
  isSelectMode: boolean;
  isSelected: boolean;
  onToggleSelect: (id: string) => void;
  onPress: (id: string) => void;
  onLongPress: (id: string) => void;
  onDuplicate: (tx: Transaction) => void;
  onDelete: (tx: Transaction) => void;
}) {
  const isIncome = tx.type === 'income';
  const parsed = useMemo(() => parseTransactionNote(tx.note), [tx.note]);
  const mainTitle = tx.category?.name || (isIncome ? 'Income' : 'Expense');
  const subTitle = parsed.subcategory
    ? (parsed.detail ? `${parsed.subcategory} • ${parsed.detail}` : parsed.subcategory)
    : (parsed.detail || 'General');

  const handleDuplicate = useCallback(() => onDuplicate(tx), [tx, onDuplicate]);
  const handleDelete = useCallback(() => onDelete(tx), [tx, onDelete]);
  const handlePress = useCallback(() => {
    Vibration.vibrate(10);
    if (isSelectMode) {
      onToggleSelect(tx.id);
    } else {
      onPress(tx.id);
    }
  }, [isSelectMode, tx.id, onToggleSelect, onPress]);
  const handleLongPress = useCallback(() => {
    Vibration.vibrate(30);
    onLongPress(tx.id);
  }, [tx.id, onLongPress]);

  if (isSelectMode) {
    return (
      <Pressable
        style={({ pressed }) => [
          styles.txCard,
          isSelected && styles.txCardChecked,
          pressed && styles.txCardPressed,
        ]}
        onPress={handlePress}
      >
        <View style={[styles.checkbox, isSelected && styles.checkboxChecked]}>
          {isSelected && <CheckIcon color="#FFFFFF" size={14} />}
        </View>

        <View style={styles.txLeft}>
          <CategoryIcon
            icon={tx.category?.icon}
            name={tx.category?.name}
            size={38}
            fontSize={18}
          />
          <View style={{ flex: 1 }}>
            <View style={styles.titleRow}>
              <Text style={styles.txTitle} numberOfLines={1}>
                {mainTitle}
              </Text>
              {parsed.subcategory && (
                <View style={styles.subcatPill}>
                  <Text style={styles.subcatPillText}>{parsed.subcategory}</Text>
                </View>
              )}
            </View>
            <Text style={styles.txCategory} numberOfLines={1}>
              {subTitle}
            </Text>
          </View>
        </View>

        <Text
          style={[
            styles.txAmount,
            isIncome ? styles.txAmountIncome : styles.txAmountExpense,
          ]}
        >
          {isIncome ? '+' : '-'}₹{Math.abs(tx.amount).toLocaleString('en-IN')}
        </Text>
      </Pressable>
    );
  }

  return (
    <View style={styles.swipeContainer}>
      <ReanimatedSwipeable
        friction={1.6}
        overshootFriction={10}
        overshootRight={false}
        overshootLeft={false}
        rightThreshold={35}
        leftThreshold={35}
        renderLeftActions={(prog, drag) => (
          <DuplicateSwipeAction
            prog={prog}
            drag={drag}
            onDuplicate={handleDuplicate}
          />
        )}
        renderRightActions={(prog, drag) => (
          <DeleteSwipeAction
            prog={prog}
            drag={drag}
            onDelete={handleDelete}
          />
        )}
      >
        <Pressable
          style={({ pressed }) => [styles.txCard, pressed && styles.txCardPressed]}
          onPress={handlePress}
          onLongPress={handleLongPress}
        >
          <View style={styles.txLeft}>
            <CategoryIcon
              icon={tx.category?.icon}
              name={tx.category?.name}
              size={38}
              fontSize={18}
            />
            <View style={{ flex: 1 }}>
              <View style={styles.titleRow}>
                <Text style={styles.txTitle} numberOfLines={1}>
                  {mainTitle}
                </Text>
                {parsed.subcategory && (
                  <View style={styles.subcatPill}>
                    <Text style={styles.subcatPillText}>{parsed.subcategory}</Text>
                  </View>
                )}
              </View>
              <Text style={styles.txCategory} numberOfLines={1}>
                {subTitle}
                {tx.regret && (
                  <Text style={styles.txRegret}> • {tx.regret}</Text>
                )}
              </Text>
            </View>
          </View>

          <Text
            style={[
              styles.txAmount,
              isIncome ? styles.txAmountIncome : styles.txAmountExpense,
            ]}
          >
            {isIncome ? '+' : '-'}₹{Math.abs(tx.amount).toLocaleString('en-IN')}
          </Text>
        </Pressable>
      </ReanimatedSwipeable>
    </View>
  );
});

// ─── Helper: Format Date Grouping ─────────────────────────────────────────────
type GroupKey = 'Today' | 'Yesterday' | 'This Week' | 'Earlier';

function getGroupKey(dateStr: string): GroupKey {
  const date = new Date(dateStr);
  const now = new Date();

  const isSameDay = (d1: Date, d2: Date) =>
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate();

  if (isSameDay(date, now)) return 'Today';

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (isSameDay(date, yesterday)) return 'Yesterday';

  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays <= 7) return 'This Week';

  return 'Earlier';
}

// ─── Bulk Add Item Draft Type ─────────────────────────────────────────────────
interface BulkItemDraft {
  id: string;
  amount: string;
  category_id: string;
  note: string;
}

export default function TrackerScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const {
    activeMonth,
    budgetMonth,
    budgetState,
    healthState,
    transactions,
    categories,
    vaultBalance,
    isLoading,
    refreshData,
    changeMonth,
    resetMonthData,
    deleteTransactionContext,
    duplicateTransactionContext,
    bulkDeleteTransactions,
    bulkAddTransactions,
    depositToVault,
    withdrawFromVault,
  } = useBudget();

  const [refreshing, setRefreshing] = useState(false);
  const [filterType, setFilterType] = useState<'all' | 'expense' | 'income'>('all');
  const [selectedCatId, setSelectedCatId] = useState<string | null>(null);

  // ─── Month Navigation & Reset Modal ─────────────────────────────────────────
  const [showMonthModal, setShowMonthModal] = useState(false);
  const [isResettingMonth, setIsResettingMonth] = useState(false);

  // ─── Bulk Selection State ───────────────────────────────────────────────────
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedTxIds, setSelectedTxIds] = useState<Set<string>>(new Set());

  // ─── Bulk Add Modal State ───────────────────────────────────────────────────
  const [showBulkAddModal, setShowBulkAddModal] = useState(false);
  const [bulkDrafts, setBulkDrafts] = useState<BulkItemDraft[]>([]);
  const [isSubmittingBulkAdd, setIsSubmittingBulkAdd] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshData();
    setRefreshing(false);
  }, [refreshData]);

  // Formatted Month Header
  const formattedMonth = useMemo(() => {
    if (!activeMonth) return '';
    const [year, m] = activeMonth.split('-');
    const date = new Date(parseInt(year), parseInt(m) - 1, 1);
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }).toUpperCase();
  }, [activeMonth]);

  // Month navigation handlers
  const handlePrevMonth = () => {
    if (!activeMonth) return;
    const [y, m] = activeMonth.split('-').map(Number);
    const d = new Date(y, m - 2, 1);
    const prevStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    changeMonth(prevStr);
  };

  const handleNextMonth = () => {
    if (!activeMonth) return;
    const [y, m] = activeMonth.split('-').map(Number);
    const d = new Date(y, m, 1);
    const nextStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    changeMonth(nextStr);
  };

  const handleJumpToMonth = (monthOffset: number) => {
    const now = new Date();
    const d = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
    const targetStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    changeMonth(targetStr);
    setShowMonthModal(false);
  };

  const handleResetCurrentMonth = () => {
    Alert.alert(
      'Reset & Start Fresh',
      `Delete all transactions and reset data for ${formattedMonth}? This gives you a completely clean slate for this month.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset Month',
          style: 'destructive',
          onPress: async () => {
            try {
              setIsResettingMonth(true);
              Vibration.vibrate(80);
              await resetMonthData(activeMonth);
              setShowMonthModal(false);
              Alert.alert('Fresh Start', `All transactions for ${formattedMonth} have been cleared.`);
            } catch (e: any) {
              Alert.alert('Error', e.message || 'Failed to reset month');
            } finally {
              setIsResettingMonth(false);
            }
          },
        },
      ]
    );
  };

  // Quick 1-step vault actions
  const handleQuickDeposit = async (amt: number) => {
    try {
      Vibration.vibrate(40);
      await depositToVault(amt, 'Quick Vault Deposit');
      Alert.alert('Vault Updated', `₹${amt.toLocaleString('en-IN')} stored into Vault.`);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Deposit failed');
    }
  };

  const handleQuickWithdraw = (amt: number) => {
    if (amt > vaultBalance) {
      Alert.alert('Vault Balance Low', `You have ₹${vaultBalance.toLocaleString('en-IN')} in vault.`);
      return;
    }
    Alert.alert(
      'Withdraw & Spend',
      `Withdrawing ₹${amt.toLocaleString('en-IN')} will record it as spent from your reserve. Proceed?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Spend ₹' + amt.toLocaleString('en-IN'),
          style: 'destructive',
          onPress: async () => {
            try {
              Vibration.vibrate(60);
              await withdrawFromVault(amt, true, 'Vault withdrawal');
            } catch (e: any) {
              Alert.alert('Error', e.message || 'Withdrawal failed');
            }
          },
        },
      ]
    );
  };

  // Transaction Actions
  const handleDelete = (tx: Transaction) => {
    Alert.alert(
      'Delete Transaction',
      `Delete "${tx.note || tx.category?.name || 'Transaction'}" of ₹${Math.abs(tx.amount)}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            Vibration.vibrate(50);
            await deleteTransactionContext(tx.id);
          },
        },
      ]
    );
  };

  const handleDuplicate = async (tx: Transaction) => {
    try {
      Vibration.vibrate(40);
      await duplicateTransactionContext(tx);
      Alert.alert('Logged Again', `Repeated "${tx.note || tx.category?.name || 'Expense'}" for today.`);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Duplicate failed');
    }
  };

  const handleTxPress = useCallback((id: string) => {
    router.push({
      pathname: '/expenses/transaction',
      params: { id },
    });
  }, [router]);

  const handleTxLongPress = useCallback((id: string) => {
    setIsSelectMode(true);
    toggleSelectTx(id);
  }, []);

  // ─── Bulk Delete Handlers ───────────────────────────────────────────────────
  const toggleSelectTx = useCallback((id: string) => {
    Vibration.vibrate(20);
    setSelectedTxIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const handleSelectAll = () => {
    if (selectedTxIds.size === filteredTransactions.length) {
      setSelectedTxIds(new Set());
    } else {
      setSelectedTxIds(new Set(filteredTransactions.map((t) => t.id)));
    }
  };

  const handleConfirmBulkDelete = () => {
    if (selectedTxIds.size === 0) return;
    const count = selectedTxIds.size;
    Alert.alert(
      'Bulk Delete',
      `Permanently delete ${count} selected transaction${count > 1 ? 's' : ''}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: `Delete ${count}`,
          style: 'destructive',
          onPress: async () => {
            try {
              Vibration.vibrate(60);
              await bulkDeleteTransactions(Array.from(selectedTxIds));
              setSelectedTxIds(new Set());
              setIsSelectMode(false);
              Alert.alert('Deleted', `${count} transactions deleted.`);
            } catch (e: any) {
              Alert.alert('Error', e.message || 'Bulk delete failed');
            }
          },
        },
      ]
    );
  };

  // ─── Bulk Add Handlers ──────────────────────────────────────────────────────
  const handleOpenBulkAdd = () => {
    const defaultCatId = categories[0]?.id || '';
    setBulkDrafts([
      { id: '1', amount: '', category_id: defaultCatId, note: '' },
      { id: '2', amount: '', category_id: defaultCatId, note: '' },
      { id: '3', amount: '', category_id: defaultCatId, note: '' },
    ]);
    setShowBulkAddModal(true);
  };

  const handleAddBulkRow = () => {
    const defaultCatId = categories[0]?.id || '';
    setBulkDrafts((prev) => [
      ...prev,
      { id: String(Date.now()), amount: '', category_id: defaultCatId, note: '' },
    ]);
  };

  const handleQuickAddPreset = (note: string, amount: number, catNameHint: string) => {
    const foundCat = categories.find((c) =>
      c.name.toLowerCase().includes(catNameHint.toLowerCase())
    ) || categories[0];
    const catId = foundCat ? foundCat.id : '';

    setBulkDrafts((prev) => [
      ...prev,
      {
        id: String(Date.now()),
        amount: String(amount),
        category_id: catId,
        note,
      },
    ]);
  };

  const handleSaveBulkAdd = async () => {
    const validItems = bulkDrafts
      .map((d) => ({
        amount: parseFloat(d.amount),
        category_id: d.category_id,
        note: d.note.trim() || null,
        type: 'expense' as const,
      }))
      .filter((item) => !isNaN(item.amount) && item.amount > 0 && item.category_id);

    if (validItems.length === 0) {
      Alert.alert('No Valid Entries', 'Please enter at least one expense with amount and category.');
      return;
    }

    setIsSubmittingBulkAdd(true);
    try {
      await bulkAddTransactions(validItems);
      setShowBulkAddModal(false);
      Alert.alert('Bulk Added', `Successfully logged ${validItems.length} expenses.`);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Bulk add failed');
    } finally {
      setIsSubmittingBulkAdd(false);
    }
  };

  // Filtered & Grouped Transactions
  const filteredTransactions = useMemo(() => {
    return transactions.filter((t) => {
      if (filterType === 'expense' && t.type !== 'expense') return false;
      if (filterType === 'income' && t.type !== 'income') return false;
      if (selectedCatId && t.category_id !== selectedCatId) return false;
      return true;
    });
  }, [transactions, filterType, selectedCatId]);

  const groupedTransactions = useMemo(() => {
    const groups: Record<GroupKey, Transaction[]> = {
      Today: [],
      Yesterday: [],
      'This Week': [],
      Earlier: [],
    };

    filteredTransactions.forEach((tx) => {
      const key = getGroupKey(tx.occurred_at);
      groups[key].push(tx);
    });

    return groups;
  }, [filteredTransactions]);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Ambient Decorative Background Glows for Luminous Depth */}
      <View style={styles.ambientGlowTopLeft} pointerEvents="none" />
      <View style={styles.ambientGlowTopRight} pointerEvents="none" />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={DL.muted} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Top Header: Generous Breathing Room & Month Picker (Like Screenshot) */}
        <View style={styles.topHeader}>
          <View style={styles.headerLeft}>
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarText}>DL</Text>
            </View>
            <View>
              <Text style={styles.headerGreeting}>WELCOME BACK</Text>
              <Pressable
                style={({ pressed }) => [styles.monthPickerBtn, pressed && styles.btnPressed]}
                onPress={() => {
                  Vibration.vibrate(12);
                  setShowMonthModal(true);
                }}
                hitSlop={8}
              >
                <Text style={styles.monthPickerText}>{formattedMonth}</Text>
                <Text style={styles.monthPickerCaret}>▾</Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.headerRight}>
            <View style={styles.stepperCapsule}>
              <Pressable
                style={({ pressed }) => [styles.stepperArrow, pressed && styles.btnPressed]}
                onPress={() => {
                  Vibration.vibrate(10);
                  handlePrevMonth();
                }}
                hitSlop={8}
              >
                <ChevronLeftIcon color="#0F172A" size={14} />
              </Pressable>
              <View style={styles.stepperDivider} />
              <Pressable
                style={({ pressed }) => [styles.stepperArrow, pressed && styles.btnPressed]}
                onPress={() => {
                  Vibration.vibrate(10);
                  handleNextMonth();
                }}
                hitSlop={8}
              >
                <ChevronRightIcon color="#0F172A" size={14} />
              </Pressable>
            </View>

            <Pressable
              style={({ pressed }) => [
                styles.headerIconBtn,
                isSelectMode && styles.headerIconBtnActive,
                pressed && styles.btnPressed,
              ]}
              onPress={() => {
                Vibration.vibrate(12);
                setIsSelectMode(!isSelectMode);
                setSelectedTxIds(new Set());
              }}
              hitSlop={8}
            >
              <LayersIcon color={isSelectMode ? '#FFFFFF' : '#0F172A'} size={17} />
            </Pressable>
          </View>
        </View>

        {/* ─── Hero Credit Card: Exact Replica of Picture 2 ─── */}
        <View style={styles.cardContainer}>
          <LinearGradient
            colors={DL.cardGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.heroCardGradient}
          >
            {/* Ambient glossy curved orb inside card */}
            <View style={styles.cardInternalOrb} />

            {/* Top Row: Bank Name + Debit Badge */}
            <View style={styles.heroCardTop}>
              <Text style={styles.cardBankName}>DreamList Bank</Text>
              <View style={styles.cardDebitBadge}>
                <Text style={styles.cardDebitText}>Debit</Text>
              </View>
            </View>

            {/* Balance Display */}
            <View style={styles.heroCardBalanceWrap}>
              <Text style={styles.heroCardBalance}>
                ₹{Math.round(budgetState.remaining).toLocaleString('en-IN')}
              </Text>
              <Text style={styles.cardMaskedNumber}>•••• 0125 •••••••• 76362</Text>
            </View>

            {/* Bottom Row: VISA Logo + Contactless Icon + Expiry Date */}
            <View style={styles.heroCardBottom}>
              <Text style={styles.visaText}>VISA</Text>
              <View style={styles.heroCardBottomRight}>
                <Text style={styles.cardExpVal}>
                  Exp {activeMonth ? `${activeMonth.split('-')[1]}/${activeMonth.split('-')[0].slice(2)}` : '05/29'}
                </Text>
                <ContactlessIcon color="#FFFFFF" size={18} />
              </View>
            </View>
          </LinearGradient>

          {/* Underlay frosted peek edge (stacked 3D credit card look from pic 2) */}
          <View style={styles.cardUnderlay} />
        </View>

        {/* ─── Quick Actions Row (modeled on picture 2) ─── */}
        <View style={styles.quickActionsCard}>
          {/* 1. Insights / Analytics */}
          <Pressable
            style={({ pressed }) => [styles.quickActionBtn, pressed && styles.btnPressed]}
            onPress={() => {
              Vibration.vibrate(12);
              router.push('/expenses/insights');
            }}
            hitSlop={6}
          >
            <View style={styles.quickActionCircle}>
              <AnalyticsIcon color="#2563EB" size={19} />
            </View>
            <Text style={styles.quickActionLabel}>Insights</Text>
          </Pressable>

          {/* 2. LOG SPEND (Prominent Center Button with Cyan-Purple Gradient) */}
          <Pressable
            style={({ pressed }) => [styles.quickCenterActionBtn, pressed && styles.btnPressed]}
            onPress={() => {
              Vibration.vibrate(20);
              router.push('/expenses/transaction');
            }}
            hitSlop={6}
          >
            <LinearGradient
              colors={DL.cardGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.quickCenterCircle}
            >
              <PlusIcon color="#FFFFFF" size={24} />
            </LinearGradient>
            <Text style={styles.quickCenterLabel}>LOG SPEND</Text>
          </Pressable>

          {/* 3. Envelopes / Category Targets */}
          <Pressable
            style={({ pressed }) => [styles.quickActionBtn, pressed && styles.btnPressed]}
            onPress={() => {
              Vibration.vibrate(12);
              router.push('/expenses/categories');
            }}
            hitSlop={6}
          >
            <View style={styles.quickActionCircle}>
              <TargetIcon color="#2563EB" size={19} />
            </View>
            <Text style={styles.quickActionLabel}>Envelopes</Text>
          </Pressable>

          {/* 4. Bulk Add */}
          <Pressable
            style={({ pressed }) => [styles.quickActionBtn, pressed && styles.btnPressed]}
            onPress={() => {
              Vibration.vibrate(12);
              handleOpenBulkAdd();
            }}
            hitSlop={6}
          >
            <View style={styles.quickActionCircle}>
              <LayersIcon color="#2563EB" size={17} />
            </View>
            <Text style={styles.quickActionLabel}>Bulk Add</Text>
          </Pressable>
        </View>

        {/* 1-Step Quick Vault Pill */}
        <View style={styles.vaultPillCard}>
          <View style={styles.vaultLeft}>
            <ShieldLockIcon color="#2563EB" size={18} />
            <View>
              <Text style={styles.vaultPillTitle}>VAULT RESERVE</Text>
              <Text style={styles.vaultPillBalance}>
                ₹{Math.round(vaultBalance).toLocaleString('en-IN')}
              </Text>
            </View>
          </View>

          <View style={styles.vaultPillActions}>
            <Pressable
              style={({ pressed }) => [styles.vaultPillMore, pressed && styles.btnPressed]}
              onPress={() => {
                Vibration.vibrate(10);
                router.push('/(tabs)/vault');
              }}
            >
              <Text style={styles.vaultPillMoreText}>OPEN VAULT →</Text>
            </Pressable>
          </View>
        </View>

        {/* ─── Spend Analysis (Spaced-Out Rounded Bubbles from Pictures 1 & 2) ─── */}
        <View style={styles.sectionHeaderWrap}>
          <View>
            <Text style={styles.sectionTitle}>SPEND ANALYSIS</Text>
            <Text style={styles.sectionSubtitle}>
              {selectedCatId ? 'Tap bubble to clear filter' : 'Tap category to filter transactions'}
            </Text>
          </View>
          {selectedCatId && (
            <Pressable
              style={({ pressed }) => [styles.clearFilterBtn, pressed && styles.btnPressed]}
              onPress={() => {
                Vibration.vibrate(10);
                setSelectedCatId(null);
              }}
            >
              <Text style={styles.clearFilterText}>SHOW ALL</Text>
            </Pressable>
          )}
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.envelopeScrollList}
        >
          {budgetState.categories.map((catStatus) => {
            const isSelected = selectedCatId === catStatus.category_id;
            const pct = catStatus.limit > 0 ? Math.min(100, Math.round((catStatus.spent / catStatus.limit) * 100)) : 0;
            const categoryMeta = categories.find((c) => c.id === catStatus.category_id);

            return (
              <Pressable
                key={catStatus.category_id}
                style={({ pressed }) => [
                  styles.envelopeCard,
                  isSelected && styles.envelopeCardSelected,
                  pressed && styles.btnPressed,
                ]}
                onPress={() => {
                  Vibration.vibrate(10);
                  setSelectedCatId(isSelected ? null : catStatus.category_id);
                }}
              >
                <View style={styles.bubbleCircle}>
                  <CategoryIcon
                    icon={categoryMeta?.icon}
                    name={catStatus.category_name}
                    size={36}
                    fontSize={18}
                  />
                </View>
                <Text style={styles.envelopeCardSpent}>
                  ₹{Math.round(catStatus.spent).toLocaleString('en-IN')}
                </Text>
                <Text style={styles.envelopeCardName} numberOfLines={1}>
                  {catStatus.category_name}
                </Text>
                {catStatus.limit > 0 && (
                  <View style={styles.miniTrack}>
                    <View
                      style={[
                        styles.miniBar,
                        {
                          width: `${pct}%`,
                          backgroundColor: catStatus.isOverspent
                            ? '#EF4444'
                            : pct > 80
                            ? '#F59E0B'
                            : '#2563EB',
                        },
                      ]}
                    />
                  </View>
                )}
              </Pressable>
            );
          })}
        </ScrollView>

        {/* ─── Transactions Header & Filters (Modeled on Screenshot) ─── */}
        <View style={styles.streamSectionHeader}>
          <View>
            <Text style={styles.transactionsMainTitle}>Transactions</Text>
            <Text style={styles.transactionsSubCount}>
              {filteredTransactions.length} items logged
            </Text>
          </View>

          {isSelectMode ? (
            <Pressable
              style={({ pressed }) => [styles.selectAllBtn, pressed && styles.btnPressed]}
              onPress={() => {
                Vibration.vibrate(12);
                handleSelectAll();
              }}
            >
              <Text style={styles.selectAllText}>
                {selectedTxIds.size === filteredTransactions.length ? 'DESELECT ALL' : 'SELECT ALL'}
              </Text>
            </Pressable>
          ) : (
            <View style={styles.filterPillGroup}>
              {(['all', 'expense', 'income'] as const).map((type) => (
                <Pressable
                  key={type}
                  style={({ pressed }) => [
                    styles.filterPill,
                    filterType === type && styles.filterPillActive,
                    pressed && styles.btnPressed,
                  ]}
                  onPress={() => {
                    Vibration.vibrate(10);
                    setFilterType(type);
                  }}
                >
                  <Text
                    style={[
                      styles.filterPillText,
                      filterType === type && styles.filterPillTextActive,
                    ]}
                  >
                    {type.toUpperCase()}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}
        </View>

        {/* Grouped Transactions Stream */}
        {(['Today', 'Yesterday', 'This Week', 'Earlier'] as GroupKey[]).map((groupKey) => {
          const list = groupedTransactions[groupKey];
          if (!list || list.length === 0) return null;

          return (
            <View key={groupKey} style={styles.groupContainer}>
              <Text style={styles.groupHeader}>{groupKey.toUpperCase()}</Text>
              {list.map((tx) => (
                <TransactionRow
                  key={tx.id}
                  tx={tx}
                  isSelectMode={isSelectMode}
                  isSelected={selectedTxIds.has(tx.id)}
                  onToggleSelect={toggleSelectTx}
                  onPress={handleTxPress}
                  onLongPress={handleTxLongPress}
                  onDuplicate={handleDuplicate}
                  onDelete={handleDelete}
                />
              ))}
            </View>
          );
        })}

        {isLoading && (
          <View style={styles.loadingBanner}>
            <ActivityIndicator size="small" color="#2563EB" />
            <Text style={styles.loadingBannerText}>Updating month data...</Text>
          </View>
        )}

        {transactions.length === 0 && !isLoading && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>💳</Text>
            <Text style={styles.emptyTitle}>No Transactions Logged</Text>
            <Text style={styles.emptySubtitle}>
              Tap LOG SPEND or Bulk Add to log your spending for {formattedMonth}.
            </Text>
          </View>
        )}

        <View style={{ height: 140 }} />
      </ScrollView>

      {/* Floating Quick Log Spend Button (Floats right above the floating nav bar) */}
      {!isSelectMode && (
        <Pressable
          style={({ pressed }) => [
            styles.floatingQuickLogBtn,
            pressed && { transform: [{ scale: 0.94 }], opacity: 0.9 },
          ]}
          onPress={() => {
            Vibration.vibrate(15);
            router.push('/expenses/transaction');
          }}
          hitSlop={10}
        >
          <LinearGradient
            colors={DL.cardGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.floatingQuickLogGradient}
          >
            <PlusIcon color="#FFFFFF" size={17} />
            <Text style={styles.floatingQuickLogText}>LOG SPEND</Text>
          </LinearGradient>
        </Pressable>
      )}

      {/* Bulk Delete Action Bar (floats above the floating tab bar during select mode) */}
      {isSelectMode && (
        <View style={styles.bulkActionBar}>
          <Text style={styles.bulkCountText}>{selectedTxIds.size} Selected</Text>
          <Pressable
            style={({ pressed }) => [
              styles.bulkDeleteBtn,
              selectedTxIds.size === 0 && { opacity: 0.4 },
              pressed && styles.btnPressed,
            ]}
            onPress={handleConfirmBulkDelete}
            disabled={selectedTxIds.size === 0}
          >
            <TrashIcon color="#FFFFFF" size={16} />
            <Text style={styles.bulkDeleteBtnText}>DELETE ({selectedTxIds.size})</Text>
          </Pressable>
        </View>
      )}

      {/* ─── Bulk Add Modal ──────────────────────────────────────────────── */}
      <Modal visible={showBulkAddModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { maxHeight: '86%' }]}>
            <View style={styles.modalHeaderRow}>
              <View>
                <Text style={styles.modalTitle}>BULK LOG EXPENSES</Text>
                <Text style={styles.modalSub}>Log several expenses at once in seconds.</Text>
              </View>
              <Pressable
                style={styles.modalCloseBtn}
                onPress={() => setShowBulkAddModal(false)}
              >
                <Text style={styles.modalCloseText}>✕</Text>
              </Pressable>
            </View>

            {/* Quick Presets Row */}
            <Text style={styles.presetHeading}>QUICK TAP PRESETS</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.presetScroll}>
              <Pressable
                style={styles.presetPill}
                onPress={() => handleQuickAddPreset('Coffee', 120, 'food')}
              >
                <Text style={styles.presetPillText}>☕ Coffee ₹120</Text>
              </Pressable>
              <Pressable
                style={styles.presetPill}
                onPress={() => handleQuickAddPreset('Lunch', 280, 'food')}
              >
                <Text style={styles.presetPillText}>🍔 Lunch ₹280</Text>
              </Pressable>
              <Pressable
                style={styles.presetPill}
                onPress={() => handleQuickAddPreset('Commute', 80, 'transport')}
              >
                <Text style={styles.presetPillText}>🚇 Commute ₹80</Text>
              </Pressable>
              <Pressable
                style={styles.presetPill}
                onPress={() => handleQuickAddPreset('Grocery', 450, 'food')}
              >
                <Text style={styles.presetPillText}>🛒 Grocery ₹450</Text>
              </Pressable>
              <Pressable
                style={styles.presetPill}
                onPress={() => handleQuickAddPreset('Snacks', 150, 'food')}
              >
                <Text style={styles.presetPillText}>🍿 Snacks ₹150</Text>
              </Pressable>
            </ScrollView>

            {/* Draft Rows Table */}
            <ScrollView style={{ marginTop: 8 }} showsVerticalScrollIndicator={false}>
              {bulkDrafts.map((draft, idx) => (
                <View key={draft.id} style={styles.bulkRow}>
                  <Text style={styles.bulkRowIdx}>#{idx + 1}</Text>
                  <TextInput
                    style={styles.bulkAmountInput}
                    keyboardType="numeric"
                    placeholder="₹ Amount"
                    placeholderTextColor="#6B7280"
                    value={draft.amount}
                    onChangeText={(val) => {
                      setBulkDrafts((prev) =>
                        prev.map((d) => (d.id === draft.id ? { ...d, amount: val } : d))
                      );
                    }}
                  />
                  <TextInput
                    style={styles.bulkNoteInput}
                    placeholder="Note (e.g. Lunch)"
                    placeholderTextColor="#6B7280"
                    value={draft.note}
                    onChangeText={(val) => {
                      setBulkDrafts((prev) =>
                        prev.map((d) => (d.id === draft.id ? { ...d, note: val } : d))
                      );
                    }}
                  />
                  {/* Remove row button */}
                  {bulkDrafts.length > 1 && (
                    <Pressable
                      style={styles.bulkRemoveBtn}
                      onPress={() => {
                        setBulkDrafts((prev) => prev.filter((d) => d.id !== draft.id));
                      }}
                    >
                      <Text style={styles.bulkRemoveText}>✕</Text>
                    </Pressable>
                  )}
                </View>
              ))}

              <Pressable style={styles.addMoreRowBtn} onPress={handleAddBulkRow}>
                <Text style={styles.addMoreRowText}>+ ADD ANOTHER ROW</Text>
              </Pressable>
            </ScrollView>

            <View style={styles.modalBtnRow}>
              <Pressable style={styles.cancelBtn} onPress={() => setShowBulkAddModal(false)}>
                <Text style={styles.cancelBtnText}>CANCEL</Text>
              </Pressable>
              <Pressable
                style={[styles.submitBtn, isSubmittingBulkAdd && { opacity: 0.6 }]}
                onPress={handleSaveBulkAdd}
                disabled={isSubmittingBulkAdd}
              >
                {isSubmittingBulkAdd ? (
                  <ActivityIndicator color="#000" />
                ) : (
                  <Text style={styles.submitBtnText}>SAVE ALL</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* ─── Month Navigation & Fresh Start Modal ───────────────────────── */}
      <Modal
        visible={showMonthModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowMonthModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeaderRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <CalendarIcon color="#10B981" size={20} />
                <Text style={styles.modalTitle}>MONTH & FRESH START</Text>
              </View>
              <Pressable
                style={styles.modalCloseBtn}
                onPress={() => setShowMonthModal(false)}
                hitSlop={10}
              >
                <Text style={styles.modalCloseText}>✕</Text>
              </Pressable>
            </View>

            {/* Current View Info */}
            <View style={styles.monthStatusBox}>
              <Text style={styles.monthStatusLabel}>CURRENTLY VIEWING</Text>
              <Text style={styles.monthStatusMonth}>{formattedMonth}</Text>
              <View style={styles.monthStatPillsRow}>
                <View style={styles.monthStatPill}>
                  <Text style={styles.monthStatPillLabel}>TRANSACTIONS</Text>
                  <Text style={styles.monthStatPillVal}>{transactions.length} items</Text>
                </View>
                <View style={styles.monthStatPill}>
                  <Text style={styles.monthStatPillLabel}>SPENT</Text>
                  <Text style={styles.monthStatPillVal}>
                    ₹{Math.round(budgetState.spent).toLocaleString('en-IN')}
                  </Text>
                </View>
              </View>
            </View>

            {/* Quick Month Switch Buttons */}
            <Text style={styles.sectionModalLabel}>SWITCH MONTH</Text>
            <View style={styles.quickJumpRow}>
              <Pressable style={styles.quickJumpBtn} onPress={() => handleJumpToMonth(-1)}>
                <Text style={styles.quickJumpBtnText}>‹ PREV</Text>
              </Pressable>
              <Pressable
                style={[styles.quickJumpBtn, styles.quickJumpBtnActive]}
                onPress={() => handleJumpToMonth(0)}
              >
                <Text style={[styles.quickJumpBtnText, styles.quickJumpBtnActiveText]}>
                  THIS MONTH
                </Text>
              </Pressable>
              <Pressable style={styles.quickJumpBtn} onPress={() => handleJumpToMonth(1)}>
                <Text style={styles.quickJumpBtnText}>NEXT ›</Text>
              </Pressable>
            </View>

            {/* Fresh Start / Reset Section */}
            <View style={styles.resetCard}>
              <View style={styles.resetCardHeader}>
                <TrashIcon color="#EF4444" size={16} />
                <Text style={styles.resetCardTitle}>FRESH START / RESET</Text>
              </View>
              <Text style={styles.resetCardDesc}>
                Stopped logging or want to restart fresh for {formattedMonth}? Wiping will delete all transactions and reset envelopes for this month.
              </Text>
              <Pressable
                style={[styles.resetActionBtn, isResettingMonth && { opacity: 0.6 }]}
                onPress={handleResetCurrentMonth}
                disabled={isResettingMonth}
              >
                {isResettingMonth ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.resetActionBtnText}>RESET & START FRESH FOR THIS MONTH</Text>
                )}
              </Pressable>
            </View>

            <Pressable style={styles.closeModalFullBtn} onPress={() => setShowMonthModal(false)}>
              <Text style={styles.closeModalFullBtnText}>CLOSE</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F0F4FC', // Luminous soft bluish-white canvas
  },
  ambientGlowTopLeft: {
    position: 'absolute',
    top: -30,
    left: -40,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(6, 182, 212, 0.09)',
  },
  ambientGlowTopRight: {
    position: 'absolute',
    top: 40,
    right: -50,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(124, 58, 237, 0.08)',
  },
  scrollContent: {
    paddingHorizontal: 18,
    paddingBottom: 24,
  },
  btnPressed: {
    opacity: 0.78,
    transform: [{ scale: 0.97 }],
  },

  // ─── Top Header: Clean, Airy & Spacious ──────────────────────────────
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 2,
    marginBottom: 4,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatarCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: 'rgba(37, 99, 235, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  avatarText: {
    fontFamily: DLFonts.mono,
    fontSize: 13,
    fontWeight: '800',
    color: '#2563EB',
  },
  headerGreeting: {
    fontFamily: DLFonts.mono,
    fontSize: 9,
    letterSpacing: 1.2,
    color: '#64748B',
    fontWeight: '700',
  },
  monthPickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 1,
  },
  monthPickerText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.2,
  },
  monthPickerCaret: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stepperCapsule: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.06)',
    paddingHorizontal: 4,
    paddingVertical: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  stepperArrow: {
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  stepperDivider: {
    width: 1,
    height: 14,
    backgroundColor: 'rgba(0, 0, 0, 0.08)',
  },
  headerIconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  headerIconBtnActive: {
    backgroundColor: '#0F172A',
    borderColor: '#0F172A',
  },

  // ─── Hero Credit Card: Exact Replica of Picture 2 ────────────────────
  cardContainer: {
    marginBottom: 22,
  },
  heroCardGradient: {
    borderRadius: 22,
    paddingHorizontal: 20,
    paddingVertical: 18,
    minHeight: 184,
    justifyContent: 'space-between',
    overflow: 'hidden',
    position: 'relative',
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.28,
    shadowRadius: 18,
    elevation: 8,
  },
  cardInternalOrb: {
    position: 'absolute',
    right: -25,
    bottom: -35,
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
  },
  heroCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardBankName: {
    fontFamily: DLFonts.sans,
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  cardDebitBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
  },
  cardDebitText: {
    fontFamily: DLFonts.sans,
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  heroCardBalanceWrap: {
    marginVertical: 10,
  },
  heroCardBalance: {
    fontSize: 34,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  cardMaskedNumber: {
    fontFamily: DLFonts.mono,
    fontSize: 12,
    fontWeight: '700',
    color: 'rgba(255, 255, 255, 0.85)',
    letterSpacing: 1.8,
    marginTop: 4,
  },
  heroCardBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 4,
  },
  visaText: {
    fontFamily: DLFonts.sans,
    fontSize: 20,
    fontWeight: '900',
    fontStyle: 'italic',
    color: '#FFFFFF',
    letterSpacing: 2,
  },
  heroCardBottomRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  cardExpVal: {
    fontFamily: DLFonts.mono,
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(255, 255, 255, 0.9)',
  },
  cardUnderlay: {
    height: 12,
    marginHorizontal: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(226, 232, 240, 0.85)',
    marginTop: -6,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },

  // ─── Quick Actions Row (modeled on picture 2) ────────────────────────
  quickActionsCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(226, 232, 240, 0.8)',
    paddingVertical: 14,
    paddingHorizontal: 12,
    marginBottom: 20,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  quickActionBtn: {
    alignItems: 'center',
    gap: 5,
    flex: 1,
  },
  quickActionCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(37, 99, 235, 0.12)',
  },
  quickActionLabel: {
    fontFamily: DLFonts.sans,
    fontSize: 10,
    fontWeight: '700',
    color: '#334155',
  },
  quickCenterActionBtn: {
    alignItems: 'center',
    gap: 5,
    flex: 1.2,
  },
  quickCenterCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 4,
  },
  quickCenterLabel: {
    fontFamily: DLFonts.sans,
    fontSize: 10,
    fontWeight: '800',
    color: '#0B132B',
    letterSpacing: 0.5,
  },

  // ─── Vault Pill Card ─────────────────────────────────────────────────
  vaultPillCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderColor: 'rgba(0, 0, 0, 0.05)',
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  },
  vaultLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  vaultPillTitle: {
    fontFamily: DLFonts.mono,
    fontSize: 9,
    fontWeight: '800',
    color: '#FF5E3A',
    letterSpacing: 1,
  },
  vaultPillBalance: {
    fontFamily: DLFonts.mono,
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 1,
  },
  vaultPillActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  vaultPillBtn: {
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  vaultPillBtnWd: {
    backgroundColor: '#FEE2E2',
  },
  vaultPillBtnText: {
    fontFamily: DLFonts.mono,
    fontSize: 10,
    fontWeight: '700',
    color: '#0F172A',
  },
  vaultPillMore: {
    backgroundColor: '#0F172A',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  vaultPillMoreText: {
    fontFamily: DLFonts.mono,
    fontSize: 9,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // ─── Active Envelopes ────────────────────────────────────────────────
  sectionHeaderWrap: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 14,
    paddingHorizontal: 2,
  },
  sectionTitle: {
    fontFamily: DLFonts.mono,
    fontSize: 10,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 1.5,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
  },
  clearFilterBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  clearFilterText: {
    fontFamily: DLFonts.mono,
    fontSize: 10,
    fontWeight: '700',
    color: '#2563EB',
    letterSpacing: 1,
  },
  envelopeScrollList: {
    gap: 12,
    paddingBottom: 16,
  },
  envelopeCard: {
    width: 120,
    backgroundColor: '#FFFFFF',
    borderColor: 'rgba(226, 232, 240, 0.85)',
    borderWidth: 1,
    borderRadius: 22,
    padding: 14,
    alignItems: 'center',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  envelopeCardSelected: {
    borderColor: '#2563EB',
    backgroundColor: '#EFF6FF',
  },
  bubbleCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  envelopeCardSpent: {
    fontFamily: DLFonts.mono,
    fontSize: 13,
    fontWeight: '800',
    color: '#0B132B',
    marginBottom: 2,
  },
  envelopeCardName: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#64748B',
    textAlign: 'center',
  },
  miniTrack: {
    width: '100%',
    height: 4,
    backgroundColor: '#F1F5F9',
    borderRadius: 2,
    marginTop: 8,
    overflow: 'hidden',
  },
  miniBar: {
    height: '100%',
    borderRadius: 2,
  },

  // ─── Transactions Stream (Directly from Screenshot) ───────────────────
  streamSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 14,
    paddingHorizontal: 2,
  },
  transactionsMainTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.3,
  },
  transactionsSubCount: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 1,
  },
  selectAllBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  selectAllText: {
    fontFamily: DLFonts.mono,
    fontSize: 10,
    fontWeight: '800',
    color: '#FF5E3A',
    letterSpacing: 1,
  },
  filterPillGroup: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderColor: 'rgba(0, 0, 0, 0.06)',
    borderWidth: 1,
    borderRadius: 12,
    padding: 3,
    gap: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1,
  },
  filterPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 9,
  },
  filterPillActive: {
    backgroundColor: '#0F172A',
  },
  filterPillText: {
    fontFamily: DLFonts.mono,
    fontSize: 9,
    color: '#64748B',
    letterSpacing: 0.8,
  },
  filterPillTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },

  // Grouped rows
  groupContainer: {
    marginBottom: 16,
  },
  groupHeader: {
    fontFamily: DLFonts.mono,
    fontSize: 10,
    letterSpacing: 1.5,
    color: '#94A3B8',
    marginBottom: 8,
    marginLeft: 4,
  },
  swipeContainer: {
    marginBottom: 8,
    borderRadius: 18,
    overflow: 'hidden',
  },
  txCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: 'rgba(0, 0, 0, 0.04)',
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 14,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  },
  txCardPressed: {
    backgroundColor: '#F8FAFC',
    transform: [{ scale: 0.99 }],
  },
  txCardChecked: {
    borderColor: '#10B981',
    backgroundColor: '#F0FDF4',
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 7,
    borderColor: 'rgba(0, 0, 0, 0.15)',
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  checkboxChecked: {
    backgroundColor: '#10B981',
    borderColor: '#10B981',
  },
  txLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    marginRight: 8,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  subcatPill: {
    backgroundColor: '#F1F5F9',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  subcatPillText: {
    fontFamily: DLFonts.mono,
    fontSize: 9,
    color: '#475569',
    fontWeight: '700',
  },
  txTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  txCategory: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  txRegret: {
    color: '#F59E0B',
  },
  txAmount: {
    fontFamily: DLFonts.mono,
    fontSize: 15,
    fontWeight: '800',
  },
  txAmountExpense: {
    color: '#EF4444',
  },
  txAmountIncome: {
    color: '#10B981',
  },
  deleteActionWrap: {
    width: 76,
    backgroundColor: '#EF4444',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 18,
  },
  duplicateActionWrap: {
    width: 76,
    backgroundColor: '#0F172A',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 18,
  },
  actionBtnInner: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  actionBtnText: {
    fontFamily: DLFonts.mono,
    fontSize: 9,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 1,
  },

  // Empty state
  emptyState: {
    alignItems: 'center',
    paddingVertical: 44,
  },
  emptyIcon: {
    fontSize: 40,
    marginBottom: 10,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 4,
    textAlign: 'center',
    maxWidth: 260,
  },

  // ─── Floating Center Action Button ────────────────────────────────────
  fabCenter: {
    position: 'absolute',
    bottom: 20,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#0F172A',
    paddingHorizontal: 22,
    paddingVertical: 14,
    borderRadius: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
  },
  fabIconCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#FF5E3A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fabCenterText: {
    fontFamily: DLFonts.mono,
    fontSize: 12,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 1.2,
  },

  // Select Mode Bottom Bar
  bulkActionBar: {
    position: 'absolute',
    bottom: 88,
    left: 18,
    right: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderColor: 'rgba(226, 232, 240, 0.95)',
    borderWidth: 1.5,
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingVertical: 14,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 16,
    elevation: 10,
  },
  bulkCountText: {
    fontFamily: DLFonts.mono,
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
  },
  bulkDeleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#EF4444',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
  },
  bulkDeleteBtnText: {
    fontFamily: DLFonts.mono,
    fontSize: 11,
    fontWeight: '800',
    color: '#FFFFFF',
  },

  // ─── Light Modals: Month & Bulk Add ──────────────────────────────────
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 22,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 12,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  modalTitle: {
    fontFamily: DLFonts.mono,
    fontSize: 14,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: 1.2,
  },
  modalSub: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 3,
    marginBottom: 14,
  },
  modalCloseBtn: {
    padding: 6,
  },
  modalCloseText: {
    fontSize: 18,
    color: '#64748B',
  },
  monthStatusBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.05)',
    marginBottom: 16,
  },
  monthStatusLabel: {
    fontFamily: DLFonts.mono,
    fontSize: 9,
    letterSpacing: 1.5,
    color: '#64748B',
  },
  monthStatusMonth: {
    fontSize: 20,
    fontWeight: '900',
    color: '#0F172A',
    marginTop: 2,
    marginBottom: 12,
  },
  monthStatPillsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  monthStatPill: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.05)',
  },
  monthStatPillLabel: {
    fontFamily: DLFonts.mono,
    fontSize: 8,
    color: '#64748B',
    letterSpacing: 1,
  },
  monthStatPillVal: {
    fontFamily: DLFonts.mono,
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 2,
  },
  sectionModalLabel: {
    fontFamily: DLFonts.mono,
    fontSize: 9,
    letterSpacing: 1.5,
    color: '#64748B',
    marginBottom: 8,
  },
  quickJumpRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  quickJumpBtn: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    paddingVertical: 11,
    alignItems: 'center',
  },
  quickJumpBtnActive: {
    backgroundColor: '#0F172A',
  },
  quickJumpBtnText: {
    fontFamily: DLFonts.mono,
    fontSize: 10,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 1,
  },
  quickJumpBtnActiveText: {
    color: '#FFFFFF',
  },
  resetCard: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FCA5A5',
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  resetCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  resetCardTitle: {
    fontFamily: DLFonts.mono,
    fontSize: 11,
    fontWeight: '900',
    color: '#DC2626',
    letterSpacing: 1,
  },
  resetCardDesc: {
    fontSize: 12,
    color: '#7F1D1D',
    lineHeight: 18,
    marginBottom: 14,
  },
  resetActionBtn: {
    backgroundColor: '#DC2626',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  resetActionBtnText: {
    fontFamily: DLFonts.mono,
    fontSize: 11,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 1,
  },
  closeModalFullBtn: {
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  closeModalFullBtnText: {
    fontFamily: DLFonts.mono,
    fontSize: 11,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 1,
  },

  // Bulk Add Modal internal
  presetHeading: {
    fontFamily: DLFonts.mono,
    fontSize: 9,
    letterSpacing: 1,
    color: '#64748B',
    marginBottom: 6,
  },
  presetScroll: {
    marginBottom: 12,
  },
  presetPill: {
    backgroundColor: '#F1F5F9',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 7,
    marginRight: 8,
  },
  presetPillText: {
    fontFamily: DLFonts.mono,
    fontSize: 11,
    fontWeight: '700',
    color: '#0F172A',
  },
  bulkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  bulkRowIdx: {
    fontFamily: DLFonts.mono,
    fontSize: 11,
    color: '#94A3B8',
    width: 20,
  },
  bulkAmountInput: {
    width: 95,
    backgroundColor: '#F8FAFC',
    borderColor: 'rgba(0, 0, 0, 0.08)',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 9,
    color: '#0F172A',
    fontFamily: DLFonts.mono,
    fontSize: 13,
  },
  bulkNoteInput: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderColor: 'rgba(0, 0, 0, 0.08)',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 9,
    color: '#0F172A',
    fontSize: 13,
  },
  bulkRemoveBtn: {
    padding: 6,
  },
  bulkRemoveText: {
    color: '#EF4444',
    fontSize: 14,
    fontWeight: 'bold',
  },
  addMoreRowBtn: {
    alignItems: 'center',
    paddingVertical: 11,
    borderColor: 'rgba(0, 0, 0, 0.12)',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 10,
    marginVertical: 8,
  },
  addMoreRowText: {
    fontFamily: DLFonts.mono,
    fontSize: 10,
    fontWeight: '800',
    color: '#FF5E3A',
    letterSpacing: 1,
  },
  modalBtnRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  cancelBtn: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  cancelBtnText: {
    fontFamily: DLFonts.mono,
    fontSize: 11,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 1,
  },
  submitBtn: {
    flex: 1,
    backgroundColor: '#0F172A',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  submitBtnText: {
    fontFamily: DLFonts.mono,
    fontSize: 11,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 1,
  },
  loadingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderColor: 'rgba(226, 232, 240, 0.8)',
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 10,
    marginVertical: 10,
  },
  loadingBannerText: {
    fontFamily: DLFonts.mono,
    fontSize: 11,
    color: '#2563EB',
    fontWeight: '700',
  },
  floatingQuickLogBtn: {
    position: 'absolute',
    bottom: 88,
    alignSelf: 'center',
    borderRadius: 22,
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.28,
    shadowRadius: 12,
    elevation: 8,
    zIndex: 10,
  },
  floatingQuickLogGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 22,
  },
  floatingQuickLogText: {
    fontFamily: DLFonts.sans,
    fontSize: 11,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.8,
  },
});

