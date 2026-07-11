import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  ActivityIndicator,
  Modal,
  ScrollView,
  Keyboard,
  TouchableWithoutFeedback,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DL, DLFonts } from '@/constants/design';
import { fetchCategories, createTransaction, updateTransaction, ExpenseCategory } from '@/lib/expensesApi';
import { getCachedItems } from '@/lib/database';
import type { WishlistItem } from '@/lib/types';

// ─── Demo-mode fallbacks ──────────────────────────────────────────────────────
const MOCK_EXPENSE_CATEGORIES: ExpenseCategory[] = [
  { id: 'cat-1', name: 'Food',          icon: 'Utensils',    color: '#F59E0B', is_default: true, type: 'expense', user_id: null, created_at: '' },
  { id: 'cat-2', name: 'Transport',     icon: 'Car',         color: '#3B82F6', is_default: true, type: 'expense', user_id: null, created_at: '' },
  { id: 'cat-3', name: 'Shopping',      icon: 'ShoppingBag', color: '#EC4899', is_default: true, type: 'expense', user_id: null, created_at: '' },
  { id: 'cat-4', name: 'Bills',         icon: 'CreditCard',  color: '#EF4444', is_default: true, type: 'expense', user_id: null, created_at: '' },
  { id: 'cat-5', name: 'Entertainment', icon: 'Tv',          color: '#8B5CF6', is_default: true, type: 'expense', user_id: null, created_at: '' },
  { id: 'cat-6', name: 'Health',        icon: 'Heart',       color: '#10B981', is_default: true, type: 'expense', user_id: null, created_at: '' },
  { id: 'cat-7', name: 'Other',         icon: 'Coins',       color: '#6B7280', is_default: true, type: 'expense', user_id: null, created_at: '' },
];

const MOCK_INCOME_CATEGORIES: ExpenseCategory[] = [
  { id: 'inc-1', name: 'Salary',       icon: 'Banknote',   color: '#22C55E', is_default: true, type: 'income', user_id: null, created_at: '' },
  { id: 'inc-2', name: 'Freelance',    icon: 'Laptop',     color: '#10B981', is_default: true, type: 'income', user_id: null, created_at: '' },
  { id: 'inc-3', name: 'Gift',         icon: 'Gift',       color: '#A78BFA', is_default: true, type: 'income', user_id: null, created_at: '' },
  { id: 'inc-4', name: 'Refund',       icon: 'RotateCcw',  color: '#38BDF8', is_default: true, type: 'income', user_id: null, created_at: '' },
  { id: 'inc-5', name: 'Other Income', icon: 'PlusCircle', color: '#6B7280', is_default: true, type: 'income', user_id: null, created_at: '' },
];

