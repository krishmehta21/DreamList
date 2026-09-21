import React, { useState, useEffect, useCallback, useMemo, useRef, memo } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  StyleSheet,
  ActivityIndicator,
  Pressable,
  Platform,
  Dimensions,
  Animated,
  Vibration,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Reanimated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  LinearTransition,
} from 'react-native-reanimated';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { getCachedItems, saveCachedItems, reconcileItems, cleanOrphanedTempItems } from '@/lib/database';
import { DL, DLFonts, TIER_COLOR } from '@/constants/design';
import { fetchItems, updateItem, deleteItem, triggerResearch } from '@/lib/api';
import { FilterChip, ItemCard } from '@/components/dreamlist';
import { supabase } from '@/lib/supabase';
import type { WishlistItem, Tier, Category } from '@/lib/types';
import { TIERS, CATEGORIES } from '@/lib/types';
import { CustomAlert as Alert } from '@/components/CustomAlert';
import { PlusIcon, DreamsIcon, CheckIcon, ChevronRightIcon } from '@/components/ui/TabIcons';
import { CategoryIcon, getCategoryEmoji } from '@/components/ui/CategoryIcon';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const ReanimatedLayoutTransition = LinearTransition.springify().damping(20).stiffness(160);

const DEFAULT_CATEGORY_ORDER: Category[] = ['Tech', 'Home', 'Apparel', 'Books', 'Fitness', 'Other'];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getLowestPrice(item: WishlistItem): number | null {
  if (!item.prices || item.prices.length === 0) return null;
  const valid = item.prices
    .map((p) => Number(p.price))
    .filter((p) => !isNaN(p) && p > 0);
  return valid.length > 0 ? Math.min(...valid) : null;
}

function formatCurrency(amount: number): string {
  return `₹${Math.round(amount).toLocaleString('en-IN')}`;
}

// ─── Revamped Folder Card Component ───────────────────────────────────────────

interface FolderCardProps {
  category: Category;
  items: WishlistItem[];
  onPressItem: (item: WishlistItem) => void;
  onToggleDone: (id: string, done: boolean) => void;
  onPressFolder: () => void;
}

