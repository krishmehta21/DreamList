import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  StyleSheet,
  ActivityIndicator,
  Pressable,
  Platform,
  Alert,
  Dimensions,
  Animated,
  PanResponder,
  Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { getCachedItems, saveCachedItems, reconcileItems } from '@/lib/database';
import { DL, DLFonts, TIER_COLOR } from '@/constants/design';
import { fetchItems, updateItem, deleteItem } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import type { WishlistItem, Category, Tier } from '@/lib/types';
import { TIERS } from '@/lib/types';

// ─── Swipeable Row (slide-left reveals delete) ────────────────────────────────
interface SwipeableRowProps {
  item: WishlistItem;
  onPress: (item: WishlistItem) => void;
  onToggleDone: (id: string, done: boolean) => void;
  onDelete: (id: string) => void;
}

function SwipeableRow({ item, onPress, onToggleDone, onDelete }: SwipeableRowProps) {
  const DELETE_THRESHOLD = -72;
  const translateX = useRef(new Animated.Value(0)).current;
  const rowOpacity = useRef(new Animated.Value(1)).current;
  const lowestPrice = item.prices && item.prices.length > 0
    ? Math.min(...item.prices.map((p) => p.price))
    : null;

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) =>
        Math.abs(g.dx) > 6 && Math.abs(g.dx) > Math.abs(g.dy),
      onPanResponderMove: (_, g) => {
        if (g.dx < 0) {
          translateX.setValue(Math.max(g.dx, DELETE_THRESHOLD - 10));
        }
      },
      onPanResponderRelease: (_, g) => {
        if (g.dx < DELETE_THRESHOLD) {
          Animated.spring(translateX, {
            toValue: DELETE_THRESHOLD,
            useNativeDriver: true,
            tension: 80,
            friction: 10,
          }).start();
        } else {
          Animated.spring(translateX, {
            toValue: 0,
            useNativeDriver: true,
            tension: 80,
            friction: 10,
          }).start();
        }
      },
    })
  ).current;

  const handleDelete = () => {
    Animated.parallel([
      Animated.timing(translateX, { toValue: -400, duration: 220, useNativeDriver: true }),
      Animated.timing(rowOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(() => onDelete(item.id));
  };

  const snapBack = () => {
    Animated.spring(translateX, {
      toValue: 0,
      useNativeDriver: true,
      tension: 80,
      friction: 10,
    }).start();
  };

  return (
    <Animated.View style={[styles.swipeRowContainer, { opacity: rowOpacity }]}>
      <View style={styles.deleteAction}>
        <Pressable style={styles.deleteBtn} onPress={handleDelete}>
          <Text style={styles.deleteBtnText}>Delete</Text>
        </Pressable>
      </View>

      <Animated.View
        style={[styles.swipeRowContent, { transform: [{ translateX }] }]}
        {...panResponder.panHandlers}
      >
        <Pressable
          style={styles.modalCheckboxHit}
          onPress={() => { onToggleDone(item.id, !item.done); snapBack(); }}
        >
          <View style={[styles.modalCheckbox, item.done && styles.modalCheckboxDone]}>
            {item.done && <View style={styles.modalCheckboxTick} />}
          </View>
        </Pressable>

        <Pressable
          style={styles.modalRowText}
          onPress={() => { snapBack(); setTimeout(() => onPress(item), 30); }}
        >
          <Text
            style={[styles.modalItemName, item.done && styles.modalItemNameDone]}
            numberOfLines={2}
          >
            {item.name}
          </Text>
          <View style={styles.modalItemMeta}>
            <View style={[styles.modalTierPill, { borderColor: TIER_COLOR[item.tier] }]}>
              <Text style={[styles.modalTierText, { color: TIER_COLOR[item.tier] }]}>
                {item.tier.toUpperCase()}
              </Text>
            </View>
            {lowestPrice != null && (
              <Text style={styles.modalPriceText}>₹{lowestPrice.toLocaleString('en-IN')}</Text>
            )}
          </View>
        </Pressable>

        <Text style={styles.modalChevron}>›</Text>
      </Animated.View>
    </Animated.View>
  );
}

// ─── Main Screen Component ────────────────────────────────────────────────────
export default function CategoryScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { category } = useLocalSearchParams<{ category: string }>();
  const hasLoadedOnce = useRef(false);

  const [items, setItems] = useState<WishlistItem[]>(() => getCachedItems());
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(() => getCachedItems().length === 0);

  const [customAlert, setCustomAlert] = useState<{
    title: string;
    message: string;
    buttons: { text: string; style?: 'cancel' | 'destructive' | 'default'; onPress: () => void }[];
  } | null>(null);

  const showCustomAlert = useCallback((
    title: string,
    message: string,
    buttons?: { text: string; style?: 'cancel' | 'destructive' | 'default'; onPress?: () => void }[]
  ) => {
    setCustomAlert({
      title,
      message,
      buttons: buttons && buttons.length > 0 ? buttons.map(b => ({
        text: b.text,
        style: b.style,
        onPress: () => {
          setCustomAlert(null);
          if (b.onPress) b.onPress();
        }
      })) : [{
        text: 'OK',
        onPress: () => setCustomAlert(null)
      }]
    });
  }, []);

  const categoryItems = useMemo(() => {
    const normalizedTarget = (category || '').toLowerCase();
    const filtered = items.filter((item) => (item.category || 'Other').toLowerCase() === normalizedTarget);
    return filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [items, category]);

  const stats = useMemo(() => {
    const total = categoryItems.length;
    const completed = categoryItems.filter((i: WishlistItem) => i.done).length;
    const pending = total - completed;
    return { total, completed, pending };
  }, [categoryItems]);

  const loadItems = useCallback(async (silent = false) => {
    if (!silent && !hasLoadedOnce.current) {
      setLoading(true);
    }
    try {
      const data = await fetchItems();
      setItems((prev) => {
        const reconciled = reconcileItems(prev, data);
        saveCachedItems(reconciled);
        return reconciled;
      });
    } catch (err) {
      console.error('Fetch items failed in category screen:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      const cached = getCachedItems();
      if (cached.length > 0) {
        setItems(cached);
      }
      loadItems(cached.length > 0).finally(() => {
        hasLoadedOnce.current = true;
      });
    }, [loadItems])
  );

  useEffect(() => {
    const channel = supabase
      .channel('category-detail-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'wishlist_items' },
        () => {
          loadItems(true);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadItems]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadItems();
    setRefreshing(false);
  }, [loadItems]);

  const handleToggleDone = useCallback(async (id: string, done: boolean) => {
    let previousItems: WishlistItem[] = [];
    setItems((prev) => {
      previousItems = prev;
      const updated = prev.map((item) =>
        item.id === id ? { ...item, done } : item
      );
      saveCachedItems(updated);
      return updated;
    });

    try {
      await updateItem(id, { done });

      if (done) {
        const item = previousItems.find((i) => i.id === id);
        if (item) {
          const lowestPrice = item.prices && item.prices.length > 0
            ? Math.min(...item.prices.map((p) => Number(p.price)))
            : 0;

          showCustomAlert(
            'ITEM ACQUIRED',
            `Would you like to log "${item.name}" as an expense in your Ledger?`,
            [
              { text: 'Skip', style: 'cancel' },
              {
                text: 'Log Expense',
                style: 'default',
                onPress: () => {
                  router.push({
                    pathname: '/expenses/transaction',
                    params: {
                      note: item.name,
                      amount: lowestPrice || '',
                      category_name: item.category,
                      linked_item_id: item.id,
                    },
                  });
                },
              },
            ]
          );
        }
      }
    } catch {
      setItems(() => {
        saveCachedItems(previousItems);
        return previousItems;
      });
      showCustomAlert('Sync Failed', 'Failed to update item status. Rolled back.');
    }
  }, [showCustomAlert, router]);

  const handleDeleteItem = useCallback(async (id: string) => {
    let previousItems: WishlistItem[] = [];
    setItems((prev) => {
      previousItems = prev;
      const updated = prev.filter((i) => i.id !== id);
      saveCachedItems(updated);
      return updated;
    });
    try {
      await deleteItem(id);
    } catch {
      setItems(() => {
        saveCachedItems(previousItems);
        return previousItems;
      });
      Alert.alert('Error', 'Could not delete item. Please try again.');
    }
  }, []);

  const handlePressItem = useCallback((item: WishlistItem) => {
    router.push(`/items/${item.id}`);
  }, [router]);

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 16 }]}>
      {/* Header Panel */}
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>‹ Back</Text>
        </Pressable>
        <Pressable
          style={styles.addBtnHeader}
          onPress={() => router.push({ pathname: '/add', params: { category } })}
        >
          <Text style={styles.addBtnHeaderText}>+ Add Item</Text>
        </Pressable>
      </View>

      <View style={styles.titleSection}>
        <View>
          <Text style={styles.eyebrow}>CATEGORY CHECKLIST</Text>
          <Text style={styles.title}>{category?.toUpperCase()}</Text>
        </View>
        <View style={styles.statsBadge}>
          <Text style={styles.statsBadgeText}>
            {stats.completed}/{stats.total} ACQUIRED
          </Text>
        </View>
      </View>

      {/* Main content list */}
      {loading && categoryItems.length === 0 ? (
        <View style={styles.centered}>
          <ActivityIndicator size="small" color={DL.soon} />
        </View>
      ) : categoryItems.length === 0 ? (
        <View style={styles.centered}>
          <View style={styles.emptyCard}>
            <Text style={styles.emptyIcon}>📂</Text>
            <Text style={styles.emptyTitle}>Category is Empty</Text>
            <Text style={styles.emptyText}>
              Add your first wishlist item into this folder to get started.
            </Text>
            <Pressable
              onPress={() => router.push({ pathname: '/add', params: { category } })}
              style={styles.emptyButton}
            >
              <Text style={styles.emptyButtonText}>Add Item</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <ScrollView
          style={styles.scrollArea}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: insets.bottom + 100 },
          ]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={DL.muted}
              colors={[DL.now, DL.soon, DL.dream]}
              progressBackgroundColor={DL.card}
            />
          }
        >
          {categoryItems.map((item, idx) => (
            <React.Fragment key={item.id}>
              {idx > 0 && <View style={styles.modalRowDivider} />}
              <SwipeableRow
                item={item}
                onPress={handlePressItem}
                onToggleDone={handleToggleDone}
                onDelete={handleDeleteItem}
              />
            </React.Fragment>
          ))}
        </ScrollView>
      )}

      {/* Custom Dark Theme Alert Modal */}
      {customAlert && (
        <Modal
          visible={!!customAlert}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setCustomAlert(null)}
        >
          <View style={styles.alertOverlay}>
            <View style={styles.alertBox}>
              <Text style={styles.alertTitle}>{customAlert.title.toUpperCase()}</Text>
              <Text style={styles.alertMessage}>{customAlert.message}</Text>
              <View style={styles.alertButtonRow}>
                {customAlert.buttons.map((btn, idx) => {
                  const isDestructive = btn.style === 'destructive';
                  const isCancel = btn.style === 'cancel';
                  return (
                    <Pressable
                      key={idx}
                      onPress={btn.onPress}
                      style={({ pressed }) => [
                        styles.alertButton,
                        isDestructive && styles.alertBtnDestructive,
                        isCancel && styles.alertBtnCancel,
                        !isDestructive && !isCancel && styles.alertBtnDefault,
                        pressed && { opacity: 0.8, transform: [{ scale: 0.97 }] }
                      ]}
                    >
                      <Text
                        style={[
                          styles.alertButtonText,
                          isDestructive && styles.alertBtnTextDestructive,
                          isCancel && styles.alertBtnTextCancel,
                          !isDestructive && !isCancel && styles.alertBtnTextDefault
                        ]}
                      >
                        {btn.text}
                      </Text>
                    </Pressable>
                  );
                })}
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
    paddingHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  backBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#2A2F38',
    backgroundColor: 'transparent',
  },
  backBtnText: {
    fontFamily: DLFonts.mono,
    fontSize: 10,
    fontWeight: '700',
    color: '#8890A0',
    letterSpacing: 0.5,
  },
  addBtnHeader: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: DL.soon,
    backgroundColor: 'rgba(0, 240, 255, 0.04)',
  },
  addBtnHeaderText: {
    fontFamily: DLFonts.mono,
    fontSize: 10,
    fontWeight: '700',
    color: DL.soon,
    letterSpacing: 0.5,
  },
  titleSection: {
    paddingHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 20,
  },
  eyebrow: {
    fontSize: 10,
    letterSpacing: 2.5,
    color: DL.muted,
    fontFamily: DLFonts.mono,
    marginBottom: 2,
    fontWeight: '500',
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: DL.text,
  },
  statsBadge: {
    borderColor: '#242830',
    borderWidth: 1.2,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statsBadgeText: {
    fontSize: 9.5,
    fontFamily: DLFonts.mono,
    color: DL.text,
    fontWeight: '700',
    letterSpacing: 2,
    textShadowColor: 'rgba(231, 233, 238, 0.3)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 3,
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 10,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyCard: {
    backgroundColor: DL.card,
    borderColor: DL.border,
    borderWidth: 1,
    borderRadius: 14,
    padding: 28,
    alignItems: 'center',
    width: '100%',
    maxWidth: 340,
  },
  emptyIcon: {
    fontSize: 32,
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: 'bold',
    color: DL.text,
    fontFamily: DLFonts.sans,
    marginBottom: 8,
  },
  emptyText: {
    color: DL.muted,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    fontFamily: DLFonts.sans,
    marginBottom: 20,
  },
  emptyButton: {
    backgroundColor: DL.text,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 18,
  },
  emptyButtonText: {
    color: '#0B0D10',
    fontWeight: 'bold',
    fontFamily: DLFonts.mono,
    fontSize: 12,
  },
  modalRowDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.04)',
    marginHorizontal: 20,
  },
  // ── Swipeable Row ─────────────────────────────────────────────────────────
  swipeRowContainer: {
    position: 'relative',
    overflow: 'hidden',
  },
  deleteAction: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 72,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#3A0A0A',
  },
  deleteBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  deleteBtnText: {
    fontFamily: DLFonts.mono,
    fontSize: 10,
    fontWeight: '700',
    color: '#FF4444',
    letterSpacing: 0.5,
  },
  swipeRowContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 13,
    backgroundColor: '#0F1215',
    gap: 12,
  },
  modalCheckboxHit: {
    padding: 4,
    marginLeft: -4,
  },
  modalCheckbox: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: '#404550',
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  modalCheckboxDone: {
    backgroundColor: DL.soon,
    borderColor: DL.soon,
  },
  modalCheckboxTick: {
    width: 8,
    height: 8,
    borderRadius: 2,
    backgroundColor: '#0B0D10',
  },
  modalRowText: {
    flex: 1,
    gap: 4,
  },
  modalItemName: {
    fontFamily: DLFonts.sans,
    fontSize: 15,
    fontWeight: '600',
    color: DL.text,
    letterSpacing: 0.1,
    lineHeight: 20,
  },
  modalItemNameDone: {
    opacity: 0.35,
    textDecorationLine: 'line-through',
  },
  modalItemMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modalTierPill: {
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  modalTierText: {
    fontFamily: DLFonts.mono,
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  modalPriceText: {
    fontFamily: DLFonts.mono,
    fontSize: 10,
    color: DL.muted,
    letterSpacing: 0.3,
  },
  modalChevron: {
    color: '#30353F',
    fontSize: 22,
    fontWeight: '300',
    lineHeight: 26,
    marginRight: -4,
  },
  // Custom Dark Alert Modal Styles
  alertOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  alertBox: {
    width: 290,
    backgroundColor: '#161822',
    borderColor: '#242830',
    borderWidth: 1.2,
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 15,
    elevation: 10,
  },
  alertTitle: {
    fontFamily: DLFonts.mono,
    fontSize: 14,
    fontWeight: 'bold',
    color: DL.text,
    marginBottom: 10,
    letterSpacing: 0.5,
  },
  alertMessage: {
    fontFamily: DLFonts.sans,
    fontSize: 13,
    color: DL.muted,
    lineHeight: 18,
    marginBottom: 20,
  },
  alertButtonRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  alertButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  alertBtnDefault: {
    backgroundColor: DL.text,
  },
  alertBtnCancel: {
    backgroundColor: 'transparent',
    borderColor: '#2A2F38',
    borderWidth: 1,
  },
  alertBtnDestructive: {
    backgroundColor: 'rgba(255, 51, 51, 0.12)',
    borderColor: 'rgba(255, 51, 51, 0.3)',
    borderWidth: 1,
  },
  alertButtonText: {
    fontSize: 11,
    fontFamily: DLFonts.mono,
    fontWeight: 'bold',
  },
  alertBtnTextDefault: {
    color: '#000000',
  },
  alertBtnTextCancel: {
    color: DL.muted,
  },
  alertBtnTextDestructive: {
    color: '#FF3333',
  },
});
