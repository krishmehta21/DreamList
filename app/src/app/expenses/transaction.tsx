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
  Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DL, DLFonts } from '@/constants/design';
import { fetchCategories, createTransaction, updateTransaction, ExpenseCategory } from '@/lib/expensesApi';
import { getCachedItems } from '@/lib/database';
import type { WishlistItem } from '@/lib/types';
import { useBudget } from '@/context/BudgetContext';
import { supabase } from '@/lib/supabase';
import { getSubcategoriesForCategory, parseTransactionNote, formatTransactionNote } from '@/lib/subcategories';

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

  const { budgetMonth, refreshData } = useBudget();

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
  const [selectedSubcategory, setSelectedSubcategory] = useState<string | null>(null);
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

  // Vault Transfer States
  const [isVaultTransfer, setIsVaultTransfer] = useState(false);
  const [vaultDirection, setVaultDirection] = useState<'to_vault' | 'from_vault'>('to_vault');

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

  const availableSubcategories = useMemo(() => {
    return getSubcategoriesForCategory(selectedCategory?.name);
  }, [selectedCategory]);

  const linkedItem = useMemo(() => {
    return wishlistItems.find((i) => i.id === linkedItemId);
  }, [wishlistItems, linkedItemId]);

  const hourWageText = useMemo(() => {
    if (transactionType !== 'expense' || !selectedCategoryId || !budgetMonth) return null;
    const cat = activeCategories.find((c) => c.id === selectedCategoryId);
    if (!cat) return null;
    
    const nameLower = cat.name.toLowerCase();
    if (!['food', 'drinks', 'shopping'].includes(nameLower)) return null;
    
    const amountVal = parseFloat(amountStr);
    if (isNaN(amountVal) || amountVal <= 0) return null;
    
    const salary = Number(budgetMonth.salary_received) || 60000;
    const hourlyWage = salary / 160; // 160 hours standard work month
    const hours = (amountVal / hourlyWage).toFixed(1);
    
    return `⏳ REQUIRES ${hours} HOURS OF WORK`;
  }, [amountStr, transactionType, selectedCategoryId, activeCategories, budgetMonth]);

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
        if (params.note) {
          const parsed = parseTransactionNote(String(params.note));
          setSelectedSubcategory(parsed.subcategory);
          setNote(parsed.detail || '');
        }
        if (params.occurred_at) {
          setOccurredAt(String(params.occurred_at));
          const parts = String(params.occurred_at).split('-');
          if (parts.length === 3) {
            setCalendarYear(Number(parts[0]));
            setCalendarMonth(Number(parts[1]));
          }
        }
        // Restore type toggle
        const allCats = [...expCats, ...incCats];
        const currentCat = allCats.find(c => c.id === params.category_id);
        if (currentCat && currentCat.name.toLowerCase() === 'savings') {
          setIsVaultTransfer(true);
          setVaultDirection(params.type === 'income' ? 'from_vault' : 'to_vault');
        } else {
          if (params.type === 'income') {
            setTransactionType('income');
            if (params.category_id) setSelectedCategoryId(String(params.category_id));
          } else {
            setTransactionType('expense');
            if (params.category_id) setSelectedCategoryId(String(params.category_id));
          }
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
    setIsVaultTransfer(false);
    setTransactionType(newType);
    setSelectedCategoryId(null);
    // Also clear linked item when switching to income
    if (newType === 'income') setLinkedItemId(null);
  };

  const handleToggleVaultTransfer = () => {
    setIsVaultTransfer(true);
    setSelectedCategoryId(null);
    setLinkedItemId(null);
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
    if (!selectedCategoryId && !isVaultTransfer) {
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

      let categoryId = selectedCategoryId;
      let finalType = transactionType;
      let finalNote = formatTransactionNote(selectedSubcategory, note);

      if (isVaultTransfer) {
        // Ensure "Savings" category exists
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error('Not authenticated');

        // Look up Savings category
        let { data: savingsCat } = await supabase
          .from('expense_categories')
          .select('*')
          .eq('name', 'Savings')
          .maybeSingle();

        if (!savingsCat) {
          // Create it dynamically if not found
          const { data: newCat, error: insertCatErr } = await supabase
            .from('expense_categories')
            .insert({
              name: 'Savings',
              icon: 'Shield',
              color: '#10B981',
              is_default: true,
              type: 'expense',
              user_id: session.user.id
            })
            .select()
            .single();

          if (insertCatErr || !newCat) {
            throw new Error('Failed to create Savings category: ' + (insertCatErr?.message || 'Unknown error'));
          }
          savingsCat = newCat;
        }

        categoryId = savingsCat.id;
        finalType = vaultDirection === 'to_vault' ? 'expense' : 'income';
        finalNote = note.trim() || (vaultDirection === 'to_vault' ? 'Transfer to Vault' : 'Transfer from Vault');
      }

      if (isEditMode && params.id) {
        await updateTransaction(String(params.id), {
          amount: amountVal,
          category_id: categoryId!,
          note: finalNote,
          occurred_at: occurredAt,
          linked_item_id: finalType === 'income' ? null : linkedItemId,
          type: finalType,
        });
        await refreshData();
        router.back();
      } else {
        await createTransaction({
          amount: amountVal,
          category_id: categoryId!,
          note: finalNote,
          occurred_at: occurredAt,
          source: linkedItemId ? 'wishlist_link' : 'manual',
          linked_item_id: finalType === 'income' ? null : linkedItemId,
          type: finalType,
        });
        await refreshData();
        router.back();
      }
    } catch (err: any) {
      setError(err.message || 'Failed to save transaction.');
      setSubmitting(false);
    }
  };

  const isValid = parseFloat(amountStr) > 0 && (selectedCategoryId !== null || isVaultTransfer);

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

          {/* Segmented Expense / Income / Vault toggle */}
          <View style={styles.toggleContainer}>
            <Pressable
              style={[styles.togglePill, (!isVaultTransfer && transactionType === 'expense') && [styles.togglePillActive, { backgroundColor: typeAccent }]]}
              onPress={() => handleToggleType('expense')}
            >
              <Text style={[styles.togglePillText, (!isVaultTransfer && transactionType === 'expense') && styles.togglePillTextActive]}>
                EXPENSE
              </Text>
            </Pressable>
            <Pressable
              style={[styles.togglePill, (!isVaultTransfer && transactionType === 'income') && [styles.togglePillActive, { backgroundColor: typeAccent }]]}
              onPress={() => handleToggleType('income')}
            >
              <Text style={[styles.togglePillText, (!isVaultTransfer && transactionType === 'income') && styles.togglePillTextActive]}>
                INCOME
              </Text>
            </Pressable>
            <Pressable
              style={[styles.togglePill, isVaultTransfer && [styles.togglePillActive, { backgroundColor: '#10B981' }]]}
              onPress={handleToggleVaultTransfer}
            >
              <Text style={[styles.togglePillText, isVaultTransfer && styles.togglePillTextActive]}>
                VAULT
              </Text>
            </Pressable>
          </View>

          <View style={{ width: 40 }} />
        </View>

        {/* Vault Direction Toggle Sub-row */}
        {isVaultTransfer && (
          <View style={styles.vaultDirectionWrapper}>
            <Pressable
              style={[styles.vaultDirectionPill, vaultDirection === 'to_vault' && styles.vaultDirectionPillActive]}
              onPress={() => setVaultDirection('to_vault')}
            >
              <Text style={[styles.vaultDirectionText, vaultDirection === 'to_vault' && styles.vaultDirectionTextActive]}>
                💵 TO VAULT
              </Text>
            </Pressable>
            <Pressable
              style={[styles.vaultDirectionPill, vaultDirection === 'from_vault' && styles.vaultDirectionPillActive]}
              onPress={() => setVaultDirection('from_vault')}
            >
              <Text style={[styles.vaultDirectionText, vaultDirection === 'from_vault' && styles.vaultDirectionTextActive]}>
                📥 FROM VAULT
              </Text>
            </Pressable>
          </View>
        )}

        {/* 2. Amount display */}
        <View style={styles.amountContainer}>
          <Text style={[styles.currencySymbol, { 
            color: isVaultTransfer ? 'rgba(16, 185, 129, 0.2)' : transactionType === 'income' ? '#22C55E33' : DL.border 
          }]}>₹</Text>
          <Text style={[styles.amountText, { 
            color: isVaultTransfer ? '#10B981' : transactionType === 'income' ? '#22C55E' : '#E7E9EE' 
          }]} numberOfLines={1}>
            {amountStr}
          </Text>
        </View>

        {hourWageText && !isVaultTransfer ? (
          <View style={styles.frictionRow}>
            <Text style={styles.frictionText}>{hourWageText}</Text>
          </View>
        ) : null}

        {/* 3. Note input */}
        <View style={styles.noteContainer}>
          <TextInput
            style={styles.noteInput}
            placeholder={isVaultTransfer ? 'Add notes for this transfer...' : transactionType === 'income' ? 'What did you earn?' : 'What did you buy?'}
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
          {!isVaultTransfer && (
            <Pressable
              style={[styles.chip, !selectedCategoryId ? styles.chipUnselected : styles.chipSelected]}
              onPress={() => setCategoryModalVisible(true)}
            >
              <Text style={[styles.chipText, !selectedCategoryId && { color: DL.muted }]}>
                🏷️ {selectedCategory ? selectedCategory.name : 'Category'}
              </Text>
            </Pressable>
          )}

          {/* Link item Chip — hidden for income and vault transfers */}
          {!isVaultTransfer && transactionType === 'expense' && (
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

        {/* Subcategories Row */}
        {!isVaultTransfer && selectedCategory && availableSubcategories.length > 0 && (
          <View style={styles.subcategoryContainer}>
            <Text style={styles.subcategoryLabel}>SUBCATEGORY (OPTIONAL)</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.subcategoryRow}
            >
              {availableSubcategories.map((sub) => {
                const isSelected = selectedSubcategory === sub;
                return (
                  <Pressable
                    key={sub}
                    style={[styles.subchip, isSelected && styles.subchipSelected]}
                    onPress={() => setSelectedSubcategory(isSelected ? null : sub)}
                  >
                    <Text
                      style={[
                        styles.subchipText,
                        isSelected && styles.subchipTextSelected,
                      ]}
                    >
                      {sub}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        )}

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
    backgroundColor: '#FFFFFF',
    borderColor: 'rgba(0, 0, 0, 0.06)',
    borderWidth: 1,
    borderRadius: 20,
    padding: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    elevation: 1,
  },
  togglePill: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 18,
    backgroundColor: 'transparent',
  },
  togglePillActive: {
    backgroundColor: '#0F172A',
  },
  togglePillText: {
    fontFamily: DLFonts.mono,
    fontSize: 9,
    fontWeight: 'bold',
    color: DL.muted,
    letterSpacing: 1,
  },
  togglePillTextActive: {
    color: '#FFFFFF',
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
    color: '#94A3B8',
    fontFamily: DLFonts.mono,
    marginRight: 6,
  },
  amountText: {
    fontSize: 52,
    fontWeight: 'bold',
    color: '#0F172A',
    fontFamily: DLFonts.mono,
    letterSpacing: -1,
  },
  noteContainer: {
    paddingHorizontal: 20,
    marginBottom: 15,
  },
  noteInput: {
    backgroundColor: '#FFFFFF',
    borderColor: 'rgba(0, 0, 0, 0.08)',
    borderWidth: 1,
    borderRadius: 14,
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
    backgroundColor: '#FFFFFF',
    borderColor: 'rgba(0, 0, 0, 0.08)',
    borderWidth: 1.2,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  chipSelected: {
    borderStyle: 'solid',
    borderColor: '#FF5E3A',
  },
  chipUnselected: {
    borderStyle: 'dashed',
    borderColor: 'rgba(0, 0, 0, 0.15)',
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
    backgroundColor: '#FFFFFF',
    borderColor: 'rgba(0, 0, 0, 0.05)',
    borderWidth: 1,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    elevation: 1,
  },
  keypadKeyText: {
    fontFamily: DLFonts.mono,
    fontSize: 22,
    color: DL.text,
    fontWeight: '700',
  },
  bottomBar: {
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  saveBtn: {
    backgroundColor: '#0F172A',
    borderRadius: 18,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
  saveBtnDisabled: {
    backgroundColor: '#E2E8F0',
  },
  saveBtnText: {
    fontFamily: DLFonts.mono,
    fontSize: 12,
    fontWeight: 'bold',
    color: '#FFFFFF',
    letterSpacing: 1.5,
  },
  // ─── Modals ──────────────────────────────────────────────────────────────
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    justifyContent: 'flex-end',
    padding: 16,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.08)',
    padding: 20,
    maxHeight: '75%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    elevation: 8,
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
    backgroundColor: '#F8FAFC',
    borderColor: 'rgba(0, 0, 0, 0.06)',
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
    backgroundColor: '#F1F5F9',
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
    backgroundColor: '#F8FAFC',
    borderColor: 'rgba(0, 0, 0, 0.08)',
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
  frictionRow: {
    alignSelf: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.08)',
    borderColor: 'rgba(245, 158, 11, 0.2)',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 4,
    marginTop: -8,
    marginBottom: 8,
  },
  frictionText: {
    color: '#F59E0B',
    fontFamily: DLFonts.mono,
    fontSize: 10,
    letterSpacing: 1,
    fontWeight: 'bold',
  },
  vaultDirectionWrapper: {
    flexDirection: 'row',
    alignSelf: 'center',
    backgroundColor: '#F1F5F9',
    borderColor: '#E2E8F0',
    borderWidth: 1,
    borderRadius: 20,
    padding: 3,
    marginTop: 10,
  },
  vaultDirectionPill: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 18,
    backgroundColor: 'transparent',
  },
  vaultDirectionPillActive: {
    backgroundColor: '#10B981',
  },
  vaultDirectionText: {
    fontFamily: DLFonts.mono,
    fontSize: 9,
    fontWeight: 'bold',
    color: '#64748B',
    letterSpacing: 1,
  },
  vaultDirectionTextActive: {
    color: '#FFFFFF',
  },
  subcategoryContainer: {
    marginTop: 8,
    paddingHorizontal: 20,
  },
  subcategoryLabel: {
    fontFamily: DLFonts.mono,
    fontSize: 9,
    letterSpacing: 1.5,
    color: DL.muted,
    marginBottom: 6,
  },
  subcategoryRow: {
    gap: 8,
    paddingRight: 10,
  },
  subchip: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  subchipSelected: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderColor: '#10B981',
  },
  subchipText: {
    fontFamily: DLFonts.mono,
    fontSize: 11,
    color: DL.muted,
  },
  subchipTextSelected: {
    color: '#10B981',
    fontWeight: '700',
  },
});