const FolderCard = memo(function FolderCard({
  category,
  items,
  onPressItem,
  onToggleDone,
  onPressFolder,
}: FolderCardProps) {
  const totalCount = items.length;
  const completedCount = items.filter((i) => i.done).length;
  const progressRatio = totalCount > 0 ? completedCount / totalCount : 0;
  const isEmpty = totalCount === 0;

  // Calculate sum of active unacquired items in this category
  const categoryActiveTotal = useMemo(() => {
    return items
      .filter((i) => !i.done)
      .reduce((sum, item) => {
        const p = getLowestPrice(item);
        return sum + (p || 0);
      }, 0);
  }, [items]);

  // Show up to 4 items in folder preview
  const displayItems = useMemo(() => items.slice(0, 4), [items]);
  const extraCount = totalCount - displayItems.length;

  return (
    <View style={styles.folderCard}>
      {/* Folder Header */}
      <Pressable
        style={({ pressed }) => [styles.folderHeader, pressed && styles.rowPressed]}
        onPress={onPressFolder}
        hitSlop={4}
      >
        <View style={styles.folderHeaderLeft}>
          <CategoryIcon name={category} size={38} fontSize={18} />
          <View style={styles.folderTitleColumn}>
            <View style={styles.folderTitleRow}>
              <Text style={styles.folderTitle}>{category}</Text>
              <View style={styles.countBadge}>
                <Text style={styles.countBadgeText}>{totalCount}</Text>
              </View>
            </View>
            {categoryActiveTotal > 0 ? (
              <Text style={styles.folderSubPrice}>
                {formatCurrency(categoryActiveTotal)} needed
              </Text>
            ) : (
              <Text style={styles.folderSubMuted}>
                {completedCount > 0 ? `${completedCount} acquired` : 'No active costs'}
              </Text>
            )}
          </View>
        </View>

        <View style={styles.folderHeaderRight}>
          {totalCount > 0 && (
            <View style={styles.progressPercentPill}>
              <Text style={styles.progressPercentText}>
                {Math.round(progressRatio * 100)}%
              </Text>
            </View>
          )}
          <View style={styles.chevronWrap}>
            <ChevronRightIcon color={DL.muted} size={16} />
          </View>
        </View>
      </Pressable>

      {/* Mini Progress Track */}
      {totalCount > 0 && (
        <View style={styles.miniProgressTrack}>
          <View
            style={[
              styles.miniProgressFill,
              { width: `${Math.max(4, Math.round(progressRatio * 100))}%` },
            ]}
          />
        </View>
      )}

      {/* Folder Items List */}
      <View style={styles.folderItemsContainer}>
        {isEmpty ? (
          <Pressable
            style={({ pressed }) => [styles.folderEmptyRow, pressed && styles.rowPressed]}
            onPress={onPressFolder}
          >
            <Text style={styles.folderEmptyText}>+ Add your first {category.toLowerCase()} dream</Text>
          </Pressable>
        ) : (
          displayItems.map((item) => {
            const lowestPrice = getLowestPrice(item);
            const isResearching = item.status === 'researching' || item.status === 'pending';

            return (
              <View key={item.id} style={styles.itemRow}>
                {/* Checkbox */}
                <Pressable
                  onPress={() => onToggleDone(item.id, !item.done)}
                  style={styles.checkboxHit}
                  hitSlop={8}
                >
                  <View
                    style={[
                      styles.customCheckbox,
                      item.done && styles.customCheckboxDone,
                    ]}
                  >
                    {item.done && <CheckIcon color="#FFFFFF" size={11} />}
                  </View>
                </Pressable>

                {/* Item Name */}
                <Pressable
                  onPress={() => onPressItem(item)}
                  style={styles.itemNameHit}
                  hitSlop={4}
                >
                  <Text
                    style={[
                      styles.itemNameText,
                      item.done && styles.itemNameTextDone,
                    ]}
                    numberOfLines={1}
                  >
                    {item.name}
                  </Text>
                </Pressable>

                {/* Right Indicators */}
                <View style={styles.itemRightWrap}>
                  {isResearching ? (
                    <View style={styles.researchBadge}>
                      <Text style={styles.researchBadgeText}>AI ⚡</Text>
                    </View>
                  ) : lowestPrice ? (
                    <Text
                      style={[
                        styles.itemPriceText,
                        item.done && styles.itemPriceTextDone,
                      ]}
                    >
                      {formatCurrency(lowestPrice)}
                    </Text>
                  ) : null}

                  {/* Tier Dot */}
                  <View
                    style={[
                      styles.tierDot,
                      { backgroundColor: TIER_COLOR[item.tier] || DL.muted },
                    ]}
                  />
                </View>
              </View>
            );
          })
        )}
      </View>

      {/* Folder Footer / View All Link */}
      {extraCount > 0 && (
        <Pressable
          style={({ pressed }) => [styles.folderFooterBtn, pressed && styles.rowPressed]}
          onPress={onPressFolder}
        >
          <Text style={styles.folderFooterText}>
            +{extraCount} more · View all in {category} →
          </Text>
        </Pressable>
      )}
    </View>
  );
});

// ─── Main DreamList Screen ────────────────────────────────────────────────────

