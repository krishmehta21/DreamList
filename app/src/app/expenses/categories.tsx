import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  ActivityIndicator,
  ScrollView,
  Alert,
  Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DL, DLFonts } from '@/constants/design';
import { fetchCategories, createCategory, deleteCategory, reassignTransactions, ExpenseCategory } from '@/lib/expensesApi';

export const ICON_MAP: Record<string, string> = {
  Utensils: '🍔',
  Car: '🚗',
  ShoppingBag: '🛍️',
  CreditCard: '💳',
  Tv: '📺',
  Heart: '❤️',
  Coins: '🪙',
  Book: '📚',
  Briefcase: '💼',
  Wrench: '🔧',
  Gamepad: '🎮',
};

const COLOR_OPTIONS = [
  '#F59E0B', // Amber
  '#3B82F6', // Blue
  '#EC4899', // Pink
  '#EF4444', // Red
  '#8B5CF6', // Purple
  '#10B981', // Emerald
  '#6B7280', // Gray
  '#06B6D4', // Cyan
  '#84CC16', // Lime
];

const ICON_OPTIONS = [
  { name: 'Utensils', char: '🍔' },
  { name: 'Car', char: '🚗' },
  { name: 'ShoppingBag', char: '🛍️' },
  { name: 'CreditCard', char: '💳' },
  { name: 'Tv', char: '📺' },
  { name: 'Heart', char: '❤️' },
  { name: 'Coins', char: '🪙' },
  { name: 'Book', char: '📚' },
  { name: 'Briefcase', char: '💼' },
  { name: 'Wrench', char: '🔧' },
  { name: 'Gamepad', char: '🎮' },
];

const MOCK_CATEGORIES: ExpenseCategory[] = [
  { id: 'cat-1', name: 'Food', icon: 'Utensils', color: '#F59E0B', is_default: true, user_id: null, created_at: '' },
  { id: 'cat-2', name: 'Transport', icon: 'Car', color: '#3B82F6', is_default: true, user_id: null, created_at: '' },
  { id: 'cat-3', name: 'Shopping', icon: 'ShoppingBag', color: '#EC4899', is_default: true, user_id: null, created_at: '' },
  { id: 'cat-4', name: 'Bills', icon: 'CreditCard', color: '#EF4444', is_default: true, user_id: null, created_at: '' },
  { id: 'cat-5', name: 'Entertainment', icon: 'Tv', color: '#8B5CF6', is_default: true, user_id: null, created_at: '' },
  { id: 'cat-6', name: 'Health', icon: 'Heart', color: '#10B981', is_default: true, user_id: null, created_at: '' },
  { id: 'cat-7', name: 'Other', icon: 'Coins', color: '#6B7280', is_default: true, user_id: null, created_at: '' },
];

