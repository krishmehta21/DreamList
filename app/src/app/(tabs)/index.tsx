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
  Alert,
  Dimensions,
  Modal,
  Animated,
  PanResponder,
} from 'react-native';
import { Image } from 'expo-image';
import { FlashList } from '@shopify/flash-list';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { getCachedItems, saveCachedItems, reconcileItems, cleanOrphanedTempItems } from '@/lib/database';
import { DL, DLFonts, TIER_COLOR } from '@/constants/design';
import { fetchItems, updateItem, triggerResearch, deleteItem } from '@/lib/api';
import { FilterChip, ItemCard } from '@/components/dreamlist';
import { supabase } from '@/lib/supabase';
import type { WishlistItem, Tier, Category } from '@/lib/types';
import { TIERS } from '@/lib/types';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Sortable from 'react-native-sortables';
import Reanimated, { useAnimatedRef, useAnimatedStyle, withTiming, LinearTransition } from 'react-native-reanimated';

const ReanimatedLayoutTransition = LinearTransition.springify().damping(18).stiffness(120);

// ─── Folder Card ─────────────────────────────────────────────────────────────
type FolderDatum = {
  id: string;
  category: Category;
  items: WishlistItem[];
  indexStr: string;
};

type LayoutSection = 
  | { type: 'wide'; category: Category }
  | { type: 'grid'; left: Category[]; right: Category[] };

import type { DimensionValue, LayoutChangeEvent } from 'react-native';

interface FolderCardProps {
  folder: FolderDatum;
  editMode: boolean;
  size: 'small' | 'medium' | 'wide';
  width: DimensionValue;
  onPressItem: (item: WishlistItem) => void;
  onToggleDone: (id: string, done: boolean) => void;
  onPressCard: () => void;
  onLongPressCard?: () => void;
  onHide: () => void;
  onLayout?: (event: LayoutChangeEvent) => void;
  onSizeChange: (category: Category, size: 'small' | 'medium' | 'wide') => void;
}