export default function DreamsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const hasLoadedOnce = useRef(false);

  // States
  const [items, setItems] = useState<WishlistItem[]>(() => getCachedItems());
  const [tierFilter, setTierFilter] = useState<Tier | null>(null);
  const [viewMode, setViewMode] = useState<'folders' | 'stream'>('folders');
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(() => getCachedItems().length === 0);
  const [categoryOrder, setCategoryOrder] = useState<Category[]>(DEFAULT_CATEGORY_ORDER);

  // Safe tab bar clearance
  const tabBottom = Platform.OS === 'ios' ? Math.max(insets.bottom, 16) : 16;
  // Position the FAB safely above the 62px floating navigation bar!
  const fabBottom = tabBottom + 74;

  // Load persisted category order
  useEffect(() => {
    AsyncStorage.getItem('dl_category_order').then((val) => {
      if (val) {
        try {
          const parsed: Category[] = JSON.parse(val);
          const merged = [
            ...parsed,
            ...DEFAULT_CATEGORY_ORDER.filter((c) => !parsed.includes(c)),
          ];
          setCategoryOrder(merged);
        } catch {}
      }
    });
  }, []);

  // Fetch Items
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
      console.error('Fetch dream items failed:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      cleanOrphanedTempItems();
      const cached = getCachedItems();
      if (cached.length > 0) {
        setItems(cached);
      }
      loadItems(cached.length > 0).finally(() => {
        hasLoadedOnce.current = true;
      });
    }, [loadItems])
  );

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel('dreams-realtime')
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

  // Toggle item done status
  const handleToggleDone = useCallback(
    async (id: string, done: boolean) => {
      Vibration.vibrate(15);
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
          const target = previousItems.find((i) => i.id === id);
          if (target) {
            const price = getLowestPrice(target) || 0;
            Alert.alert(
              '🎉 DREAM ACQUIRED!',
              `Would you like to log "${target.name}" as an expense in your Ledger?`,
              [
                { text: 'Later', style: 'cancel' },
                {
                  text: 'Log Expense',
                  style: 'default',
                  onPress: () => {
                    router.push({
                      pathname: '/expenses/transaction',
                      params: {
                        note: target.name,
                        amount: price > 0 ? String(price) : '',
                        category_name: target.category,
                        linked_item_id: target.id,
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
        Alert.alert('Sync Failed', 'Could not update item status.');
      }
    },
    [router]
  );

  const handlePressItem = useCallback(
    (item: WishlistItem) => {
      Vibration.vibrate(8);
      router.push(`/items/${item.id}`);
    },
    [router]
  );

  const handlePressFolder = useCallback(
    (cat: Category) => {
      Vibration.vibrate(8);
      router.push(`/category/${cat}` as any);
    },
    [router]
  );

  // Filtered items based on tier
  const filteredItems = useMemo(() => {
    if (!tierFilter) return items;
    return items.filter((i) => i.tier === tierFilter);
  }, [items, tierFilter]);

  // Calculations for Hero Analytics
  const totalCount = items.length;
  const doneCount = items.filter((i) => i.done).length;
  const progressRatio = totalCount > 0 ? doneCount / totalCount : 0;
  const researchingCount = items.filter(
    (i) => i.status === 'researching' || i.status === 'pending'
  ).length;

  const totalActiveCapitalNeeded = useMemo(() => {
    return items
      .filter((i) => !i.done)
      .reduce((sum, item) => {
        const p = getLowestPrice(item);
        return sum + (p || 0);
      }, 0);
  }, [items]);

  // Group items by category for Folder View
  const folderData = useMemo(() => {
    const grouped: Record<string, WishlistItem[]> = {};
    for (const item of filteredItems) {
      const cat = item.category || 'Other';
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(item);
    }

    return categoryOrder.map((cat) => ({
      category: cat,
      items: grouped[cat] || [],
    }));
  }, [filteredItems, categoryOrder]);

  return (
    <View style={styles.screen}>
      {/* Ambient background glows */}
      <View style={styles.ambientTopRight} pointerEvents="none" />
      <View style={styles.ambientBottomLeft} pointerEvents="none" />

      {/* Top Header Bar */}
      <View style={[styles.header, { paddingTop: insets.top + 14 }]}>
        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerEyebrow}>DREAMLIST</Text>
          <Text style={styles.headerTitle}>Desire Vault</Text>
        </View>

        {/* View Mode Switcher (Folders vs Stream) */}
        <View style={styles.viewModeSwitcher}>
          <Pressable
            style={[
              styles.viewModeBtn,
              viewMode === 'folders' && styles.viewModeBtnActive,
            ]}
            onPress={() => {
              Vibration.vibrate(6);
              setViewMode('folders');
            }}
          >
            <Text
              style={[
                styles.viewModeBtnText,
                viewMode === 'folders' && styles.viewModeBtnTextActive,
              ]}
            >
              Folders
            </Text>
          </Pressable>

          <Pressable
            style={[
              styles.viewModeBtn,
              viewMode === 'stream' && styles.viewModeBtnActive,
            ]}
            onPress={() => {
              Vibration.vibrate(6);
              setViewMode('stream');
            }}
          >
            <Text
              style={[
                styles.viewModeBtnText,
                viewMode === 'stream' && styles.viewModeBtnTextActive,
              ]}
            >
              All Items
            </Text>
          </Pressable>
        </View>
      </View>

      {/* Main Scroll Content */}
      <ScrollView
        style={styles.scrollContainer}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: tabBottom + 130 },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#4F46E5"
            colors={['#06B6D4', '#4F46E5', '#A855F7']}
            progressBackgroundColor="#FFFFFF"
          />
        }
      >
        {/* ─── Hero Fintech Analytics Card ─────────────────────────────────── */}
        <View style={styles.heroCard}>
          <View style={styles.heroTopRow}>
            <View>
              <Text style={styles.heroSublabel}>ESTIMATED CAPITAL NEEDED</Text>
              <Text style={styles.heroAmount}>
                {formatCurrency(totalActiveCapitalNeeded)}
              </Text>
            </View>

            <View style={styles.heroBadge}>
              <Text style={styles.heroBadgeText}>
                {doneCount}/{totalCount} ACQUIRED
              </Text>
            </View>
          </View>

          {/* Smooth Animated Progress Bar */}
          <View style={styles.heroProgressTrack}>
            <LinearGradient
              colors={['#06B6D4', '#4F46E5']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[
                styles.heroProgressFill,
                { width: `${Math.max(5, Math.round(progressRatio * 100))}%` },
              ]}
            />
          </View>

          {/* 3 Metric Pills */}
          <View style={styles.metricsRow}>
            <View style={styles.metricPill}>
              <Text style={styles.metricPillNumber}>{totalCount - doneCount}</Text>
              <Text style={styles.metricPillLabel}>Active Desires</Text>
            </View>

            <View style={styles.metricDivider} />

            <View style={styles.metricPill}>
              <Text style={[styles.metricPillNumber, { color: '#10B981' }]}>
                {doneCount}
              </Text>
              <Text style={styles.metricPillLabel}>Fulfilled</Text>
            </View>

            <View style={styles.metricDivider} />

            <View style={styles.metricPill}>
              <Text style={[styles.metricPillNumber, { color: '#8B5CF6' }]}>
                {researchingCount > 0 ? `⚡ ${researchingCount}` : 'Auto'}
              </Text>
              <Text style={styles.metricPillLabel}>AI Tracking</Text>
            </View>
          </View>
        </View>

        {/* ─── Filter Chips (Tiers) ────────────────────────────────────────── */}
        <View style={styles.filterBar}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterChipScroll}
          >
            <FilterChip
              label={`All (${totalCount})`}
              active={tierFilter === null}
              color={DL.text}
              onPress={() => setTierFilter(null)}
            />
            {TIERS.map((t) => {
              const count = items.filter((i) => i.tier === t).length;
              return (
                <FilterChip
                  key={t}
                  label={`${t.toUpperCase()} (${count})`}
                  active={tierFilter === t}
                  color={TIER_COLOR[t]}
                  onPress={() => setTierFilter(tierFilter === t ? null : t)}
                />
              );
            })}
          </ScrollView>
        </View>

        {/* ─── Content Area ────────────────────────────────────────────────── */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#4F46E5" />
            <Text style={styles.loadingText}>Loading your dream items...</Text>
          </View>
        ) : items.length === 0 ? (
          /* Empty State */
          <View style={styles.emptyContainer}>
            <View style={styles.emptyCard}>
              <View style={styles.emptyIconCircle}>
                <DreamsIcon color="#4F46E5" size={32} />
              </View>
              <Text style={styles.emptyHeading}>Build Your Wishlist</Text>
              <Text style={styles.emptySubtext}>
                Add items you want to buy. Our AI automatically tracks prices, specs, and finds the best deals for you.
              </Text>

              <Pressable
                style={({ pressed }) => [styles.emptyAddBtn, pressed && styles.btnPressed]}
                onPress={() => {
                  Vibration.vibrate(10);
                  router.push('/add');
                }}
              >
                <LinearGradient
                  colors={DL.cardGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.emptyAddGradient}
                >
                  <PlusIcon color="#FFFFFF" size={18} />
                  <Text style={styles.emptyAddBtnText}>Add Your First Item</Text>
                </LinearGradient>
              </Pressable>
            </View>
          </View>
        ) : viewMode === 'folders' ? (
          /* ── View 1: Categorized Folders ── */
          <Reanimated.View layout={ReanimatedLayoutTransition} style={styles.foldersContainer}>
            {folderData.map(({ category, items: catItems }) => (
              <FolderCard
                key={category}
                category={category}
                items={catItems}
                onPressItem={handlePressItem}
                onToggleDone={handleToggleDone}
                onPressFolder={() => handlePressFolder(category)}
              />
            ))}
          </Reanimated.View>
        ) : (
          /* ── View 2: Stream of All Items ── */
          <Reanimated.View layout={ReanimatedLayoutTransition} style={styles.streamContainer}>
            {filteredItems.map((item) => (
              <View key={item.id} style={styles.streamCardWrap}>
                <ItemCard
                  item={item}
                  onPress={handlePressItem}
                  onToggleDone={handleToggleDone}
                />
              </View>
            ))}
          </Reanimated.View>
        )}
      </ScrollView>

      {/* ─── Floating Action Button (Prominent, Safely Elevated Above Tab Bar) ─── */}
      <Pressable
        style={({ pressed }) => [
          styles.floatingAddBtn,
          { bottom: fabBottom },
          pressed && styles.btnPressed,
        ]}
        onPress={() => {
          Vibration.vibrate(15);
          router.push('/add');
        }}
        hitSlop={8}
      >
        <LinearGradient
          colors={['#06B6D4', '#4F46E5', '#A855F7']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.floatingAddGradient}
        >
          <PlusIcon color="#FFFFFF" size={20} />
          <Text style={styles.floatingAddLabel}>NEW DREAM</Text>
        </LinearGradient>
      </Pressable>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: DL.bg,
  },

  // Ambient glowing circles for fintech depth
  ambientTopRight: {
    position: 'absolute',
    top: -50,
    right: -50,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(6, 182, 212, 0.09)',
  },
  ambientBottomLeft: {
    position: 'absolute',
    bottom: 120,
    left: -70,
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: 'rgba(79, 70, 229, 0.08)',
  },

  // Header
  header: {
    paddingHorizontal: 20,
    paddingBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  headerTitleWrap: {
    flex: 1,
  },
  headerEyebrow: {
    fontFamily: DLFonts.mono,
    fontSize: 10.5,
    fontWeight: '700',
    color: '#64748B',
    letterSpacing: 2,
    marginBottom: 2,
  },
  headerTitle: {
    fontFamily: DLFonts.sans,
    fontSize: 26,
    fontWeight: '900',
    color: DL.text,
    letterSpacing: -0.5,
  },

  // View mode switcher pill
  viewModeSwitcher: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    borderRadius: 20,
    padding: 3,
    borderWidth: 1,
    borderColor: 'rgba(226, 232, 240, 0.8)',
  },
  viewModeBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  viewModeBtnActive: {
    backgroundColor: '#4F46E5',
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  viewModeBtnText: {
    fontFamily: DLFonts.sans,
    fontSize: 11.5,
    fontWeight: '700',
    color: '#64748B',
  },
  viewModeBtnTextActive: {
    color: '#FFFFFF',
  },

  // Scroll Container
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 18,
    paddingTop: 8,
  },

  // ─── Hero Analytics Card ────────────────────────────────────────────────────
  heroCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(226, 232, 240, 0.85)',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.07,
    shadowRadius: 18,
    elevation: 4,
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  heroSublabel: {
    fontFamily: DLFonts.mono,
    fontSize: 9.5,
    fontWeight: '700',
    color: '#64748B',
    letterSpacing: 1.2,
    marginBottom: 4,
  },
  heroAmount: {
    fontFamily: DLFonts.sans,
    fontSize: 28,
    fontWeight: '900',
    color: '#0B132B',
    letterSpacing: -0.5,
  },
  heroBadge: {
    backgroundColor: '#F0F4FC',
    borderColor: '#E2E8F0',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  heroBadgeText: {
    fontFamily: DLFonts.mono,
    fontSize: 10,
    fontWeight: '800',
    color: '#4F46E5',
    letterSpacing: 0.5,
  },
  heroProgressTrack: {
    height: 7,
    backgroundColor: '#F1F5F9',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 16,
  },
  heroProgressFill: {
    height: '100%',
    borderRadius: 4,
  },
  metricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  metricPill: {
    flex: 1,
    alignItems: 'center',
  },
  metricDivider: {
    width: 1,
    height: 24,
    backgroundColor: '#E2E8F0',
  },
  metricPillNumber: {
    fontFamily: DLFonts.sans,
    fontSize: 16,
    fontWeight: '800',
    color: '#0B132B',
    marginBottom: 2,
  },
  metricPillLabel: {
    fontFamily: DLFonts.sans,
    fontSize: 10.5,
    color: '#64748B',
    fontWeight: '600',
  },

  // ─── Filter Bar ─────────────────────────────────────────────────────────────
  filterBar: {
    marginBottom: 14,
  },
  filterChipScroll: {
    gap: 8,
    paddingVertical: 2,
  },

  // ─── Folders Container ──────────────────────────────────────────────────────
  foldersContainer: {
    gap: 14,
  },
  folderCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(226, 232, 240, 0.85)',
    paddingVertical: 14,
    paddingHorizontal: 16,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  folderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 10,
  },
  folderHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  folderTitleColumn: {
    flex: 1,
  },
  folderTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  folderTitle: {
    fontFamily: DLFonts.sans,
    fontSize: 16,
    fontWeight: '800',
    color: '#0B132B',
  },
  countBadge: {
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  countBadgeText: {
    fontFamily: DLFonts.mono,
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
  },
  folderSubPrice: {
    fontFamily: DLFonts.mono,
    fontSize: 11,
    fontWeight: '700',
    color: '#D97706',
  },
  folderSubMuted: {
    fontFamily: DLFonts.sans,
    fontSize: 11,
    color: '#94A3B8',
  },
  folderHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  progressPercentPill: {
    backgroundColor: '#EEF2FF',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  progressPercentText: {
    fontFamily: DLFonts.mono,
    fontSize: 10,
    fontWeight: '800',
    color: '#4F46E5',
  },
  chevronWrap: {
    padding: 2,
  },

  miniProgressTrack: {
    height: 3,
    backgroundColor: '#F1F5F9',
    borderRadius: 1.5,
    overflow: 'hidden',
    marginBottom: 10,
  },
  miniProgressFill: {
    height: '100%',
    backgroundColor: '#4F46E5',
    borderRadius: 1.5,
  },

  folderItemsContainer: {
    gap: 2,
  },
  folderEmptyRow: {
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  folderEmptyText: {
    fontFamily: DLFonts.sans,
    fontSize: 12.5,
    color: '#6366F1',
    fontWeight: '600',
  },

  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 7,
  },
  checkboxHit: {
    paddingRight: 10,
  },
  customCheckbox: {
    width: 18,
    height: 18,
    borderRadius: 6,
    borderWidth: 1.6,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  customCheckboxDone: {
    backgroundColor: '#10B981',
    borderColor: '#10B981',
  },
  itemNameHit: {
    flex: 1,
    paddingRight: 8,
  },
  itemNameText: {
    fontFamily: DLFonts.sans,
    fontSize: 13.5,
    color: '#1E293B',
    fontWeight: '600',
  },
  itemNameTextDone: {
    textDecorationLine: 'line-through',
    color: '#94A3B8',
  },
  itemRightWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  itemPriceText: {
    fontFamily: DLFonts.mono,
    fontSize: 11.5,
    fontWeight: '700',
    color: '#0F172A',
  },
  itemPriceTextDone: {
    color: '#94A3B8',
  },
  researchBadge: {
    backgroundColor: 'rgba(139, 92, 246, 0.12)',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  researchBadgeText: {
    fontFamily: DLFonts.mono,
    fontSize: 9.5,
    fontWeight: '800',
    color: '#7C3AED',
  },
  tierDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },

  folderFooterBtn: {
    paddingTop: 10,
    paddingBottom: 2,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#F8FAFC',
    marginTop: 4,
  },
  folderFooterText: {
    fontFamily: DLFonts.sans,
    fontSize: 11.5,
    fontWeight: '700',
    color: '#4F46E5',
  },

  // ─── Stream Container ───────────────────────────────────────────────────────
  streamContainer: {
    gap: 8,
  },
  streamCardWrap: {
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(226, 232, 240, 0.8)',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },

  // ─── Floating Action Button (FAB) ───────────────────────────────────────────
  floatingAddBtn: {
    position: 'absolute',
    right: 20,
    borderRadius: 28,
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 10,
    zIndex: 999,
  },
  floatingAddGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 28,
  },
  floatingAddLabel: {
    fontFamily: DLFonts.sans,
    fontSize: 12.5,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.8,
  },

  // ─── Loading & Empty States ─────────────────────────────────────────────────
  loadingContainer: {
    paddingVertical: 60,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    fontFamily: DLFonts.sans,
    fontSize: 13,
    color: '#64748B',
  },

  emptyContainer: {
    paddingVertical: 30,
    alignItems: 'center',
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 28,
    alignItems: 'center',
    width: '100%',
    borderWidth: 1,
    borderColor: 'rgba(226, 232, 240, 0.85)',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 3,
  },
  emptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyHeading: {
    fontFamily: DLFonts.sans,
    fontSize: 18,
    fontWeight: '800',
    color: '#0B132B',
    marginBottom: 8,
  },
  emptySubtext: {
    fontFamily: DLFonts.sans,
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 20,
    paddingHorizontal: 10,
  },
  emptyAddBtn: {
    borderRadius: 20,
    overflow: 'hidden',
  },
  emptyAddGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 20,
  },
  emptyAddBtnText: {
    fontFamily: DLFonts.sans,
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // Interactions
  btnPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.96 }],
  },
  rowPressed: {
    opacity: 0.7,
  },
});