export default function CategoriesScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDemoMode, setIsDemoMode] = useState(false);

  // Add category form states
  const [name, setName] = useState('');
  const [selectedColor, setSelectedColor] = useState(COLOR_OPTIONS[0]);
  const [selectedIconName, setSelectedIconName] = useState(ICON_OPTIONS[0].name);

  // Reassign block states
  const [reassignModalVisible, setReassignModalVisible] = useState(false);
  const [categoryToDelete, setCategoryToDelete] = useState<ExpenseCategory | null>(null);
  const [targetCategoryId, setTargetCategoryId] = useState<string | null>(null);
  const [reassigning, setReassigning] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const cats = await fetchCategories();
      setCategories(cats);
      setIsDemoMode(false);
    } catch (err: any) {
      console.warn('Failed to load categories from database, switching to demo mode:', err);
      setCategories(MOCK_CATEGORIES);
      setIsDemoMode(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCreate = async () => {
    setError(null);
    if (!name.trim()) {
      setError('Please enter a category name.');
      return;
    }

    setSubmitting(true);
    try {
      if (isDemoMode) {
        // Local simulation
        const newCat: ExpenseCategory = {
          id: `cat-custom-${Date.now()}`,
          name: name.trim(),
          icon: selectedIconName,
          color: selectedColor,
          is_default: false,
          user_id: 'user',
          created_at: new Date().toISOString(),
        };
        setCategories((prev) => [...prev, newCat]);
        setName('');
        setSelectedColor(COLOR_OPTIONS[0]);
        setSelectedIconName(ICON_OPTIONS[0].name);
      } else {
        await createCategory(name.trim(), selectedIconName, selectedColor);
        setName('');
        setSelectedColor(COLOR_OPTIONS[0]);
        setSelectedIconName(ICON_OPTIONS[0].name);
        loadData();
      }
    } catch (err: any) {
      setError(err.message || 'Failed to create category.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeletePress = async (cat: ExpenseCategory) => {
    try {
      if (isDemoMode) {
        // Check if it has mock transactions or just delete locally
        // For simplicity, we just delete it from local state
        setCategories((prev) => prev.filter((c) => c.id !== cat.id));
      } else {
        await deleteCategory(cat.id);
        loadData();
      }
    } catch (err: any) {
      // If deleted is blocked due to active transactions
      if (err.message?.includes('linked transactions') || err.message?.includes('foreign key constraint')) {
        // Show reassign dialog
        setCategoryToDelete(cat);
        // Find alternative category (excluding the one being deleted)
        const alternatives = categories.filter((c) => c.id !== cat.id);
        if (alternatives.length > 0) {
          setTargetCategoryId(alternatives[0].id);
        }
        setReassignModalVisible(true);
      } else {
        Alert.alert('Error', err.message || 'Failed to delete category.');
      }
    }
  };

  const handleReassignAndDelete = async () => {
    if (!categoryToDelete || !targetCategoryId) return;

    setReassigning(true);
    try {
      if (isDemoMode) {
        setCategories((prev) => prev.filter((c) => c.id !== categoryToDelete.id));
        setReassignModalVisible(false);
        setCategoryToDelete(null);
      } else {
        // Reassign transactions
        await reassignTransactions(categoryToDelete.id, targetCategoryId);
        // Delete category
        await deleteCategory(categoryToDelete.id);
        
        setReassignModalVisible(false);
        setCategoryToDelete(null);
        setTargetCategoryId(null);
        loadData();
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to reassign and delete category.');
    } finally {
      setReassigning(false);
    }
  };

  return (
    <View style={styles.screen}>
      {isDemoMode && (
        <View style={[styles.demoBanner, { paddingTop: insets.top }]}>
          <Text style={styles.demoBannerText}>
            ⚠️ DEMO MODE: Database tables not found. Run SQL script to enable sync.
          </Text>
        </View>
      )}
      {/* Header */}
      <View style={[styles.header, { paddingTop: isDemoMode ? 8 : insets.top + 8 }]}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>← Back</Text>
        </Pressable>
        <Text style={styles.title}>Categories</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 20 }]}>
        {/* Categories List */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>EXISTING CATEGORIES</Text>
          {loading ? (
            <ActivityIndicator color={DL.muted} size="small" style={{ marginVertical: 20 }} />
          ) : (
            <View style={styles.categoriesList}>
              {categories.map((cat) => (
                <View key={cat.id} style={styles.categoryRow}>
                  <View style={styles.categoryInfo}>
                    <View style={[styles.iconBox, { backgroundColor: cat.color }]}>
                      <Text style={styles.iconChar}>
                        {ICON_MAP[cat.icon] || '🪙'}
                      </Text>
                    </View>
                    <Text style={styles.categoryName}>{cat.name}</Text>
                    {cat.is_default && (
                      <View style={styles.defaultBadge}>
                        <Text style={styles.defaultBadgeText}>DEFAULT</Text>
                      </View>
                    )}
                  </View>
                  {!cat.is_default && (
                    <Pressable
                      style={({ pressed }) => [
                        styles.deleteBtn,
                        pressed && { opacity: 0.7 }
                      ]}
                      onPress={() => handleDeletePress(cat)}
                    >
                      <Text style={styles.deleteBtnText}>Delete</Text>
                    </Pressable>
                  )}
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Add Category Form */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>NEW CUSTOM CATEGORY</Text>
          <View style={styles.formCard}>
            <TextInput
              style={styles.textInput}
              placeholder="Category Name"
              placeholderTextColor={DL.muted}
              value={name}
              onChangeText={setName}
              editable={!submitting}
            />

            {/* Color selection */}
            <Text style={styles.subLabel}>SELECT COLOR</Text>
            <View style={styles.colorRow}>
              {COLOR_OPTIONS.map((col) => {
                const isSelected = selectedColor === col;
                return (
                  <Pressable
                    key={col}
                    style={[
                      styles.colorCircle,
                      { backgroundColor: col },
                      isSelected && styles.colorCircleSelected
                    ]}
                    onPress={() => setSelectedColor(col)}
                  />
                );
              })}
            </View>

            {/* Icon selection */}
            <Text style={styles.subLabel}>SELECT ICON</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.iconRow}>
              {ICON_OPTIONS.map((opt) => {
                const isSelected = selectedIconName === opt.name;
                return (
                  <Pressable
                    key={opt.name}
                    style={[
                      styles.iconCircle,
                      isSelected && styles.iconCircleSelected
                    ]}
                    onPress={() => setSelectedIconName(opt.name)}
                  >
                    <Text style={styles.iconCircleChar}>{opt.char}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            {error && <Text style={styles.errorText}>{error}</Text>}

            <Pressable
              style={({ pressed }) => [
                styles.addBtn,
                pressed && { opacity: 0.9 }
              ]}
              onPress={handleCreate}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator color="#000000" size="small" />
              ) : (
                <Text style={styles.addBtnText}>ADD CATEGORY</Text>
              )}
            </Pressable>
          </View>
        </View>
      </ScrollView>

      {/* Deletion safe check reassign modal */}
      {categoryToDelete && (
        <Modal
          visible={reassignModalVisible}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setReassignModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalBox}>
              <Text style={styles.modalTitle}>CATEGORY IN USE</Text>
              <Text style={styles.modalMessage}>
                The category &ldquo;{categoryToDelete.name}&rdquo; is referenced by active transactions. Reassign these transactions to another category before deleting:
              </Text>

              {/* Target Category Selector */}
              <View style={styles.reassignSelector}>
                {categories
                  .filter((c) => c.id !== categoryToDelete.id)
                  .map((c) => {
                    const isSelected = targetCategoryId === c.id;
                    return (
                      <Pressable
                        key={c.id}
                        style={[
                          styles.reassignOption,
                          isSelected && styles.reassignOptionSelected
                        ]}
                        onPress={() => setTargetCategoryId(c.id)}
                      >
                        <View style={[styles.categoryColorDot, { backgroundColor: c.color }]} />
                        <Text style={styles.reassignOptionName}>{c.name}</Text>
                      </Pressable>
                    );
                  })}
              </View>

              <View style={styles.modalActions}>
                <Pressable
                  style={styles.cancelBtn}
                  onPress={() => {
                    setReassignModalVisible(false);
                    setCategoryToDelete(null);
                  }}
                  disabled={reassigning}
                >
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </Pressable>
                <Pressable
                  style={styles.confirmReassignBtn}
                  onPress={handleReassignAndDelete}
                  disabled={reassigning}
                >
                  {reassigning ? (
                    <ActivityIndicator color="#000000" size="small" />
                  ) : (
                    <Text style={styles.confirmReassignBtnText}>REASSIGN & DELETE</Text>
                  )}
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: DL.bg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#161822',
  },
  backBtn: {
    paddingVertical: 6,
    width: 60,
  },
  backBtnText: {
    color: DL.muted,
    fontFamily: DLFonts.sans,
    fontSize: 14,
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    color: DL.text,
    fontFamily: DLFonts.sans,
  },
  scrollContent: {
    padding: 20,
    gap: 24,
  },
  section: {
    flexDirection: 'column',
    gap: 12,
  },
  sectionHeader: {
    fontFamily: DLFonts.mono,
    fontSize: 10,
    color: DL.muted,
    letterSpacing: 1.5,
  },
  categoriesList: {
    backgroundColor: DL.card,
    borderColor: DL.border,
    borderWidth: 1.2,
    borderRadius: 20,
    overflow: 'hidden',
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#161822',
  },
  categoryInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconBox: {
    width: 32,
    height: 32,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconChar: {
    fontSize: 15,
    color: '#000000',
    fontWeight: 'bold',
  },
  categoryName: {
    fontFamily: DLFonts.sans,
    fontSize: 14,
    fontWeight: '600',
    color: DL.text,
  },
  defaultBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  defaultBadgeText: {
    fontFamily: DLFonts.mono,
    fontSize: 7,
    color: DL.muted,
    fontWeight: 'bold',
  },
  deleteBtn: {
    backgroundColor: 'rgba(255, 51, 51, 0.1)',
    borderColor: 'rgba(255, 51, 51, 0.3)',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  deleteBtnText: {
    fontFamily: DLFonts.mono,
    fontSize: 10,
    color: '#FF3333',
    fontWeight: 'bold',
  },
  formCard: {
    backgroundColor: DL.card,
    borderColor: DL.border,
    borderWidth: 1.2,
    borderRadius: 20,
    padding: 16,
    gap: 16,
  },
  textInput: {
    fontFamily: DLFonts.sans,
    fontSize: 14,
    color: DL.text,
    borderBottomWidth: 1,
    borderBottomColor: '#161822',
    paddingVertical: 8,
  },
  subLabel: {
    fontFamily: DLFonts.mono,
    fontSize: 8,
    color: DL.muted,
    letterSpacing: 1,
    marginTop: 4,
  },
  colorRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  colorCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  colorCircleSelected: {
    borderWidth: 2,
    borderColor: DL.text,
  },
  iconRow: {
    gap: 8,
    paddingVertical: 2,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderColor: DL.border,
    borderWidth: 1.2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconCircleSelected: {
    borderColor: DL.soon,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  iconCircleChar: {
    fontSize: 18,
  },
  errorText: {
    fontFamily: DLFonts.sans,
    color: '#FF3333',
    fontSize: 13,
    textAlign: 'center',
  },
  addBtn: {
    backgroundColor: DL.text,
    borderRadius: 12,
    paddingVertical: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  addBtnText: {
    fontFamily: DLFonts.mono,
    fontSize: 12,
    fontWeight: 'bold',
    color: '#000000',
    letterSpacing: 1.5,
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalBox: {
    width: 310,
    backgroundColor: '#161822',
    borderColor: '#242830',
    borderWidth: 1.2,
    borderRadius: 20,
    padding: 20,
  },
  modalTitle: {
    fontFamily: DLFonts.mono,
    fontSize: 13,
    fontWeight: 'bold',
    color: '#FF3333',
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  modalMessage: {
    fontFamily: DLFonts.sans,
    fontSize: 13,
    color: DL.muted,
    lineHeight: 18,
    marginBottom: 16,
  },
  reassignSelector: {
    flexDirection: 'column',
    gap: 8,
    maxHeight: 150,
    marginBottom: 20,
  },
  reassignOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderColor: DL.border,
    borderWidth: 1.2,
    borderRadius: 10,
    gap: 8,
  },
  reassignOptionSelected: {
    borderColor: DL.soon,
  },
  categoryColorDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  reassignOptionName: {
    fontFamily: DLFonts.sans,
    fontSize: 13,
    color: DL.text,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  cancelBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2A2F38',
  },
  cancelBtnText: {
    fontFamily: DLFonts.mono,
    fontSize: 11,
    fontWeight: 'bold',
    color: DL.muted,
  },
  confirmReassignBtn: {
    backgroundColor: DL.text,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  confirmReassignBtnText: {
    fontFamily: DLFonts.mono,
    fontSize: 11,
    fontWeight: 'bold',
    color: '#000000',
  },
  demoBanner: {
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderBottomWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  demoBannerText: {
    fontSize: 9,
    color: '#F59E0B',
    fontFamily: DLFonts.sans,
    fontWeight: 'bold',
    textAlign: 'center',
  },
});
