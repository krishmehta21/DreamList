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
  Vibration,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Reanimated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedRef,
  withTiming,
  withSequence,
  withRepeat,
  Easing,
  LinearTransition,
} from 'react-native-reanimated';
import Sortable from 'react-native-sortables';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { getCachedItems, saveCachedItems, reconcileItems, cleanOrphanedTempItems } from '@/lib/database';
import { DL, DLFonts, TIER_COLOR } from '@/constants/design';
import { fetchItems, updateItem } from '@/lib/api';
import { FilterChip, ItemCard } from '@/components/dreamlist';
import { supabase } from '@/lib/supabase';
import type { WishlistItem, Tier, Category } from '@/lib/types';
import { TIERS } from '@/lib/types';
import { CustomAlert as Alert } from '@/components/CustomAlert';
import { PlusIcon, DreamsIcon, CheckIcon, ChevronRightIcon } from '@/components/ui/TabIcons';
import { CategoryIcon } from '@/components/ui/CategoryIcon';

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

// ─── Apple-Style Wiggle Animation Wrapper ──────────────────────────────────────

const WiggleCard = memo(function WiggleCard({
  isEditing,
  index,
  children,
  style,
}: {
  isEditing: boolean;
  index: number;
  children: React.ReactNode;
  style?: any;
}) {
  const rotation = useSharedValue(0);

  useEffect(() => {
    if (isEditing) {
      // Natural Apple home screen alternating rotational jiggle
      const startAngle = index % 2 === 0 ? 1.2 : -1.2;
      const duration = 120 + (index % 3) * 15;
      rotation.value = startAngle;
      rotation.value = withRepeat(
        withSequence(
          withTiming(-startAngle, { duration, easing: Easing.inOut(Easing.ease) }),
          withTiming(startAngle, { duration, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        true
      );
    } else {
      rotation.value = withTiming(0, { duration: 140 });
    }
  }, [isEditing, index, rotation]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  return (
    <Reanimated.View style={[style, animatedStyle]}>
      {children}
    </Reanimated.View>
  );
});

// ─── Revamped Folder Card Component ───────────────────────────────────────────

interface FolderCardProps {
  category: Category;
  items: WishlistItem[];
  size: 'compact' | 'wide';
  editMode: boolean;
  onPressItem: (item: WishlistItem) => void;
  onToggleDone: (id: string, done: boolean) => void;
  onPressFolder: () => void;
  onToggleSize: () => void;
  onHideCategory: () => void;
}

const FolderCard = memo(function FolderCard({
  category,
  items,
  size,
  editMode,
  onPressItem,
  onToggleDone,
  onPressFolder,
  onToggleSize,
  onHideCategory,
}: FolderCardProps) {
  const totalCount = items.length;
  const completedCount = items.filter((i) => i.done).length;
  const progressRatio = totalCount > 0 ? completedCount / totalCount : 0;
  const isEmpty = totalCount === 0;
  const isWide = size === 'wide';

  // Calculate sum of active unacquired items in this category
  const categoryActiveTotal = useMemo(() => {
    return items
      .filter((i) => !i.done)
      .reduce((sum, item) => {
        const p = getLowestPrice(item);
        return sum + (p || 0);
      }, 0);
  }, [items]);

  // Display items: 4 if wide, 2 if compact
  const maxDisplay = isWide ? 4 : 2;
  const displayItems = useMemo(() => items.slice(0, maxDisplay), [items, maxDisplay]);
  const extraCount = totalCount - displayItems.length;

  return (
    <View style={[styles.folderCard, !isWide && styles.folderCardCompact]}>
      {/* Apple-Style Delete Badge (Top-Left) */}
      {editMode && (
        <Pressable
          style={styles.appleDeleteBadge}
          onPress={onHideCategory}
          hitSlop={10}
        >
          <Text style={styles.appleDeleteText}>✕</Text>
        </Pressable>
      )}

      {/* Apple-Style Widget Size Toggle (Top-Right) */}
      {editMode && (
        <Pressable
          style={styles.appleSizeToggle}
          onPress={onToggleSize}
          hitSlop={10}
        >
          <Text style={styles.appleSizeToggleText}>
            {isWide ? '◫' : '▬'}
          </Text>
        </Pressable>
      )}

      {/* Folder Header */}
      <Pressable
        style={({ pressed }) => [styles.folderHeader, pressed && styles.rowPressed]}
        onPress={editMode ? undefined : onPressFolder}
        hitSlop={4}
      >
        <View style={styles.folderHeaderLeft}>
          <CategoryIcon name={category} size={isWide ? 38 : 32} fontSize={isWide ? 18 : 15} />
          <View style={styles.folderTitleColumn}>
            <View style={styles.folderTitleRow}>
              <Text style={[styles.folderTitle, !isWide && styles.folderTitleCompact]} numberOfLines={1}>
                {category}
              </Text>
              <View style={styles.countBadge}>
                <Text style={styles.countBadgeText}>{totalCount}</Text>
              </View>
            </View>
            {categoryActiveTotal > 0 ? (
              <Text style={styles.folderSubPrice} numberOfLines={1}>
                {formatCurrency(categoryActiveTotal)}
              </Text>
            ) : (
              <Text style={styles.folderSubMuted} numberOfLines={1}>
                {completedCount > 0 ? `${completedCount} done` : 'Ready'}
              </Text>
            )}
          </View>
        </View>

        {!editMode && isWide && (
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
        )}
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
            onPress={editMode ? undefined : onPressFolder}
          >
            <Text style={styles.folderEmptyText}>+ Add {category.toLowerCase()}</Text>
          </Pressable>
        ) : (
          displayItems.map((item) => {
            const lowestPrice = getLowestPrice(item);
            const isResearching = item.status === 'researching' || item.status === 'pending';

            return (
              <View key={item.id} style={styles.itemRow}>
                {/* Checkbox */}
                <Pressable
                  onPress={editMode ? undefined : () => onToggleDone(item.id, !item.done)}
                  style={styles.checkboxHit}
                  hitSlop={8}
                >
                  <View
                    style={[
                      styles.customCheckbox,
                      item.done && styles.customCheckboxDone,
                    ]}
                  >
                    {item.done && <CheckIcon color="#FFFFFF" size={10} />}
                  </View>
                </Pressable>

                {/* Item Name */}
                <Pressable
                  onPress={editMode ? undefined : () => onPressItem(item)}
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

      {/* Folder Footer */}
      {!editMode && extraCount > 0 && (
        <Pressable
          style={({ pressed }) => [styles.folderFooterBtn, pressed && styles.rowPressed]}
          onPress={onPressFolder}
        >
          <Text style={styles.folderFooterText}>
            +{extraCount} more · View {category} →
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
  const scrollableRef = useAnimatedRef<ScrollView>();

  // Layout Widths
  const horizontalPadding = 18;
  const gap = 12;
  const availableWidth = SCREEN_WIDTH - (horizontalPadding * 2);
  const compactCardWidth = Math.floor((availableWidth - gap) / 2);
  const wideCardWidth = availableWidth;

  // States
  const [items, setItems] = useState<WishlistItem[]>(() => getCachedItems());
  const [tierFilter, setTierFilter] = useState<Tier | null>(null);
  const [viewMode, setViewMode] = useState<'folders' | 'stream'>('folders');
  const [editMode, setEditMode] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(() => getCachedItems().length === 0);
  const [categoryOrder, setCategoryOrder] = useState<Category[]>(DEFAULT_CATEGORY_ORDER);
  const [hiddenCategories, setHiddenCategories] = useState<Set<Category>>(new Set());

  // Card size preferences: compact or wide
  const [cardSizes, setCardSizes] = useState<Record<Category, 'compact' | 'wide'>>({
    Tech: 'wide',
    Home: 'compact',
    Apparel: 'compact',
    Books: 'compact',
    Fitness: 'compact',
    Other: 'wide',
  });

  // Safe tab bar clearance
  const tabBottom = Platform.OS === 'ios' ? Math.max(insets.bottom, 16) : 16;
  const fabBottom = tabBottom + 74;

  // Load persisted category order and sizes
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
    AsyncStorage.getItem('dl_hidden_categories').then((val) => {
      if (val) {
        try {
          setHiddenCategories(new Set(JSON.parse(val)));
        } catch {}
      }
    });
    AsyncStorage.getItem('dl_card_sizes').then((val) => {
      if (val) {
        try {
          setCardSizes((prev) => ({ ...prev, ...JSON.parse(val) }));
        } catch {}
      }
    });
  }, []);

  const saveCategoryOrder = useCallback(async (order: Category[]) => {
    setCategoryOrder(order);
    await AsyncStorage.setItem('dl_category_order', JSON.stringify(order));
  }, []);

  const saveCardSizes = useCallback(async (sizes: Record<Category, 'compact' | 'wide'>) => {
    setCardSizes(sizes);
    await AsyncStorage.setItem('dl_card_sizes', JSON.stringify(sizes));
  }, []);

  const handleToggleCardSize = useCallback(
    (cat: Category) => {
      Vibration.vibrate(12);
      const nextSize = cardSizes[cat] === 'wide' ? 'compact' : 'wide';
      saveCardSizes({ ...cardSizes, [cat]: nextSize });
    },
    [cardSizes, saveCardSizes]
  );

  const handleHideCategory = useCallback(
    (cat: Category) => {
      Vibration.vibrate(20);
      Alert.alert(
        `Hide ${cat}?`,
        `This category will be hidden from your dashboard. You can restore it in Settings.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Hide',
            style: 'destructive',
            onPress: () => {
              const next = new Set(hiddenCategories);
              next.add(cat);
              setHiddenCategories(next);
              AsyncStorage.setItem('dl_hidden_categories', JSON.stringify([...next]));
            },
          },
        ]
      );
    },
    [hiddenCategories]
  );

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

  // Group items by category for Folder View (filtering out hidden)
  const folderData = useMemo(() => {
    const grouped: Record<string, WishlistItem[]> = {};
    for (const item of filteredItems) {
      const cat = item.category || 'Other';
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(item);
    }

    const visibleCats = categoryOrder.filter((cat) => !hiddenCategories.has(cat));
    return visibleCats.map((cat) => ({
      category: cat,
      items: grouped[cat] || [],
    }));
  }, [filteredItems, categoryOrder, hiddenCategories]);

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

        {/* Right Header Buttons */}
        <View style={styles.headerRightActions}>
          {/* Apple-Style Jiggle Done Button */}
          {editMode ? (
            <Pressable
              style={({ pressed }) => [styles.appleDoneBtn, pressed && styles.btnPressed]}
              onPress={() => {
                Vibration.vibrate(15);
                setEditMode(false);
              }}
            >
              <Text style={styles.appleDoneBtnText}>DONE</Text>
            </Pressable>
          ) : (
            <Pressable
              style={({ pressed }) => [styles.editTriggerBtn, pressed && styles.btnPressed]}
              onPress={() => {
                Vibration.vibrate(20);
                setEditMode(true);
              }}
            >
              <Text style={styles.editTriggerText}>REORDER</Text>
            </Pressable>
          )}

          {/* View Mode Switcher (Folders vs Stream) */}
          {!editMode && (
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
          )}
        </View>
      </View>

      {/* Main Scroll Content */}
      <ScrollView
        ref={scrollableRef}
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
        {!editMode && (
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
        )}

        {/* Edit Mode Jiggle Instruction Banner */}
        {editMode && (
          <View style={styles.jiggleBanner}>
            <Text style={styles.jiggleBannerText}>
              ✋ Drag to reorder · Tap ◫ to resize · Tap ✕ to hide
            </Text>
          </View>
        )}

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
          /* ── View 1: Categorized Folders with Apple-Style Drag & Reorder ── */
          <Sortable.Flex
            scrollableRef={scrollableRef}
            flexDirection="row"
            flexWrap="wrap"
            gap={gap}
            onDragEnd={({ order }) => {
              const visibleCats = folderData.map((f) => f.category);
              const sortedVisible = order(visibleCats);
              const completeOrder = [
                ...sortedVisible,
                ...categoryOrder.filter((c) => !visibleCats.includes(c)),
              ];
              saveCategoryOrder(completeOrder);
            }}
            dragActivationDelay={editMode ? 60 : 250}
            activeItemScale={1.05}
            activeItemOpacity={0.92}
            activeItemShadowOpacity={0.35}
            inactiveItemScale={0.98}
            inactiveItemOpacity={0.78}
            hapticsEnabled={true}
          >
            {folderData.map(({ category, items: catItems }, index) => {
              const size = cardSizes[category] || 'wide';
              const isWide = size === 'wide';
              const itemWidth = isWide ? wideCardWidth : compactCardWidth;

              return (
                <Sortable.Touchable
                  key={category}
                  onLongPress={() => {
                    Vibration.vibrate(30);
                    setEditMode(true);
                  }}
                  style={{ width: itemWidth }}
                >
                  <WiggleCard isEditing={editMode} index={index}>
                    <FolderCard
                      category={category}
                      items={catItems}
                      size={size}
                      editMode={editMode}
                      onPressItem={handlePressItem}
                      onToggleDone={handleToggleDone}
                      onPressFolder={() => handlePressFolder(category)}
                      onToggleSize={() => handleToggleCardSize(category)}
                      onHideCategory={() => handleHideCategory(category)}
                    />
                  </WiggleCard>
                </Sortable.Touchable>
              );
            })}
          </Sortable.Flex>
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

      {/* ─── Floating Action Button (Safely Elevated Above Tab Bar) ─────────── */}
      {!editMode && (
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
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: DL.bg,
  },

  // Ambient glowing circles for depth
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
    paddingHorizontal: 18,
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
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  appleDoneBtn: {
    backgroundColor: '#4F46E5',
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 18,
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  appleDoneBtnText: {
    fontFamily: DLFonts.sans,
    fontSize: 12,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.8,
  },
  editTriggerBtn: {
    backgroundColor: '#FFFFFF',
    borderColor: 'rgba(226, 232, 240, 0.9)',
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
  },
  editTriggerText: {
    fontFamily: DLFonts.mono,
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
    letterSpacing: 0.5,
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
    paddingHorizontal: 11,
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
    fontSize: 11,
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

  // Filter Bar
  filterBar: {
    marginBottom: 14,
  },
  filterChipScroll: {
    gap: 8,
    paddingVertical: 2,
  },

  // Edit Jiggle Instruction Banner
  jiggleBanner: {
    backgroundColor: 'rgba(79, 70, 229, 0.08)',
    borderColor: 'rgba(79, 70, 229, 0.25)',
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 14,
    alignItems: 'center',
    marginBottom: 14,
  },
  jiggleBannerText: {
    fontFamily: DLFonts.sans,
    fontSize: 11.5,
    fontWeight: '700',
    color: '#4F46E5',
  },

  // ─── Folder Card (Apple Home Style) ─────────────────────────────────────────
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
    position: 'relative',
  },
  folderCardCompact: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    minHeight: 140,
  },

  // Apple-Style Corner Badges
  appleDeleteBadge: {
    position: 'absolute',
    top: -8,
    left: -8,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#EF4444',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
    elevation: 6,
  },
  appleDeleteText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
    lineHeight: 12,
  },
  appleSizeToggle: {
    position: 'absolute',
    top: -8,
    right: -8,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#4F46E5',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
    elevation: 6,
  },
  appleSizeToggleText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
    lineHeight: 14,
  },

  folderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 8,
  },
  folderHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
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
    fontSize: 15.5,
    fontWeight: '800',
    color: '#0B132B',
  },
  folderTitleCompact: {
    fontSize: 13.5,
  },
  countBadge: {
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  countBadgeText: {
    fontFamily: DLFonts.mono,
    fontSize: 9.5,
    fontWeight: '700',
    color: '#64748B',
  },
  folderSubPrice: {
    fontFamily: DLFonts.mono,
    fontSize: 10.5,
    fontWeight: '700',
    color: '#D97706',
  },
  folderSubMuted: {
    fontFamily: DLFonts.sans,
    fontSize: 10.5,
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
    fontSize: 9.5,
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
    marginBottom: 8,
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
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  folderEmptyText: {
    fontFamily: DLFonts.sans,
    fontSize: 12,
    color: '#6366F1',
    fontWeight: '600',
  },

  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
  },
  checkboxHit: {
    paddingRight: 8,
  },
  customCheckbox: {
    width: 17,
    height: 17,
    borderRadius: 5,
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
    paddingRight: 6,
  },
  itemNameText: {
    fontFamily: DLFonts.sans,
    fontSize: 13,
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
    gap: 5,
  },
  itemPriceText: {
    fontFamily: DLFonts.mono,
    fontSize: 11,
    fontWeight: '700',
    color: '#0F172A',
  },
  itemPriceTextDone: {
    color: '#94A3B8',
  },
  researchBadge: {
    backgroundColor: 'rgba(139, 92, 246, 0.12)',
    borderRadius: 5,
    paddingHorizontal: 5,
    paddingVertical: 1.5,
  },
  researchBadgeText: {
    fontFamily: DLFonts.mono,
    fontSize: 9,
    fontWeight: '800',
    color: '#7C3AED',
  },
  tierDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },

  folderFooterBtn: {
    paddingTop: 8,
    paddingBottom: 2,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#F8FAFC',
    marginTop: 4,
  },
  folderFooterText: {
    fontFamily: DLFonts.sans,
    fontSize: 11,
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

  // Loading & Empty States
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
    opacity: 0.82,
    transform: [{ scale: 0.96 }],
  },
  rowPressed: {
    opacity: 0.7,
  },
});