export default function TransactionModal() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams();

  const isEditMode = !!params.id;

  // ─── State ────────────────────────────────────────────────────────────────
  const [expenseCategories, setExpenseCategories] = useState<ExpenseCategory[]>([]);
  const [incomeCategories,  setIncomeCategories]  = useState<ExpenseCategory[]>([]);
  const [wishlistItems,     setWishlistItems]     = useState<WishlistItem[]>([]);
  const [loadingCats,  setLoadingCats]  = useState(true);
  const [submitting,   setSubmitting]   = useState(false);
  const [error,        setError]        = useState<string | null>(null);
  const [isDemoMode,   setIsDemoMode]   = useState(false);

  // Form states
  const [amountStr,         setAmountStr]         = useState('0');
  const [transactionType,   setTransactionType]   = useState<'expense' | 'income'>('expense');
  const [note,              setNote]              = useState('');
  const [selectedCategoryId,setSelectedCategoryId]= useState<string | null>(null);
  const [occurredAt,        setOccurredAt]        = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
  const [linkedItemId, setLinkedItemId] = useState<string | null>(null);

  // Modals
  const [categoryModalVisible, setCategoryModalVisible] = useState(false);
  const [wishlistModalVisible,  setWishlistModalVisible]  = useState(false);
  const [dateModalVisible,      setDateModalVisible]      = useState(false);
  const [wishlistSearch,        setWishlistSearch]        = useState('');

  // Calendar picker state
  const [calendarYear,  setCalendarYear]  = useState(() => new Date().getFullYear());
  const [calendarMonth, setCalendarMonth] = useState(() => new Date().getMonth() + 1);

  // ─── Derived: active category list ───────────────────────────────────────
  const activeCategories = transactionType === 'expense' ? expenseCategories : incomeCategories;

  // ─── Date chip label ─────────────────────────────────────────────────────
  const dateChipLabel = useMemo(() => {
    const parts = occurredAt.split('-');
    if (parts.length !== 3) return occurredAt;
    const date = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    return date.toLocaleDateString('default', { month: 'short', day: 'numeric' });
  }, [occurredAt]);

  // ─── Selected category lookup ─────────────────────────────────────────────
  const selectedCategory = useMemo(() => {
    return activeCategories.find((c) => c.id === selectedCategoryId);
  }, [activeCategories, selectedCategoryId]);

  const linkedItem = useMemo(() => {
    return wishlistItems.find((i) => i.id === linkedItemId);
  }, [wishlistItems, linkedItemId]);

  // ─── Load data ───────────────────────────────────────────────────────────
  useEffect(() => {
    async function loadData() {
      let expCats: ExpenseCategory[] = [];
      let incCats: ExpenseCategory[] = [];

      try {
        [expCats, incCats] = await Promise.all([
          fetchCategories('expense'),
          fetchCategories('income'),
        ]);
        setIsDemoMode(false);
      } catch (err: any) {
        console.warn('Failed to load categories, switching to demo mode:', err);
        expCats = MOCK_EXPENSE_CATEGORIES;
        incCats = MOCK_INCOME_CATEGORIES;
        setIsDemoMode(true);
      }

      setExpenseCategories(expCats);
      setIncomeCategories(incCats);

      // Load wishlist items for link-picker
      setWishlistItems(getCachedItems());

      if (isEditMode) {
        // Pre-fill existing transaction values
        if (params.amount)      setAmountStr(String(params.amount));
        if (params.note)        setNote(String(params.note));
        if (params.occurred_at) {
          setOccurredAt(String(params.occurred_at));
          const parts = String(params.occurred_at).split('-');
          if (parts.length === 3) {
            setCalendarYear(Number(parts[0]));
            setCalendarMonth(Number(parts[1]));
          }
        }
        // Restore type toggle
        if (params.type === 'income') {
          setTransactionType('income');
          if (params.category_id) setSelectedCategoryId(String(params.category_id));
        } else {
          setTransactionType('expense');
          if (params.category_id) setSelectedCategoryId(String(params.category_id));
        }
        if (params.linked_item_id && params.linked_item_id !== 'null') {
          setLinkedItemId(String(params.linked_item_id));
        }
      } else {
        // Pre-fill from wishlist link redirect
        if (params.note)   setNote(String(params.note));
        if (params.amount) {
          const val = Number(params.amount);
          if (val > 0) setAmountStr(String(val));
        }
        if (params.linked_item_id) setLinkedItemId(String(params.linked_item_id));

        // Map wishlist category → expense category
        let targetCatName = 'Shopping';
        if (params.category_name) {
          const wishCat = String(params.category_name);
          if (wishCat === 'Health & Practical') targetCatName = 'Health';
        }
        const defaultCat =
          expCats.find((c) => c.name.toLowerCase() === targetCatName.toLowerCase()) ||
          expCats.find((c) => c.is_default) ||
          (expCats.length > 0 ? expCats[0] : null);
        if (defaultCat) setSelectedCategoryId(defaultCat.id);
      }

      setLoadingCats(false);
    }
    loadData();
  }, [params.id, params.note, params.amount, params.category_name, params.linked_item_id, isEditMode]);

  // ─── When toggle changes, clear selected category (it belongs to old type) ─
  const handleToggleType = (newType: 'expense' | 'income') => {
    if (newType === transactionType) return;
    setTransactionType(newType);
    setSelectedCategoryId(null);
    // Also clear linked item when switching to income
    if (newType === 'income') setLinkedItemId(null);
  };

  // ─── Keypad ──────────────────────────────────────────────────────────────
  const handleKeyPress = (char: string) => {
    setError(null);
    if (char === '⌫') {
      setAmountStr((prev) => (prev.length <= 1 ? '0' : prev.slice(0, -1)));
    } else if (char === '.') {
      setAmountStr((prev) => (prev.includes('.') ? prev : prev + '.'));
    } else {
      setAmountStr((prev) => {
        if (prev === '0') return char;
        if (prev.includes('.')) {
          const parts = prev.split('.');
          if (parts[1] && parts[1].length >= 2) return prev;
        }
        return prev + char;
      });
    }
  };

  // ─── Submit ──────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    setError(null);
    const amountVal = parseFloat(amountStr);
    if (isNaN(amountVal) || amountVal <= 0) {
      setError('Please enter a valid amount.');
      return;
    }
    if (!selectedCategoryId) {
      setError('Please select a category.');
      return;
    }

    setSubmitting(true);
    try {
      if (isDemoMode) {
        await new Promise((resolve) => setTimeout(resolve, 500));
        router.back();
        return;
      }

      if (isEditMode && params.id) {
        await updateTransaction(String(params.id), {
          amount: amountVal,
          category_id: selectedCategoryId,
          note: note.trim() || null,
          occurred_at: occurredAt,
          linked_item_id: transactionType === 'income' ? null : linkedItemId,
          type: transactionType,
        });
      } else {
        await createTransaction({
          amount: amountVal,
          category_id: selectedCategoryId,
          note: note.trim() || null,
          occurred_at: occurredAt,
          source: linkedItemId ? 'wishlist_link' : 'manual',
          linked_item_id: transactionType === 'income' ? null : linkedItemId,
          type: transactionType,
        });
      }
      router.back();
    } catch (err: any) {
      setError(err.message || 'Failed to save transaction.');
    } finally {
      setSubmitting(false);
    }
  };

  const isValid = parseFloat(amountStr) > 0 && selectedCategoryId !== null;

  // ─── Calendar helpers ────────────────────────────────────────────────────
  const daysInMonthList = useMemo(() => {
    const daysCount = new Date(calendarYear, calendarMonth, 0).getDate();
    const firstDayIndex = new Date(calendarYear, calendarMonth - 1, 1).getDay();
    const list: { dayNum: number | null; dateStr: string | null }[] = [];
    for (let i = 0; i < firstDayIndex; i++) list.push({ dayNum: null, dateStr: null });
    for (let d = 1; d <= daysCount; d++) {
      list.push({
        dayNum: d,
        dateStr: `${calendarYear}-${String(calendarMonth).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
      });
    }
    return list;
  }, [calendarYear, calendarMonth]);

  const monthName = useMemo(() => {
    return new Date(calendarYear, calendarMonth - 1, 1)
      .toLocaleString('default', { month: 'long' })
      .toUpperCase();
  }, [calendarYear, calendarMonth]);

  const handlePrevMonth = () => {
    setCalendarMonth((m) => {
      if (m === 1) { setCalendarYear((y) => y - 1); return 12; }
      return m - 1;
    });
  };
  const handleNextMonth = () => {
    setCalendarMonth((m) => {
      if (m === 12) { setCalendarYear((y) => y + 1); return 1; }
      return m + 1;
    });
  };

  const filteredWishlistItems = useMemo(() => {
    if (!wishlistSearch.trim()) return wishlistItems;
    return wishlistItems.filter((i) => i.name.toLowerCase().includes(wishlistSearch.toLowerCase()));
  }, [wishlistItems, wishlistSearch]);

  // ─── Color accent based on type ──────────────────────────────────────────
  const typeAccent = transactionType === 'income' ? '#22C55E' : '#8B7CFF';

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <View style={styles.screen}>
        {isDemoMode && (
          <View style={[styles.demoBanner, { paddingTop: insets.top }]}>
            <Text style={styles.demoBannerText}>
              ⚠️ DEMO MODE: Database tables not found. Run SQL script to enable sync.
            </Text>
          </View>
        )}

        {/* 1. Header row */}
        <View style={[styles.header, { paddingTop: isDemoMode ? 8 : insets.top + 8 }]}>
          <Pressable style={styles.closeBtn} onPress={() => router.back()}>
            <Text style={styles.closeBtnText}>✕</Text>
          </Pressable>

          {/* Segmented Expense / Income toggle */}
          <View style={styles.toggleContainer}>
            <Pressable
              style={[styles.togglePill, transactionType === 'expense' && [styles.togglePillActive, { backgroundColor: typeAccent }]]}
              onPress={() => handleToggleType('expense')}
            >
              <Text style={[styles.togglePillText, transactionType === 'expense' && styles.togglePillTextActive]}>
                EXPENSE
              </Text>
            </Pressable>
            <Pressable
              style={[styles.togglePill, transactionType === 'income' && [styles.togglePillActive, { backgroundColor: typeAccent }]]}
              onPress={() => handleToggleType('income')}
            >
              <Text style={[styles.togglePillText, transactionType === 'income' && styles.togglePillTextActive]}>
                INCOME
              </Text>
            </Pressable>
          </View>

          <View style={{ width: 40 }} />
        </View>

        {/* 2. Amount display */}
        <View style={styles.amountContainer}>
          <Text style={[styles.currencySymbol, { color: transactionType === 'income' ? '#22C55E33' : DL.border }]}>₹</Text>
          <Text style={[styles.amountText, { color: transactionType === 'income' ? '#22C55E' : '#E7E9EE' }]} numberOfLines={1}>
            {amountStr}
          </Text>
        </View>

        {/* 3. Note input */}
        <View style={styles.noteContainer}>
          <TextInput
            style={styles.noteInput}
            placeholder={transactionType === 'income' ? 'What did you earn?' : 'What did you buy?'}
            placeholderTextColor={DL.muted}
            value={note}
            onChangeText={setNote}
            editable={!submitting}
          />
        </View>

        {/* 4. Chip row */}
        <View style={styles.chipRow}>
          {/* Date Chip */}
          <Pressable style={styles.chip} onPress={() => setDateModalVisible(true)}>
            <Text style={styles.chipText}>📅 {dateChipLabel}</Text>
          </Pressable>

          {/* Category Chip */}
          <Pressable
            style={[styles.chip, !selectedCategoryId ? styles.chipUnselected : styles.chipSelected]}
            onPress={() => setCategoryModalVisible(true)}
          >
            <Text style={[styles.chipText, !selectedCategoryId && { color: DL.muted }]}>
              🏷️ {selectedCategory ? selectedCategory.name : 'Category'}
            </Text>
          </Pressable>

          {/* Link item Chip — hidden for income */}
          {transactionType === 'expense' && (
            <View style={styles.linkChipContainer}>
              <Pressable
                style={[styles.chip, !linkedItemId ? styles.chipUnselected : styles.chipSelected]}
                onPress={() => setWishlistModalVisible(true)}
              >
                <Text style={[styles.chipText, !linkedItemId && { color: DL.muted }]} numberOfLines={1}>
                  🔗 {linkedItem ? linkedItem.name : '+ Link item'}
                </Text>
              </Pressable>
              {linkedItemId && (
                <Pressable style={styles.unlinkBtn} onPress={() => setLinkedItemId(null)} hitSlop={8}>
                  <Text style={styles.unlinkBtnText}>✕</Text>
                </Pressable>
              )}
            </View>
          )}
        </View>

        {/* Error */}
        {error && <Text style={styles.errorText}>{error}</Text>}

        <View style={{ flex: 1 }} />

        {/* 5. Numeric keypad */}
        <View style={styles.keypadContainer}>
          {[
            ['1', '2', '3'],
            ['4', '5', '6'],
            ['7', '8', '9'],
            ['.', '0', '⌫'],
          ].map((row, rIdx) => (
            <View key={rIdx} style={styles.keypadRow}>
              {row.map((char) => (
                <Pressable
                  key={char}
                  style={({ pressed }) => [styles.keypadKey, pressed && { opacity: 0.5 }]}
                  onPress={() => handleKeyPress(char)}
                >
                  <Text style={styles.keypadKeyText}>{char}</Text>
                </Pressable>
              ))}
            </View>
          ))}
        </View>

        {/* 6. Save button */}
        <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <Pressable
            style={({ pressed }) => [
              styles.saveBtn,
              isValid && { backgroundColor: typeAccent },
              !isValid && styles.saveBtnDisabled,
              isValid && pressed && { opacity: 0.9 },
            ]}
            onPress={handleSubmit}
            disabled={!isValid || submitting}
          >
            {submitting ? (
              <ActivityIndicator color="#0B0D10" size="small" />
            ) : (
              <Text style={styles.saveBtnText}>
                {isEditMode ? 'UPDATE TRANSACTION →' : `SAVE ${transactionType.toUpperCase()} →`}
              </Text>
            )}
          </Pressable>
        </View>

        {/* ─── MODALS ───────────────────────────────────────────────── */}

        {/* Category Picker Modal */}
        <Modal
          visible={categoryModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setCategoryModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalHeader}>
                SELECT {transactionType === 'income' ? 'INCOME' : 'EXPENSE'} CATEGORY
              </Text>
              {loadingCats ? (
                <ActivityIndicator color={DL.muted} size="small" />
              ) : (
                <ScrollView contentContainerStyle={styles.modalGrid}>
                  {activeCategories.map((cat) => {
                    const isSelected = selectedCategoryId === cat.id;
                    return (
                      <Pressable
                        key={cat.id}
                        style={[
                          styles.modalGridItem,
                          isSelected && { borderColor: cat.color, backgroundColor: 'rgba(255,255,255,0.03)' },
                        ]}
                        onPress={() => {
                          setSelectedCategoryId(cat.id);
                          setCategoryModalVisible(false);
                        }}
                      >
                        <View style={[styles.categoryColorDot, { backgroundColor: cat.color }]} />
                        <Text style={styles.modalGridItemText}>{cat.name}</Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              )}
              <Pressable style={styles.modalCloseBtn} onPress={() => setCategoryModalVisible(false)}>
                <Text style={styles.modalCloseBtnText}>CLOSE</Text>
              </Pressable>
            </View>
          </View>
        </Modal>

        {/* Wishlist Link Picker Modal */}
        <Modal
          visible={wishlistModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setWishlistModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalHeader}>LINK WISHLIST ITEM</Text>
              <TextInput
                style={styles.modalSearchInput}
                placeholder="Search items by name..."
                placeholderTextColor={DL.muted}
                value={wishlistSearch}
                onChangeText={setWishlistSearch}
              />
              <ScrollView style={styles.wishlistItemsList}>
                {filteredWishlistItems.length === 0 ? (
                  <Text style={styles.emptySearchText}>No items found</Text>
                ) : (
                  filteredWishlistItems.map((item) => {
                    const isLinked = linkedItemId === item.id;
                    return (
                      <Pressable
                        key={item.id}
                        style={[
                          styles.wishlistItemRow,
                          isLinked && { borderColor: DL.soon, backgroundColor: 'rgba(255,255,255,0.02)' },
                        ]}
                        onPress={() => {
                          setLinkedItemId(item.id);
                          setWishlistModalVisible(false);
                          setWishlistSearch('');
                        }}
                      >
                        <Text style={styles.wishlistItemRowText}>{item.name}</Text>
                        <Text style={styles.wishlistItemCategory}>{item.category.toUpperCase()}</Text>
                      </Pressable>
                    );
                  })
                )}
              </ScrollView>
              <Pressable
                style={styles.modalCloseBtn}
                onPress={() => { setWishlistModalVisible(false); setWishlistSearch(''); }}
              >
                <Text style={styles.modalCloseBtnText}>CLOSE</Text>
              </Pressable>
            </View>
          </View>
        </Modal>

        {/* Calendar Date Picker Modal */}
        <Modal
          visible={dateModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setDateModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.calendarMonthSelector}>
                <Pressable onPress={handlePrevMonth} style={styles.calendarMonthArrow}>
                  <Text style={styles.calendarMonthArrowText}>←</Text>
                </Pressable>
                <Text style={styles.calendarMonthLabel}>{monthName} {calendarYear}</Text>
                <Pressable onPress={handleNextMonth} style={styles.calendarMonthArrow}>
                  <Text style={styles.calendarMonthArrowText}>→</Text>
                </Pressable>
              </View>
              <View style={styles.calendarWeekHeader}>
                {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, idx) => (
                  <Text key={idx} style={styles.calendarWeekText}>{day}</Text>
                ))}
              </View>
              <View style={styles.calendarGrid}>
                {daysInMonthList.map((item, idx) => {
                  const isSelected = item.dateStr === occurredAt;
                  return (
                    <Pressable
                      key={idx}
                      style={[
                        styles.calendarCell,
                        isSelected && styles.calendarCellSelected,
                        item.dayNum === null && { opacity: 0 },
                      ]}
                      disabled={item.dayNum === null}
                      onPress={() => {
                        if (item.dateStr) {
                          setOccurredAt(item.dateStr);
                          setDateModalVisible(false);
                        }
                      }}
                    >
                      <Text style={[styles.calendarCellText, isSelected && styles.calendarCellTextSelected]}>
                        {item.dayNum}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              <Pressable style={styles.modalCloseBtn} onPress={() => setDateModalVisible(false)}>
                <Text style={styles.modalCloseBtnText}>CLOSE</Text>
              </Pressable>
            </View>
          </View>
        </Modal>
      </View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: DL.bg,
    flexDirection: 'column',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 15,
  },
  closeBtn: {
    padding: 8,
    width: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeBtnText: {
    color: DL.muted,
    fontSize: 20,
    fontWeight: 'bold',
  },
  toggleContainer: {
    flexDirection: 'row',
    backgroundColor: '#121519',
    borderColor: '#1C2026',
    borderWidth: 1,
    borderRadius: 20,
    padding: 3,
  },
  togglePill: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 18,
    backgroundColor: 'transparent',
  },
  togglePillActive: {
    backgroundColor: '#8B7CFF',
  },
  togglePillText: {
    fontFamily: DLFonts.mono,
    fontSize: 9,
    fontWeight: 'bold',
    color: DL.muted,
    letterSpacing: 1,
  },
  togglePillTextActive: {
    color: '#0B0D10',
  },
  amountContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 10,
    paddingHorizontal: 30,
  },
  currencySymbol: {
    fontSize: 48,
    fontWeight: '700',
    color: DL.border,
    fontFamily: DLFonts.mono,
    marginRight: 6,
  },
  amountText: {
    fontSize: 52,
    fontWeight: 'bold',
    color: '#E7E9EE',
    fontFamily: DLFonts.mono,
    letterSpacing: -1,
  },
  noteContainer: {
    paddingHorizontal: 20,
    marginBottom: 15,
  },
  noteInput: {
    backgroundColor: '#121519',
    borderColor: '#1C2026',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontFamily: DLFonts.sans,
    fontSize: 14,
    color: DL.text,
  },
  chipRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingHorizontal: 16,
    gap: 8,
    marginBottom: 15,
    flexWrap: 'wrap',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#121519',
    borderColor: '#1C2026',
    borderWidth: 1.2,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  chipSelected: {
    borderStyle: 'solid',
  },
  chipUnselected: {
    borderStyle: 'dashed',
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  chipText: {
    fontFamily: DLFonts.sans,
    fontSize: 12,
    color: DL.text,
  },
  linkChipContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    maxWidth: 160,
  },
  unlinkBtn: {
    marginLeft: 4,
    padding: 4,
  },
  unlinkBtnText: {
    color: DL.muted,
    fontSize: 12,
    fontWeight: 'bold',
  },
  errorText: {
    fontFamily: DLFonts.sans,
    fontSize: 12,
    color: '#EF4444',
    textAlign: 'center',
    marginBottom: 8,
    paddingHorizontal: 20,
  },
  keypadContainer: {
    paddingHorizontal: 20,
    paddingBottom: 8,
    gap: 4,
  },
  keypadRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 4,
  },
  keypadKey: {
    flex: 1,
    backgroundColor: '#121519',
    borderColor: '#1C2026',
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keypadKeyText: {
    fontFamily: DLFonts.mono,
    fontSize: 20,
    color: DL.text,
    fontWeight: '600',
  },
  bottomBar: {
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  saveBtn: {
    backgroundColor: '#8B7CFF',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnDisabled: {
    backgroundColor: '#1C2026',
  },
  saveBtnText: {
    fontFamily: DLFonts.mono,
    fontSize: 12,
    fontWeight: 'bold',
    color: '#0B0D10',
    letterSpacing: 1.5,
  },
  // ─── Modals ──────────────────────────────────────────────────────────────
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'flex-end',
    padding: 16,
  },
  modalContent: {
    backgroundColor: '#13161C',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#1C202A',
    padding: 20,
    maxHeight: '75%',
  },
  modalHeader: {
    fontFamily: DLFonts.mono,
    fontSize: 10,
    color: DL.muted,
    letterSpacing: 2,
    marginBottom: 16,
    textAlign: 'center',
  },
  modalGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingBottom: 12,
  },
  modalGridItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0B0D10',
    borderColor: '#1C202A',
    borderWidth: 1.2,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  categoryColorDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  modalGridItemText: {
    fontFamily: DLFonts.sans,
    fontSize: 13,
    color: DL.text,
    fontWeight: '500',
  },
  modalCloseBtn: {
    backgroundColor: '#1C2026',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  modalCloseBtnText: {
    fontFamily: DLFonts.mono,
    fontSize: 11,
    color: DL.muted,
    letterSpacing: 1.5,
    fontWeight: 'bold',
  },
  modalSearchInput: {
    backgroundColor: '#0B0D10',
    borderColor: '#1C202A',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontFamily: DLFonts.sans,
    fontSize: 13,
    color: DL.text,
    marginBottom: 12,
  },
  wishlistItemsList: {
    maxHeight: 300,
  },
  wishlistItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderColor: '#1C202A',
  },
  wishlistItemRowText: {
    fontFamily: DLFonts.sans,
    fontSize: 14,
    color: DL.text,
    flex: 1,
  },
  wishlistItemCategory: {
    fontFamily: DLFonts.mono,
    fontSize: 9,
    color: DL.muted,
    letterSpacing: 1,
  },
  emptySearchText: {
    fontFamily: DLFonts.sans,
    fontSize: 13,
    color: DL.muted,
    textAlign: 'center',
    paddingVertical: 20,
  },
  calendarMonthSelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  calendarMonthArrow: {
    padding: 8,
  },
  calendarMonthArrowText: {
    color: DL.text,
    fontSize: 18,
    fontFamily: DLFonts.mono,
  },
  calendarMonthLabel: {
    fontFamily: DLFonts.mono,
    fontSize: 13,
    fontWeight: 'bold',
    color: DL.text,
    letterSpacing: 1,
  },
  calendarWeekHeader: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 8,
  },
  calendarWeekText: {
    fontFamily: DLFonts.mono,
    fontSize: 10,
    color: DL.muted,
    width: 32,
    textAlign: 'center',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 12,
  },
  calendarCell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
  },
  calendarCellSelected: {
    backgroundColor: '#8B7CFF',
  },
  calendarCellText: {
    fontFamily: DLFonts.mono,
    fontSize: 13,
    color: DL.text,
  },
  calendarCellTextSelected: {
    color: '#0B0D10',
    fontWeight: 'bold',
  },
  demoBanner: {
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderBottomWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  demoBannerText: {
    fontSize: 9,
    color: '#F59E0B',
    fontFamily: DLFonts.sans,
    fontWeight: 'bold',
    textAlign: 'center',
  },
});