const FolderCard = memo(function FolderCard({
  folder, editMode, size, width, onPressItem, onToggleDone, onPressCard, onLongPressCard, onHide, onLayout, onSizeChange,
}: FolderCardProps) {
  const totalCount = folder.items.length;
  const completedCount = folder.items.filter((i) => i.done).length;
  const progress = totalCount > 0 ? completedCount / totalCount : 0;
  const countStr = String(totalCount).padStart(2, '0');
  const isEmpty = totalCount === 0;
  const isCompleted = totalCount > 0 && completedCount === totalCount;

  const animatedStyle = useAnimatedStyle(() => {
    return {
      width: withTiming(`${progress * 100}%`, { duration: 300 }),
    };
  }, [progress]);

  const displayItems = useMemo(() => {
    if (size === 'small') {
      return folder.items.slice(0, 3);
    }
    return folder.items;
  }, [folder.items, size]);

  const remainingCount = totalCount - displayItems.length;

  const renderRightIndicator = useCallback((item: WishlistItem) => {
    if (item.status === 'researching') {
      return (
        <View style={styles.researchingBadge}>
          <Text style={styles.researchingBadgeText}>AI ⚡</Text>
        </View>
      );
    }

    const prices = item.prices;
    const lowestPrice = prices && prices.length > 0
      ? Math.min(...prices.map((p) => Number(p.price)))
      : null;

    if (lowestPrice && lowestPrice > 0) {
      const priceStr = `₹${Math.round(lowestPrice).toLocaleString('en-IN')}`;
      return (
        <Text style={styles.miniPriceText}>{priceStr}</Text>
      );
    }

    const tierLabel = item.tier.toUpperCase();
    return (
      <View style={[styles.miniTierBadge, { borderColor: TIER_COLOR[item.tier] + '35' }]}>
        <Text style={[styles.miniTierBadgeText, { color: TIER_COLOR[item.tier] }]}>{tierLabel}</Text>
      </View>
    );
  }, []);

  const CardContent = (
    <>
      {/* Edit mode: ✕ delete badge + drag handle indicator */}
      {editMode && (
        <>
          <Pressable style={styles.editDeleteBadge} onPress={onHide} hitSlop={8}>
            <Text style={styles.editDeleteBadgeText}>✕</Text>
          </Pressable>
          {/* Drag hint: 6-dot grip at top-right */}
          <View style={styles.dragHandle}>
            <View style={styles.dragHandleDots}>
              {[0,1,2,3,4,5].map((i) => (
                <View key={i} style={styles.dragHandleDot} />
              ))}
            </View>
          </View>
        </>
      )}

      {/* Header */}
      <View style={styles.folderHeader}>
        <View style={styles.folderHeaderLeft}>
          <Text style={styles.folderIndex}>{folder.indexStr}</Text>
          <View style={styles.titleProgressContainer}>
            <Text style={styles.folderTitle} numberOfLines={1}>
              {folder.category.toUpperCase()}
            </Text>
            {!isEmpty && (
              <View style={styles.miniProgressBarTrack}>
                <Reanimated.View style={[styles.miniProgressBarFill, animatedStyle]} />
              </View>
            )}
          </View>
        </View>

        {editMode ? (
          <View style={styles.sizePicker}>
            {(['small', 'medium', 'wide'] as const).map((sz) => (
              <Pressable
                key={sz}
                onPress={() => onSizeChange(folder.category, sz)}
                style={[styles.sizePill, size === sz && styles.sizePillActive]}
              >
                <Text style={[styles.sizePillText, size === sz && styles.sizePillTextActive]}>
                  {sz.charAt(0).toUpperCase()}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : (
          <Text style={[styles.folderCount, isEmpty && { opacity: 0.3 }]}>{countStr}</Text>
        )}
      </View>

      {/* Card Content (checklists) */}
      <View style={styles.cardContent}>
        {isEmpty ? (
          <View style={styles.emptyBadgeRow}>
            <Text style={styles.emptyBadgeText}>EMPTY</Text>
          </View>
        ) : isCompleted ? (
          <View style={styles.completedBadgeRow}>
            <Text style={styles.completedBadgeText}>✓ Everything acquired</Text>
          </View>
        ) : (
          <>
            <View style={styles.folderChecklist}>
              {displayItems.map((item) => (
                <View key={item.id} style={styles.checklistRow}>
                  <Pressable
                    style={styles.miniCheckboxHit}
                    onPress={editMode ? undefined : () => onToggleDone(item.id, !item.done)}
                    hitSlop={4}
                  >
                    <View style={[styles.miniCheckbox, item.done && styles.miniCheckboxDone]}>
                      {item.done && <View style={styles.miniCheckboxTick} />}
                    </View>
                  </Pressable>

                  <Pressable
                    style={styles.miniNameHit}
                    onPress={editMode ? undefined : () => onPressItem(item)}
                  >
                    <Text
                      style={[styles.miniListName, item.done && styles.miniListNameDone]}
                      numberOfLines={1}
                      ellipsizeMode="tail"
                    >
                      {item.name}
                    </Text>
                  </Pressable>

                  {renderRightIndicator(item)}
                </View>
              ))}
            </View>

            {remainingCount > 0 && (
              <View style={styles.remainingRow}>
                <Text style={styles.remainingText}>+ {remainingCount} remaining</Text>
              </View>
            )}
          </>
        )}
      </View>
    </>
  );

  if (editMode) {
    return (
      <View
        style={{ width: '100%' }}
        onLayout={onLayout}
      >
        {CardContent}
      </View>
    );
  }

  return (
    <Pressable
      style={[
        styles.folderCard,
        isEmpty && styles.folderCardEmpty,
        { width }
      ]}
      onPress={onPressCard}
      onLongPress={onLongPressCard}
      delayLongPress={300}
      onLayout={onLayout}
    >
      {CardContent}
    </Pressable>
  );
});

export default function DashboardScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const hasLoadedOnce = useRef(false);
  const scrollableRef = useAnimatedRef<ScrollView>();

  const numSegments = useMemo(() => {
    const screenWidth = Dimensions.get('window').width;
    const containerWidth = screenWidth - 40;
    return Math.floor((containerWidth - 3) / 9);
  }, []);

  const columns = useMemo(() => {
    const screenWidth = Dimensions.get('window').width;
    return screenWidth > 768 ? 4 : (screenWidth > 480 ? 3 : 2);
  }, []);

  const cardWidth = useMemo(() => {
    const screenWidth = Dimensions.get('window').width;
    const gap = 8;
    const horizontalPadding = 12;
    return Math.floor((screenWidth - (horizontalPadding * 2) - (gap * (columns - 1))) / columns);
  }, [columns]);

  const wideCardWidth = useMemo(() => {
    const screenWidth = Dimensions.get('window').width;
    const horizontalPadding = 12;
    return screenWidth - (horizontalPadding * 2);
  }, []);

  const DEFAULT_CATEGORY_ORDER: Category[] = ['Tech', 'Home', 'Apparel', 'Books', 'Fitness', 'Other'];

  const [items, setItems] = useState<WishlistItem[]>(() => getCachedItems());
  const [tierFilter, setTierFilter] = useState<Tier | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(() => getCachedItems().length === 0);
  const [editMode, setEditMode] = useState(false);
  const [categoryOrder, setCategoryOrder] = useState<Category[]>(DEFAULT_CATEGORY_ORDER);
  const [hiddenCategories, setHiddenCategories] = useState<Set<Category>>(new Set());

  // Card size preferences: small, medium, wide
  const [cardSizes, setCardSizes] = useState<Record<Category, 'small' | 'medium' | 'wide'>>({
    Tech: 'wide',
    Home: 'wide',
    Apparel: 'wide',
    Books: 'wide',
    Fitness: 'wide',
    Other: 'wide',
  });
  // Actual measured heights via onLayout
  const [cardHeights, setCardHeights] = useState<Record<Category, number>>({} as any);
  // Column assignment cache for layout stability
  const [columnLayout, setColumnLayout] = useState<Record<string, { left: Category[]; right: Category[] }>>({});

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

  // Load persisted layout and card sizes from AsyncStorage
  useEffect(() => {
    AsyncStorage.getItem('dl_category_order').then((val) => {
      if (val) {
        try {
          const parsed: Category[] = JSON.parse(val);
          // Keep all parsed categories (including custom ones), then append missing defaults
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
        try { setHiddenCategories(new Set(JSON.parse(val))); } catch {}
      }
    });
    AsyncStorage.getItem('dl_card_sizes').then((val) => {
      if (val) {
        try { setCardSizes(JSON.parse(val)); } catch {}
      }
    });
  }, []);

  // Sync category order to include any categories from loaded items (e.g. custom categories)
  useEffect(() => {
    if (items.length === 0) return;
    const uniqueCategories = Array.from(new Set(items.map((i) => i.category || 'Other')));
    const missing = uniqueCategories.filter((c) => !categoryOrder.includes(c));
    if (missing.length > 0) {
      setCategoryOrder((prev) => {
        const next = [...prev, ...missing];
        AsyncStorage.setItem('dl_category_order', JSON.stringify(next));
        return next;
      });
    }
  }, [items, categoryOrder]);

  const saveCategoryOrder = useCallback(async (order: Category[]) => {
    setCategoryOrder(order);
    await AsyncStorage.setItem('dl_category_order', JSON.stringify(order));
  }, []);

  const saveCardSizes = useCallback(async (sizes: Record<Category, 'small' | 'medium' | 'wide'>) => {
    setCardSizes(sizes);
    await AsyncStorage.setItem('dl_card_sizes', JSON.stringify(sizes));
  }, []);

  const handleSizeChange = useCallback((cat: Category, size: 'small' | 'medium' | 'wide') => {
    saveCardSizes({ ...cardSizes, [cat]: size });
  }, [cardSizes, saveCardSizes]);

  // Height estimation helper for initial layout before onLayout measures
  const getEstimatedHeight = useCallback((cat: Category) => {
    const catItems = items.filter((item) => (item.category || 'Other') === cat);
    const size = cardSizes[cat] || 'medium';
    let showCount = catItems.length;
    if (size === 'small') {
      showCount = Math.min(3, catItems.length);
    }
    const baseHeight = 50 + 14; // header index/title + title spacing
    const rowHeight = 34; // item text + line height + 12px vertical spacing
    const padding = 36; // 18px top and bottom internal padding
    const bottomHeight = catItems.length === 0 ? 30 : (size === 'small' && catItems.length > 3 ? 24 : 10);
    return baseHeight + (showCount * rowHeight) + padding + bottomHeight;
  }, [items, cardSizes]);

  // Height measurement update reported by FolderCard
  const handleCardHeightChange = useCallback((category: Category, height: number) => {
    setCardHeights((prev) => {
      if (Math.abs((prev[category] || 0) - height) < 2) return prev;
      return { ...prev, [category]: height };
    });
  }, []);

  // Compute layout blocks (Wide categories vs Balanced standard grid blocks)
  const layoutSections = useMemo(() => {
    const sections: LayoutSection[] = [];
    let currentGridBlock: Category[] = [];
    let blockIndex = 0;

    const pushGridBlock = (cats: Category[]) => {
      const blockKey = `block-${blockIndex}-${cats.join('-')}`;
      blockIndex++;

      // Greedy balancer to divide cards into left and right columns
      const balanceGreedy = () => {
        let left: Category[] = [];
        let right: Category[] = [];
        let leftH = 0;
        let rightH = 0;

        cats.forEach((cat) => {
          const h = cardHeights[cat] || getEstimatedHeight(cat);
          if (leftH <= rightH) {
            left.push(cat);
            leftH += h;
          } else {
            right.push(cat);
            rightH += h;
          }
        });
        return { left, right, leftH, rightH };
      };

      const proposed = balanceGreedy();

      // Retrieve cached layout for stability hysteresis
      const prev = columnLayout[blockKey];
      if (prev) {
        let prevLeftH = 0;
        let prevRightH = 0;
        prev.left.forEach((cat) => { prevLeftH += (cardHeights[cat] || getEstimatedHeight(cat)); });
        prev.right.forEach((cat) => { prevRightH += (cardHeights[cat] || getEstimatedHeight(cat)); });

        const prevDiff = Math.abs(prevLeftH - prevRightH);
        const proposedDiff = Math.abs(proposed.leftH - proposed.rightH);

        // Hysteresis: only rebalance columns if imbalance is reduced by more than 80px
        if (proposedDiff < prevDiff - 80) {
          sections.push({ type: 'grid', left: proposed.left, right: proposed.right });
        } else {
          sections.push({ type: 'grid', left: prev.left, right: prev.right });
        }
      } else {
        sections.push({ type: 'grid', left: proposed.left, right: proposed.right });
      }
    };

    categoryOrder.forEach((cat) => {
      if (hiddenCategories.has(cat)) return;
      const isWide = cardSizes[cat] === 'wide';
      if (isWide) {
        if (currentGridBlock.length > 0) {
          pushGridBlock(currentGridBlock);
          currentGridBlock = [];
        }
        sections.push({ type: 'wide', category: cat });
      } else {
        currentGridBlock.push(cat);
      }
    });

    if (currentGridBlock.length > 0) {
      pushGridBlock(currentGridBlock);
    }

    return sections;
  }, [categoryOrder, hiddenCategories, cardSizes, cardHeights, getEstimatedHeight, columnLayout]);

  // Sync computed layouts to columnLayout to persist column stability assignments
  useEffect(() => {
    let blockIndex = 0;
    const newLayout: Record<string, { left: Category[]; right: Category[] }> = {};
    let changed = false;

    layoutSections.forEach((sec) => {
      if (sec.type === 'grid') {
        const cats = [...sec.left, ...sec.right].sort();
        const blockKey = `block-${blockIndex}-${cats.join('-')}`;
        blockIndex++;

        const current = columnLayout[blockKey];
        if (!current || JSON.stringify(current.left) !== JSON.stringify(sec.left)) {
          newLayout[blockKey] = { left: sec.left, right: sec.right };
          changed = true;
        } else {
          newLayout[blockKey] = current;
        }
      }
    });

    if (changed) {
      setColumnLayout((prev) => ({ ...prev, ...newLayout }));
    }
  }, [layoutSections, columnLayout]);

  const saveHiddenCategories = useCallback(async (hidden: Set<Category>) => {
    setHiddenCategories(hidden);
    await AsyncStorage.setItem('dl_hidden_categories', JSON.stringify([...hidden]));
  }, []);

  const handleHideCategory = useCallback((cat: Category) => {
    showCustomAlert(
      `Hide ${cat}?`,
      'This folder will be hidden from the dashboard. You can restore it from Settings.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Hide',
          style: 'destructive',
          onPress: () => {
            const newHidden = new Set(hiddenCategories);
            newHidden.add(cat);
            saveHiddenCategories(newHidden);
          },
        },
      ]
    );
  }, [hiddenCategories, saveHiddenCategories, showCustomAlert]);

  const handleMoveCategory = useCallback((_cat: Category, _dir: 'left' | 'right') => {
    // No-op: reordering is now done via DraggableFlatList drag-and-drop
  }, []);

  // Load ALL items from server — filter is done client-side
  const loadItems = useCallback(async (silent = false) => {
    if (!silent && !hasLoadedOnce.current) {
      setLoading(true);
    }
    try {
      const data = await fetchItems(); // always fetch all, no tier filter
      setItems((prev) => {
        const reconciled = reconcileItems(prev, data);
        saveCachedItems(reconciled);
        return reconciled;
      });
    } catch (err) {
      console.error('Fetch items failed:', err);
    } finally {
      setLoading(false);
    }
  }, []); // no tierFilter dep — prevents re-fetch on chip tap

  // Load preferences from AsyncStorage and fetch list on focus
  useFocusEffect(
    useCallback(() => {
      // 0. Clean any orphaned temporary optimistic items from cache
      cleanOrphanedTempItems();
      
      // 1. Instantly load from SQLite cache to capture any updates
      const cached = getCachedItems();
      if (cached.length > 0) {
        setItems(cached);
      }
      
      // 2. Parallel background fetch
      loadItems(cached.length > 0).finally(() => {
        hasLoadedOnce.current = true;
      });
    }, [loadItems])
  );

  // Realtime subscription setup
  useEffect(() => {
    const channel = supabase
      .channel('dashboard-realtime')
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

  const handleToggleDone = useCallback(
    async (id: string, done: boolean) => {
      let previousItems: WishlistItem[] = [];
      
      // 1. Optimistic Update locally
      setItems((prev) => {
        previousItems = prev;
        const updated = prev.map((item) =>
          item.id === id ? { ...item, done } : item
        );
        saveCachedItems(updated);
        return updated;
      });
      
      // 2. Sync to remote server
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
        // Rollback
        setItems(() => {
          saveCachedItems(previousItems);
          return previousItems;
        });
        showCustomAlert('Sync Failed', 'Failed to update item status. Rolled back.');
      }
    },
    [showCustomAlert, router]
  );

  const handleRetryResearch = useCallback(
    async (id: string) => {
      let previousItems: WishlistItem[] = [];
      
      // 1. Optimistic Update locally
      setItems((prev) => {
        previousItems = prev;
        const updated = prev.map((item) =>
          item.id === id ? { ...item, status: 'pending' as const } : item
        );
        saveCachedItems(updated);
        return updated;
      });
      
      // 2. Sync to remote server
      try {
        await triggerResearch(id);
      } catch {
        // Rollback
        setItems(() => {
          saveCachedItems(previousItems);
          return previousItems;
        });
        showCustomAlert('Sync Failed', 'Failed to trigger research retry. Rolled back.');
      }
    },
    [showCustomAlert]
  );

  const handlePressCard = useCallback((item: WishlistItem) => {
    router.push(`/items/${item.id}`);
  }, [router]);

  const handleDeleteItem = useCallback(async (id: string) => {
    let previousItems: WishlistItem[] = [];
    // Optimistic remove
    setItems((prev) => {
      previousItems = prev;
      const updated = prev.filter((i) => i.id !== id);
      saveCachedItems(updated);
      return updated;
    });
    try {
      await deleteItem(id);
    } catch {
      // Rollback
      setItems(() => {
        saveCachedItems(previousItems);
        return previousItems;
      });
      showCustomAlert('Error', 'Could not delete item. Please try again.');
    }
  }, [showCustomAlert]);

  // Client-side tier filter — instant, no network call
  const filteredItems = useMemo(
    () => (tierFilter ? items.filter((i) => i.tier === tierFilter) : items),
    [items, tierFilter]
  );



  // Group wishlist items by categories for Nothing OS Folders
  const folderData = useMemo(() => {
    const grouped: Record<string, WishlistItem[]> = {};
    
    // Sort items by created_at DESC
    const sortedItems = [...filteredItems].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    for (const item of sortedItems) {
      const cat = item.category || 'Other';
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(item);
    }

    // Use persisted order, filter out hidden categories
    const visibleOrder = categoryOrder.filter((cat) => !hiddenCategories.has(cat));
    return visibleOrder.map((cat, index) => ({
      id: cat,
      category: cat,
      items: grouped[cat] || [],
      indexStr: String(index + 1).padStart(2, '0'),
    }));
  }, [filteredItems, categoryOrder, hiddenCategories]);

  // Stats use ALL items (not filtered), so totals are always accurate
  const totalCount = items.length;
  const doneCount = items.filter((i) => i.done).length;
  const progressPercent = totalCount > 0 ? (doneCount / totalCount) * 100 : 0;

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 16 }]}>
      {/* Header Info */}
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>DREAMLIST</Text>
          <Text style={styles.title}>Dashboard</Text>
        </View>
        {totalCount > 0 && (
          <View style={styles.headerBadge}>
            <Text style={styles.headerBadgeText}>
              {doneCount}/{totalCount} ACQUIRED
            </Text>
          </View>
        )}
      </View>

      {/* Progress Bar Header (Segmented/dashed blocks) */}
      {totalCount > 0 && (
        <View style={styles.progressContainer}>
          <View style={styles.segmentedProgressBar}>
            {Array.from({ length: numSegments }).map((_, i) => {
              const threshold = (i / numSegments) * 100;
              const isFilled = progressPercent > threshold;
              return (
                <View
                  key={i}
                  style={[
                    styles.progressSegment,
                    {
                      backgroundColor: isFilled ? DL.soon : DL.border,
                    },
                  ]}
                />
              );
            })}
          </View>
        </View>
      )}

      {/* Filter chips + Edit toggle */}
      <View style={styles.chipWrapper}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}
          style={styles.chipScroll}
        >
          <FilterChip
            label="All"
            active={tierFilter === null}
            color={DL.text}
            onPress={() => setTierFilter(null)}
          />
          {TIERS.map((t) => (
            <FilterChip
              key={t}
              label={t.charAt(0).toUpperCase() + t.slice(1)}
              active={tierFilter === t}
              color={TIER_COLOR[t]}
              onPress={() => setTierFilter(tierFilter === t ? null : t)}
            />
          ))}
        </ScrollView>
        <Pressable
          style={[styles.editToggleBtn, editMode && styles.editToggleBtnActive]}
          onPress={() => setEditMode((v) => !v)}
        >
          <Text style={[styles.editToggleBtnText, editMode && styles.editToggleBtnTextActive]}>
            {editMode ? 'DONE' : 'EDIT'}
          </Text>
        </Pressable>
      </View>

      {/* Content Area */}
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={DL.muted} size="large" />
        </View>
      ) : items.length === 0 ? (
        <View style={styles.centered}>
          <View style={styles.emptyCard}>
            <Text style={styles.emptyIcon}>✨</Text>
            <Text style={styles.emptyTitle}>Curate Your Wants</Text>
            <Text style={styles.emptyText}>
              No items matching your criteria yet. Add items and let AI research prices, specs, and details!
            </Text>
            <Pressable
              onPress={() => router.push('/add')}
              style={({ pressed }) => [
                styles.emptyButton,
                pressed && { opacity: 0.8 },
              ]}
            >
              <Text style={styles.emptyButtonText}>Add Your First Item</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <ScrollView
          ref={scrollableRef}
          style={styles.scrollArea}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: insets.bottom + 80 },
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
          {editMode ? (
            <Sortable.Flex
              scrollableRef={scrollableRef}
              flexDirection="row"
              flexWrap="wrap"
              gap={8}
              onDragEnd={({ order }) => {
                const visibleCats = folderData.map((f) => f.category);
                const sortedVisible = order(visibleCats);
                const completeOrder = [
                  ...sortedVisible,
                  ...categoryOrder.filter((c) => !visibleCats.includes(c)),
                ];
                saveCategoryOrder(completeOrder);
              }}
              dragActivationDelay={150}
              activeItemScale={1.04}
              activeItemOpacity={0.9}
              activeItemShadowOpacity={0.25}
              inactiveItemScale={0.98}
              inactiveItemOpacity={0.7}
              hapticsEnabled={true}
            >
              {folderData.map((folder) => {
                const size = cardSizes[folder.category] || 'medium';
                const isWide = size === 'wide';
                const itemWidth = isWide ? wideCardWidth : cardWidth;

                return (
                  <Sortable.Touchable
                    key={folder.category}
                    style={[
                      styles.folderCard,
                      folder.items.length === 0 && styles.folderCardEmpty,
                      { width: itemWidth }
                    ]}
                  >
                    <FolderCard
                      folder={folder}
                      editMode={true}
                      size={size}
                      width="100%"
                      onPressItem={(i: WishlistItem) => handlePressCard(i)}
                      onToggleDone={handleToggleDone}
                      onPressCard={() => {}}
                      onHide={() => handleHideCategory(folder.category)}
                      onSizeChange={handleSizeChange}
                    />
                  </Sortable.Touchable>
                );
              })}
            </Sortable.Flex>
          ) : (
            <Reanimated.View layout={ReanimatedLayoutTransition}>
              {layoutSections.map((sec, secIdx) => {
                if (sec.type === 'wide') {
                  const folder = folderData.find((f) => f.category === sec.category);
                  if (!folder) return null;
                  return (
                    <Reanimated.View 
                      key={sec.category} 
                      layout={ReanimatedLayoutTransition}
                      style={{ marginBottom: 12 }}
                    >
                      <FolderCard
                        folder={folder}
                        editMode={false}
                        size="wide"
                        width="100%"
                        onPressItem={(i: WishlistItem) => handlePressCard(i)}
                        onToggleDone={handleToggleDone}
                        onPressCard={() => router.push(`/category/${folder.category}` as any)}
                        onLongPressCard={() => setEditMode(true)}
                        onHide={() => {}}
                        onLayout={(e) => handleCardHeightChange(folder.category, e.nativeEvent.layout.height)}
                        onSizeChange={handleSizeChange}
                      />
                    </Reanimated.View>
                  );
                } else {
                  return (
                    <Reanimated.View 
                      key={`grid-${secIdx}`} 
                      layout={ReanimatedLayoutTransition}
                      style={styles.gridSectionRow}
                    >
                      <View style={[styles.masonryColumn, { width: cardWidth }]}>
                        {sec.left.map((cat) => {
                          const folder = folderData.find((f) => f.category === cat);
                          if (!folder) return null;
                          return (
                            <Reanimated.View 
                              key={cat} 
                              layout={ReanimatedLayoutTransition}
                              style={{ width: '100%', marginBottom: 12 }}
                            >
                              <FolderCard
                                folder={folder}
                                editMode={false}
                                size={cardSizes[cat] || 'medium'}
                                width="100%"
                                onPressItem={(i: WishlistItem) => handlePressCard(i)}
                                onToggleDone={handleToggleDone}
                                onPressCard={() => router.push(`/category/${folder.category}` as any)}
                                onLongPressCard={() => setEditMode(true)}
                                onHide={() => {}}
                                onLayout={(e) => handleCardHeightChange(folder.category, e.nativeEvent.layout.height)}
                                onSizeChange={handleSizeChange}
                              />
                            </Reanimated.View>
                          );
                        })}
                      </View>
                      <View style={[styles.masonryColumn, { width: cardWidth }]}>
                        {sec.right.map((cat) => {
                          const folder = folderData.find((f) => f.category === cat);
                          if (!folder) return null;
                          return (
                            <Reanimated.View 
                              key={cat} 
                              layout={ReanimatedLayoutTransition}
                              style={{ width: '100%', marginBottom: 12 }}
                            >
                              <FolderCard
                                folder={folder}
                                editMode={false}
                                size={cardSizes[cat] || 'medium'}
                                width="100%"
                                onPressItem={(i: WishlistItem) => handlePressCard(i)}
                                onToggleDone={handleToggleDone}
                                onPressCard={() => router.push(`/category/${folder.category}` as any)}
                                onLongPressCard={() => setEditMode(true)}
                                onHide={() => {}}
                                onLayout={(e) => handleCardHeightChange(folder.category, e.nativeEvent.layout.height)}
                                onSizeChange={handleSizeChange}
                              />
                            </Reanimated.View>
                          );
                        })}
                      </View>
                    </Reanimated.View>
                  );
                }
              })}
            </Reanimated.View>
          )}
        </ScrollView>
      )}

      {/* Floating Action Button (FAB) to Add Wishlist Item */}
      {!editMode && (
        <Pressable
          style={({ pressed }) => [
            styles.fab,
            pressed && { opacity: 0.9, transform: [{ scale: 0.95 }] }
          ]}
          onPress={() => router.push('/add')}
        >
          <Text style={styles.fabText}>+</Text>
        </Pressable>
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
    alignItems: 'flex-end',
    marginBottom: 8,
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
  headerBadge: {
    borderColor: '#242830',
    borderWidth: 1.2,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  headerBadgeText: {
    fontSize: 9.5,
    fontFamily: DLFonts.mono,
    color: DL.text,
    fontWeight: '700',
    letterSpacing: 2,
    textShadowColor: 'rgba(231, 233, 238, 0.3)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 3,
  },
  progressContainer: {
    paddingHorizontal: 20,
    marginBottom: 10,
    marginTop: 6,
  },
  segmentedProgressBar: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    gap: 3,
    height: 4,
    width: '100%',
  },
  progressSegment: {
    width: 6,
    height: 4,
    borderRadius: 1,
  },
  chipWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    paddingRight: 12,
  },
  chipScroll: {
    flex: 1,
  },
  chipRow: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    gap: 6,
  },
  editToggleBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#2A2F38',
    backgroundColor: 'transparent',
  },
  editToggleBtnActive: {
    backgroundColor: 'rgba(255, 51, 51, 0.12)',
    borderColor: 'rgba(255, 51, 51, 0.4)',
  },
  editToggleBtnText: {
    fontFamily: DLFonts.mono,
    fontSize: 10,
    fontWeight: '700',
    color: '#5A6070',
    letterSpacing: 0.5,
  },
  editToggleBtnTextActive: {
    color: '#FF3333',
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 10,
    paddingHorizontal: 12,
  },
  draggableContainer: {
    paddingHorizontal: 14,
  },
  folderCard: {
    backgroundColor: DL.card,
    borderColor: DL.border,
    borderWidth: 1.2,
    borderRadius: 24,
    paddingVertical: 18,
    paddingHorizontal: 12,
    overflow: 'hidden',
  },
  folderCardEmpty: {
    minHeight: 100,
  },
  folderCardDragging: {
    opacity: 0.8,
    transform: [{ scale: 1.03 }],
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 5,
    borderColor: DL.soon,
  },
  editDeleteBadge: {
    position: 'absolute',
    top: -8,
    left: -8,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#CC2222',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
    borderWidth: 2,
    borderColor: DL.bg,
  },
  editDeleteBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
    lineHeight: 12,
  },
  dragHandle: {
    position: 'absolute',
    top: 8,
    right: 8,
    padding: 4,
    zIndex: 10,
  },
  dragHandleDots: {
    width: 10,
    height: 14,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignContent: 'space-between',
    gap: 2,
  },
  dragHandleDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: '#5A6070',
  },
  folderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  folderHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  titleProgressContainer: {
    flexDirection: 'column',
    flex: 1,
  },
  folderIndex: {
    fontFamily: DLFonts.mono,
    fontSize: 11,
    color: '#FF3333',
    fontWeight: '700',
    marginRight: 2,
  },
  folderTitle: {
    fontFamily: DLFonts.mono,
    fontSize: 11,
    fontWeight: '700',
    color: DL.text,
    letterSpacing: 1.2,
  },
  folderCount: {
    fontFamily: DLFonts.mono,
    fontSize: 11,
    color: DL.muted,
    letterSpacing: 0.5,
  },
  miniProgressBarTrack: {
    height: 2,
    backgroundColor: '#1E222A',
    borderRadius: 1,
    marginTop: 5,
    width: '80%',
    maxWidth: 120,
    overflow: 'hidden',
  },
  miniProgressBarFill: {
    height: '100%',
    backgroundColor: DL.soon,
  },
  sizePicker: {
    flexDirection: 'row',
    gap: 4,
    alignItems: 'center',
  },
  sizePill: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#2A2F38',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  sizePillActive: {
    backgroundColor: DL.soon,
    borderColor: DL.soon,
  },
  sizePillText: {
    fontSize: 9,
    fontFamily: DLFonts.mono,
    color: DL.muted,
    fontWeight: 'bold',
  },
  sizePillTextActive: {
    color: '#0B0D10',
  },
  cardContent: {
    flexDirection: 'column',
  },
  folderChecklist: {
    flexDirection: 'column',
  },
  checklistRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
  },
  miniCheckboxHit: {
    marginRight: 6,
  },
  miniCheckbox: {
    width: 14,
    height: 14,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: '#404550',
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  miniCheckboxDone: {
    backgroundColor: DL.soon,
    borderColor: DL.soon,
  },
  miniCheckboxTick: {
    width: 6,
    height: 6,
    borderRadius: 1.5,
    backgroundColor: '#0B0D10',
  },
  miniNameHit: {
    flex: 1,
  },
  miniListName: {
    fontFamily: DLFonts.sans,
    fontSize: 15,
    color: DL.text,
    letterSpacing: 0.1,
    lineHeight: 22,
    flexShrink: 1,
  },
  miniListNameDone: {
    opacity: 0.35,
    textDecorationLine: 'line-through',
  },
  researchingBadge: {
    backgroundColor: 'rgba(168, 85, 247, 0.12)',
    borderColor: 'rgba(168, 85, 247, 0.3)',
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    marginLeft: 4,
  },
  researchingBadgeText: {
    fontFamily: DLFonts.mono,
    fontSize: 9,
    color: '#A855F7',
    fontWeight: 'bold',
  },
  miniPriceText: {
    fontFamily: DLFonts.mono,
    fontSize: 12,
    color: DL.text,
    marginLeft: 4,
    fontWeight: '600',
  },
  miniTierBadge: {
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
    marginLeft: 4,
  },
  miniTierBadgeText: {
    fontFamily: DLFonts.mono,
    fontSize: 8,
    fontWeight: 'bold',
  },
  remainingRow: {
    marginTop: 8,
    alignItems: 'flex-start',
  },
  remainingText: {
    fontFamily: DLFonts.mono,
    fontSize: 9,
    color: DL.muted,
    letterSpacing: 0.5,
  },
  completedBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(74, 222, 128, 0.08)',
    borderColor: 'rgba(74, 222, 128, 0.2)',
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    alignSelf: 'flex-start',
    marginTop: 2,
  },
  completedBadgeText: {
    fontFamily: DLFonts.mono,
    fontSize: 9,
    fontWeight: '700',
    color: '#4ADE80',
    letterSpacing: 0.5,
  },
  emptyBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(90, 96, 112, 0.08)',
    borderColor: 'rgba(90, 96, 112, 0.15)',
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    alignSelf: 'flex-start',
    marginTop: 2,
  },
  emptyBadgeText: {
    fontFamily: DLFonts.mono,
    fontSize: 9,
    fontWeight: '700',
    color: '#5A6070',
    letterSpacing: 0.5,
  },
  gridSectionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  masonryColumn: {
    flexDirection: 'column',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 30,
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
    color: '#000000',
    fontSize: 13,
    fontWeight: 'bold',
    fontFamily: DLFonts.sans,
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
  // Floating Action Button (FAB)
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: DL.text,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 6,
    zIndex: 99,
  },
  fabText: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#000000',
    lineHeight: 34,
  },
});
