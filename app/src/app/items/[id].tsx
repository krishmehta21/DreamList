import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Linking,
  Alert,
  ActivityIndicator,
  TextInput,
  InteractionManager,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import * as ImagePicker from 'expo-image-picker';
import { DL, DLFonts, TIER_COLOR } from '@/constants/design';
import {
  fetchItem,
  updateItem,
  deleteItem,
  triggerResearch,
  addManualPrice,
  uploadAttachment,
  deleteAttachmentRecord,
} from '@/lib/api';
import { TierBadge, SkeletonBlock, PulsingGlyph } from '@/components/dreamlist';
import { supabase } from '@/lib/supabase';
import type { WishlistItem, WishlistItemDetail, Tier, ItemPrice, ItemAttachment } from '@/lib/types';
import { TIERS } from '@/lib/types';
import { getCachedItems, updateCachedItem, deleteCachedItem, cleanOrphanedTempItems } from '@/lib/database';

const SOURCE_ICONS: Record<string, string> = {
  amazon: '📦 AMAZON',
  flipkart: '🛒 FLIPKART',
  official: '🌐 OFFICIAL',
  manual: '👤 ADDED BY YOU',
  other: '🏷️ OTHER',
};

function getAffiliateUrl(source: string, originalUrl: string): string {
  if (!originalUrl) return '';
  const hasQuery = originalUrl.includes('?');
  const separator = hasQuery ? '&' : '?';
  
  if (source === 'amazon') {
    // SWAP: Replace 'dreamlist-21' with your active Amazon associate tag ID
    if (!originalUrl.includes('tag=')) {
      return `${originalUrl}${separator}tag=dreamlist-21`;
    }
  } else if (source === 'flipkart') {
    // SWAP: Replace 'dreamlist_aff' with your Flipkart affiliate account ID
    if (!originalUrl.includes('affid=')) {
      return `${originalUrl}${separator}affid=dreamlist_aff`;
    }
  }
  return originalUrl;
}

import React, { useState, useEffect, useCallback, useMemo } from 'react';

export default function ItemDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [item, setItem] = useState<WishlistItemDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Manual entry states
  const [addingPrice, setAddingPrice] = useState(false);
  const [manualPrice, setManualPrice] = useState('');
  const [manualUrl, setManualUrl] = useState('');
  const [submittingPrice, setSubmittingPrice] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  // Inline edit states
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editCustomCategory, setEditCustomCategory] = useState('');
  const [isCustomCategory, setIsCustomCategory] = useState(false);
  const [editNotes, setEditNotes] = useState('');
  const [editLink, setEditLink] = useState('');
  const [editTier, setEditTier] = useState<Tier>('soon');
  const [savingEdit, setSavingEdit] = useState(false);

  // Load categories dynamically for the pill selector
  const availableCategories = useMemo(() => {
    try {
      const cached = getCachedItems();
      const custom = Array.from(new Set(cached.map((i) => i.category || 'Other')));
      const defaultCategories = ['Tech', 'Home', 'Apparel', 'Books', 'Fitness', 'Other'];
      return Array.from(new Set([...defaultCategories, ...custom])).filter(Boolean);
    } catch {
      return ['Tech', 'Home', 'Apparel', 'Books', 'Fitness', 'Other'];
    }
  }, [item]);

  // Check if price comparison is stale (last checked >= 14 days ago)
  const isStale = useMemo(() => {
    if (!item || !item.research || item.research.length === 0) return false;
    const researchRow = item.research[0];
    if (!researchRow.researched_at) return false;
    try {
      const researchDate = new Date(researchRow.researched_at);
      const now = new Date();
      const diffTime = Math.abs(now.getTime() - researchDate.getTime());
      const diffDays = diffTime / (1000 * 60 * 60 * 24);
      return diffDays >= 14;
    } catch {
      return false;
    }
  }, [item]);

  // Calculate exact days since last research
  const daysSinceResearch = useMemo(() => {
    if (!item || !item.research || item.research.length === 0) return 0;
    const researchRow = item.research[0];
    if (!researchRow.researched_at) return 0;
    try {
      const researchDate = new Date(researchRow.researched_at);
      const now = new Date();
      const diffTime = Math.abs(now.getTime() - researchDate.getTime());
      return Math.floor(diffTime / (1000 * 60 * 60 * 24));
    } catch {
      return 0;
    }
  }, [item]);

  const toggleEditMode = () => {
    if (!item) return;
    if (!isEditing) {
      setEditName(item.name);
      setEditNotes(item.manual_notes || '');
      setEditLink(item.manual_link || '');
      setEditTier(item.tier);
      
      const defaultCategories = ['Tech', 'Home', 'Apparel', 'Books', 'Fitness', 'Other'];
      if (defaultCategories.includes(item.category)) {
        setEditCategory(item.category);
        setIsCustomCategory(false);
      } else {
        setEditCategory('');
        setEditCustomCategory(item.category);
        setIsCustomCategory(true);
      }
    }
    setIsEditing(!isEditing);
  };

  const cancelEdit = () => {
    setIsEditing(false);
  };

  const saveEdit = async () => {
    if (!id || !item) return;
    const nameTrimmed = editName.trim();
    if (!nameTrimmed) {
      Alert.alert('Error', 'Item name is required.');
      return;
    }

    let finalCategory = editCategory;
    if (isCustomCategory) {
      const customTrimmed = editCustomCategory.trim();
      if (!customTrimmed) {
        Alert.alert('Error', 'Custom category name is required.');
        return;
      }
      finalCategory = customTrimmed;
    }

    setSavingEdit(true);
    const previousItem = { ...item };
    const updatedFields = {
      name: nameTrimmed,
      category: finalCategory,
      tier: editTier,
      manual_notes: editNotes.trim() || null,
      manual_link: editLink.trim() || null,
    };

    // Optimistic Update
    setItem((prev) => (prev ? { ...prev, ...updatedFields } : null));
    updateCachedItem({ ...item, ...updatedFields } as WishlistItem);

    try {
      const updated = await updateItem(id, updatedFields);
      setItem((prev) => (prev ? { ...prev, ...updated } : prev));
      updateCachedItem({ ...item, ...updated } as WishlistItem);
      setIsEditing(false);
    } catch (e: any) {
      setItem(previousItem);
      updateCachedItem(previousItem as WishlistItem);
      Alert.alert('Error', e.message || 'Failed to update item details. Rolled back.');
    } finally {
      setSavingEdit(false);
    }
  };

  const load = useCallback(async () => {
    if (!id) return;
    setFetchError(null);
    try {
      const data = await fetchItem(id);
      setItem(data);
      updateCachedItem(data);
    } catch (err: any) {
      const cached = getCachedItems();
      const match = cached.find((i) => i.id === id);
      if (match) {
        setItem(match as WishlistItemDetail);
      } else {
        setFetchError(err.message || 'Failed to fetch details');
      }
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (!id) return;

    // Load from cache immediately on mount
    const cached = getCachedItems();
    const match = cached.find((i) => i.id === id);
    if (match) {
      setItem(match as WishlistItemDetail);
      setLoading(false);
    }

    let channel: any;
    const task = InteractionManager.runAfterInteractions(() => {
      load();

      channel = supabase
        .channel(`item-detail-${id}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'wishlist_items',
            filter: `id=eq.${id}`,
          },
          () => {
            load();
          }
        )
        .subscribe();
    });

    return () => {
      task.cancel();
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [id, load]);

  // Clean orphaned temporary items on load
  useEffect(() => {
    if (!id) return;
    cleanOrphanedTempItems();
  }, [id]);

  // Poll item status every 10 seconds if it is pending or researching
  useEffect(() => {
    if (!id || !item) return;
    const isResearching = item.status === 'pending' || item.status === 'researching';
    if (!isResearching) return;

    const interval = setInterval(() => {
      console.log('Polling item status for stuck check...');
      load();
    }, 10000); // 10 seconds

    return () => clearInterval(interval);
  }, [id, item?.status, load]);

  const handleTierChange = async (newTier: Tier) => {
    if (!id || !item || newTier === item.tier) return;
    const previousItem = { ...item };
    const updatedFields = { tier: newTier };
    
    // 1. Optimistic Update locally
    setItem((prev) => (prev ? { ...prev, ...updatedFields } : null));
    updateCachedItem({ ...item, ...updatedFields });
    
    try {
      const updated = await updateItem(id, updatedFields);
      setItem((prev) => (prev ? { ...prev, ...updated } : prev));
      updateCachedItem({ ...item, ...updated });
    } catch {
      // Rollback
      setItem(previousItem);
      updateCachedItem(previousItem);
      Alert.alert('Sync Failed', 'Failed to update item tier. Rolled back.');
    }
  };

  const handleToggleDone = async () => {
    if (!id || !item) return;
    const previousItem = { ...item };
    const nextDone = !item.done;
    
    // 1. Optimistic Update locally
    setItem((prev) => (prev ? { ...prev, done: nextDone } : null));
    updateCachedItem({ ...item, done: nextDone });
    
    try {
      const updated = await updateItem(id, { done: nextDone });
      setItem((prev) => (prev ? { ...prev, ...updated } : prev));
      updateCachedItem({ ...item, ...updated });
    } catch {
      // Rollback
      setItem(previousItem);
      updateCachedItem(previousItem);
      Alert.alert('Sync Failed', 'Failed to update acquired status. Rolled back.');
    }
  };

  const handleOpenLink = async (source: string, url: string) => {
    const affiliateUrl = getAffiliateUrl(source, url);
    try {
      await WebBrowser.openBrowserAsync(affiliateUrl, {
        dismissButtonStyle: 'close',
        toolbarColor: DL.card,
        controlsColor: DL.text,
        createTask: false,
      });
    } catch {
      Linking.openURL(affiliateUrl);
    }
  };

  const handleRetryResearch = async () => {
    if (!id || !item) return;
    setRetrying(true);
    const previousItem = { ...item };
    
    // 1. Optimistic Update locally
    setItem((prev) => (prev ? { ...prev, status: 'pending' } : null));
    updateCachedItem({ ...item, status: 'pending' });
    
    try {
      await triggerResearch(id);
    } catch {
      setItem(previousItem);
      updateCachedItem(previousItem);
      Alert.alert('Error', 'Failed to trigger retry. Please try again.');
    } finally {
      setRetrying(false);
    }
  };

  const handleAddManualPrice = async () => {
    if (!id || !item) return;
    const priceVal = parseFloat(manualPrice);
    if (isNaN(priceVal) || priceVal <= 0) {
      Alert.alert('Validation Error', 'Please enter a valid price greater than zero.');
      return;
    }
    
    const previousItem = { ...item };
    const tempPriceId = `temp-price-${Date.now()}`;
    const newPriceRow: ItemPrice = {
      id: tempPriceId,
      item_id: id,
      source: 'manual',
      price: priceVal,
      currency: 'INR',
      url: manualUrl || null,
      in_stock: true,
      captured_at: new Date().toISOString(),
    };
    
    const updatedPrices = [...(item.prices || []), newPriceRow];
    const isNewLink = manualUrl && manualUrl.trim() && item.manual_link !== manualUrl.trim();
    const updatedFields = {
      prices: updatedPrices,
      ...(isNewLink ? { manual_link: manualUrl.trim(), status: 'pending' as const } : {})
    };
    
    // 1. Optimistic Update
    setItem((prev) => (prev ? { ...prev, ...updatedFields } : null));
    updateCachedItem({ ...item, ...updatedFields } as WishlistItem);
    setManualPrice('');
    setManualUrl('');
    setAddingPrice(false);
    
    setSubmittingPrice(true);
    try {
      const addedPrice = await addManualPrice(id, priceVal, manualUrl || undefined);
      setItem((prev) => {
        if (!prev) return null;
        const prices = (prev.prices || []).map((p) => p.id === tempPriceId ? addedPrice : p);
        const resolved = { ...prev, prices };
        updateCachedItem(resolved as WishlistItem);
        return resolved;
      });
      if (isNewLink) {
        load();
      }
    } catch (e: any) {
      setItem(previousItem);
      updateCachedItem(previousItem);
      Alert.alert('Error', e.message || 'Failed to save manual price. Rolled back.');
    } finally {
      setSubmittingPrice(false);
    }
  };

  const handlePickAndUploadImage = async () => {
    if (!id) return;
    
    // Request permission
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'Permission to access photo library is required.');
      return;
    }

    const pickerResult = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.8,
    });

    if (pickerResult.canceled || !pickerResult.assets || pickerResult.assets.length === 0) {
      return;
    }

    const selectedAsset = pickerResult.assets[0];
    const imageUri = selectedAsset.uri;
    const fileName = selectedAsset.fileName || 'screenshot.jpg';

    setUploadingImage(true);
    try {
      await uploadAttachment(id, imageUri, fileName);
      load();
    } catch (e: any) {
      Alert.alert('Upload Error', e.message || 'Failed to attach image.');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleDeleteAttachment = (attachmentId: string, storagePath: string) => {
    if (!id) return;
    Alert.alert('Delete Attachment', 'Are you sure you want to remove this screenshot?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteAttachmentRecord(id, attachmentId);
            // Clean up from storage
            await supabase.storage.from('item-attachments').remove([storagePath]);
            load();
          } catch {
            Alert.alert('Error', 'Failed to delete attachment.');
          }
        },
      },
    ]);
  };

  const handleOpenAttachment = async (storagePath: string) => {
    const { data } = supabase.storage.from('item-attachments').getPublicUrl(storagePath);
    if (data?.publicUrl) {
      try {
        await WebBrowser.openBrowserAsync(data.publicUrl, {
          dismissButtonStyle: 'close',
          toolbarColor: DL.card,
          controlsColor: DL.text,
        });
      } catch {
        Linking.openURL(data.publicUrl);
      }
    }
  };

  const handleDelete = () => {
    Alert.alert('Delete Item', 'Are you sure you want to delete this item?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          if (!id) return;
          const previousItem = item ? { ...item } : null;
          
          // 1. Delete optimistically
          deleteCachedItem(id);
          router.back();
          
          // 2. Sync to backend
          try {
            await deleteItem(id);
          } catch {
            // 3. Rollback (re-insert into cache)
            if (previousItem) {
              updateCachedItem(previousItem as WishlistItem);
            }
            Alert.alert('Sync Failed', 'Failed to delete item from server. Rolled back.');
          }
        },
      },
    ]);
  };

  // --- Loading skeleton ---
  if (loading) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top + 12 }]}>
        <View style={[styles.detailHeader, { paddingHorizontal: 20 }]}>
          <Pressable onPress={() => router.back()} style={styles.circularBackBtn} hitSlop={8}>
            <Text style={styles.circularBackText}>←</Text>
          </Pressable>
          <Text style={styles.detailHeaderTitle}>Item Details</Text>
          <View style={{ width: 38 }} />
        </View>
        <View style={styles.skeletonContainer}>
          <SkeletonBlock width="70%" height={24} />
          <SkeletonBlock width="40%" height={16} style={{ marginTop: 12 }} />
          <SkeletonBlock width="30%" height={14} style={{ marginTop: 8 }} />
          <SkeletonBlock width="100%" height={1} style={{ marginTop: 20 }} />
          <SkeletonBlock width="50%" height={14} style={{ marginTop: 20 }} />
          <SkeletonBlock width="100%" height={44} style={{ marginTop: 12 }} />
          <SkeletonBlock width="100%" height={44} style={{ marginTop: 12 }} />
        </View>
      </View>
    );
  }

  if (fetchError) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top + 12 }]}>
        <View style={[styles.detailHeader, { paddingHorizontal: 20 }]}>
          <Pressable onPress={() => router.back()} style={styles.circularBackBtn} hitSlop={8}>
            <Text style={styles.circularBackText}>←</Text>
          </Pressable>
          <Text style={styles.detailHeaderTitle}>Item Details</Text>
          <View style={{ width: 38 }} />
        </View>
        <View style={styles.centered}>
          <Text style={styles.emptyText}>{"Couldn't load this item — check your connection"}</Text>
          <Pressable onPress={load} style={[styles.retryButton, { marginTop: 16 }]} hitSlop={8}>
            <Text style={styles.retryButtonText}>Retry Connection</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  if (!item) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top + 12 }]}>
        <View style={[styles.detailHeader, { paddingHorizontal: 20 }]}>
          <Pressable onPress={() => router.back()} style={styles.circularBackBtn} hitSlop={8}>
            <Text style={styles.circularBackText}>←</Text>
          </Pressable>
          <Text style={styles.detailHeaderTitle}>Item Details</Text>
          <View style={{ width: 38 }} />
        </View>
        <View style={styles.centered}>
          <Text style={styles.emptyText}>Item not found.</Text>
        </View>
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.screen, { paddingTop: insets.top + 12 }]}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 80 }]}
    >
      {/* Header Bar */}
      <View style={styles.detailHeader}>
        <Pressable onPress={() => router.back()} style={styles.circularBackBtn} hitSlop={8}>
          <Text style={styles.circularBackText}>←</Text>
        </Pressable>
        <Text style={styles.detailHeaderTitle}>Item Details</Text>
        <View style={styles.headerRightActions}>
          <Pressable onPress={toggleEditMode} style={[styles.editBtn, isEditing && { backgroundColor: 'rgba(255, 255, 255, 0.08)' }]} hitSlop={8}>
            <Text style={styles.editBtnText}>{isEditing ? '✕' : '✏️'}</Text>
          </Pressable>
          <Pressable onPress={handleDelete} style={styles.trashBtn} hitSlop={8}>
            <Text style={styles.trashBtnText}>🗑️</Text>
          </Pressable>
        </View>
      </View>

      {isEditing ? (
        <View style={{ marginTop: 8 }}>
          <Text style={styles.inputLabel}>ITEM NAME</Text>
          <TextInput
            style={styles.textInput}
            value={editName}
            onChangeText={setEditName}
            placeholder="e.g. Sony WH-1000XM5"
            placeholderTextColor={DL.muted}
          />

          <Text style={styles.inputLabel}>PRIORITY TIER</Text>
          <View style={styles.tierRow}>
            {TIERS.map((t) => {
              const active = editTier === t;
              const color = TIER_COLOR[t];
              return (
                <Pressable
                  key={t}
                  style={[
                    styles.tierPill,
                    active
                      ? { backgroundColor: color, borderColor: color }
                      : { backgroundColor: 'transparent', borderColor: DL.border },
                  ]}
                  onPress={() => setEditTier(t)}
                >
                  <Text style={[styles.tierPillText, { color: active ? '#0B0D10' : color }]}>
                    {t.toUpperCase()}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.inputLabel}>CATEGORY</Text>
          <View style={styles.pillRow}>
            {availableCategories.map((cat) => (
              <Pressable
                key={cat}
                style={[
                  styles.pill,
                  !isCustomCategory && editCategory === cat
                    ? { backgroundColor: DL.text, borderColor: DL.text }
                    : { backgroundColor: 'rgba(255, 255, 255, 0.02)', borderColor: DL.border },
                ]}
                onPress={() => {
                  setIsCustomCategory(false);
                  setEditCategory(cat);
                }}
              >
                <Text style={[styles.pillText, { color: !isCustomCategory && editCategory === cat ? '#0B0D10' : DL.muted }]}>
                  {cat}
                </Text>
              </Pressable>
            ))}
            <Pressable
              style={[
                styles.pill,
                isCustomCategory
                  ? { backgroundColor: DL.soon, borderColor: DL.soon }
                  : { backgroundColor: 'rgba(255, 255, 255, 0.02)', borderColor: DL.border },
              ]}
              onPress={() => setIsCustomCategory(true)}
            >
              <Text style={[styles.pillText, { color: isCustomCategory ? '#0B0D10' : DL.muted }]}>
                + Custom
              </Text>
            </Pressable>
          </View>

          {isCustomCategory && (
            <TextInput
              style={[styles.textInput, { marginTop: 10 }]}
              value={editCustomCategory}
              onChangeText={setEditCustomCategory}
              placeholder="Custom category name..."
              placeholderTextColor={DL.muted}
              autoCapitalize="words"
            />
          )}

          <Text style={styles.inputLabel}>NOTES</Text>
          <TextInput
            style={[styles.textInput, { height: 90, textAlignVertical: 'top' }]}
            value={editNotes}
            onChangeText={setEditNotes}
            placeholder="Write details or specifications here..."
            placeholderTextColor={DL.muted}
            multiline
          />

          <Text style={styles.inputLabel}>PRODUCT LINK</Text>
          <TextInput
            style={styles.textInput}
            value={editLink}
            onChangeText={setEditLink}
            placeholder="https://..."
            placeholderTextColor={DL.muted}
            autoCapitalize="none"
            keyboardType="url"
          />

          <View style={styles.formActions}>
            <Pressable style={[styles.formBtn, styles.cancelBtn]} onPress={cancelEdit}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </Pressable>
            
            <Pressable
              style={[styles.formBtn, styles.submitBtn, { backgroundColor: TIER_COLOR[editTier] }]}
              onPress={saveEdit}
              disabled={savingEdit}
            >
              {savingEdit ? (
                <ActivityIndicator size="small" color="#0B0D10" />
              ) : (
                <Text style={styles.submitBtnText}>Save Changes</Text>
              )}
            </Pressable>
          </View>
        </View>
      ) : (
        <>
          {/* Item name */}
          <Text style={styles.itemName}>{item.name}</Text>

          {/* Tier + status row */}
          <View style={styles.row}>
            <TierBadge tier={item.tier} size="md" />
            <View style={{ flexDirection: 'row', alignItems: 'center', position: 'relative' }}>
              <PulsingGlyph status={item.status} />
              {!(item.status === 'pending' || item.status === 'researching') && (
                <Text style={styles.statusText}>
                  {item.done ? 'Acquired' : item.status.toUpperCase()}
                </Text>
              )}
            </View>
          </View>

          {/* Category */}
          <Text style={styles.categoryLabel}>{item.category.toUpperCase()}</Text>

          {/* Divider */}
          <View style={styles.divider} />

          {/* DETAILS section */}
          <Text style={styles.sectionHeader}>DETAILS</Text>

          {/* Tier picker */}
          <View style={styles.tierRow}>
            {TIERS.map((t) => {
              const active = item.tier === t;
              const color = TIER_COLOR[t];
              return (
                <Pressable
                  key={t}
                  style={[
                    styles.tierPill,
                    active
                      ? { backgroundColor: color, borderColor: color }
                      : { backgroundColor: 'transparent', borderColor: DL.border },
                  ]}
                  onPress={() => handleTierChange(t)}
                >
                  <Text
                    style={[
                      styles.tierPillText,
                      { color: active ? '#0B0D10' : color },
                    ]}
                  >
                    {t.toUpperCase()}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Done toggle */}
          <Pressable style={styles.doneRow} onPress={handleToggleDone}>
            <View
              style={[
                styles.checkbox,
                item.done && { backgroundColor: DL.success, borderColor: DL.success },
              ]}
            >
              {item.done && <Text style={styles.checkmark}>✓</Text>}
            </View>
            <Text style={styles.doneLabel}>Mark as acquired</Text>
          </Pressable>

          {/* Failed research retry banner */}
          {item.status === 'failed' && (
            <View style={styles.failedBanner}>
              <Text style={styles.failedTitle}>Research Failed</Text>
              <Text style={styles.failedText}>
                {"We couldn't retrieve AI details for this item. Check spelling or try again."}
              </Text>
              <Pressable
                style={styles.retryButton}
                onPress={handleRetryResearch}
                disabled={retrying}
              >
                {retrying ? (
                  <ActivityIndicator size="small" color="#0B0D10" />
                ) : (
                  <Text style={styles.retryButtonText}>Retry AI Research</Text>
                )}
              </Pressable>
            </View>
          )}

          {/* Notes */}
          <Text style={styles.fieldLabel}>NOTES</Text>
          {item.manual_notes ? (
            <View style={styles.notesBox}>
              <Text style={styles.notesText}>{item.manual_notes}</Text>
            </View>
          ) : (
            <Text style={styles.mutedItalic}>No notes</Text>
          )}

          {/* Link */}
          {item.manual_link ? (
            <Pressable onPress={() => handleOpenLink('other', item.manual_link!)}>
              <Text style={styles.linkText}>{item.manual_link}</Text>
            </Pressable>
          ) : null}

          {/* Divider */}
          <View style={styles.divider} />

          {/* AI Research */}
          <Text style={styles.sectionHeader}>AI RESEARCH</Text>
          {item.status === 'pending' || item.status === 'researching' ? (
            <View style={styles.placeholderBox}>
              <View style={{ marginBottom: 12 }}>
                <PulsingGlyph status={item.status} />
              </View>
              <Text style={styles.placeholderText}>
                AI is researching this product details and specifications...
              </Text>
              <SkeletonBlock width="100%" height={14} style={{ marginTop: 12 }} />
              <SkeletonBlock width="80%" height={14} style={{ marginTop: 8 }} />
            </View>
          ) : item.research && item.research.length > 0 ? (
            (() => {
              const research = item.research[0];
              const confText = research.confidence ? (research.confidence >= 0.75 ? 'HIGH' : research.confidence >= 0.50 ? 'MEDIUM' : 'LOW') : 'MEDIUM';
              const confColor = confText === 'HIGH' ? DL.success : confText === 'MEDIUM' ? DL.now : DL.danger;
              return (
                <View style={styles.researchCard}>
                  <View style={styles.researchHeaderRow}>
                    <Text style={styles.brandModel}>
                      {research.brand} {research.model}
                    </Text>
                    <View style={[styles.confidenceBadge, { backgroundColor: `${confColor}22` }]}>
                      <Text style={[styles.confidenceText, { color: confColor }]}>
                        {confText} CONFIDENCE
                      </Text>
                    </View>
                  </View>
                  
                  <Text style={styles.summaryText}>{research.summary}</Text>
                  
                  {research.specs && Object.keys(research.specs).filter((k) => k !== '_best_price_reasoning').length > 0 && (
                    <View style={styles.specsContainer}>
                      <Text style={styles.specsHeader}>TECHNICAL SPECS</Text>
                      {Object.entries(research.specs)
                        .filter(([key]) => key !== '_best_price_reasoning')
                        .map(([key, val]) => (
                          <View key={key} style={styles.specRow}>
                            <Text style={styles.specKey}>{key}</Text>
                            <Text style={styles.specValue}>{String(val)}</Text>
                          </View>
                        ))}
                    </View>
                  )}
                </View>
              );
            })()
          ) : (
            <View style={styles.placeholderBox}>
              <Text style={styles.placeholderText}>
                No AI research records available for this item.
              </Text>
            </View>
          )}

          {/* Price Comparison */}
          <Text style={styles.sectionHeader}>PRICE COMPARISON</Text>
          {isStale && item.status !== 'pending' && item.status !== 'researching' && (
            <View style={styles.staleBanner}>
              <View style={styles.staleBannerLeft}>
                <Text style={styles.staleBannerText}>
                  ⚠️ Prices may be outdated (last checked {daysSinceResearch} days ago).
                </Text>
              </View>
              <Pressable
                style={styles.staleRefreshButton}
                onPress={handleRetryResearch}
                disabled={retrying}
              >
                <Text style={styles.staleRefreshButtonText}>
                  {retrying ? 'REFRESHING...' : 'REFRESH'}
                </Text>
              </Pressable>
            </View>
          )}
          {item.status === 'pending' || item.status === 'researching' ? (
            <View style={styles.placeholderBox}>
              <Text style={styles.placeholderText}>
                Searching Amazon, Flipkart, and official portals...
              </Text>
              <SkeletonBlock width="100%" height={40} style={{ marginTop: 12 }} />
            </View>
          ) : (
            <View>
              {item.prices && item.prices.length > 0 ? (
                (() => {
                  const prices = item.prices!;
                  const lowestPrice = Math.min(...prices.map((p) => Number(p.price)));
                  return (
                    <View>
                      <View style={styles.priceTable}>
                        {prices.map((p, idx) => {
                          const isBestValue = prices.length >= 2 && Number(p.price) === lowestPrice;
                          const highlightColor = TIER_COLOR[item.tier];
                          const isManual = p.source === 'manual';
                          
                          return (
                            <View
                              key={p.id || idx}
                              style={[
                                styles.priceRow,
                                idx > 0 && { borderTopWidth: 1, borderTopColor: DL.border },
                                isBestValue && {
                                  borderColor: highlightColor,
                                  borderWidth: 1,
                                  backgroundColor: 'rgba(28, 32, 38, 0.4)',
                                  borderRadius: 8,
                                }
                              ]}
                            >
                              <View style={styles.priceLeft}>
                                <View style={styles.sourceRow}>
                                  <Text style={styles.priceSource}>
                                    {SOURCE_ICONS[p.source.toLowerCase()] || `🏷️ ${p.source.toUpperCase()}`}
                                  </Text>
                                  {isBestValue && (
                                    <Text style={[styles.bestValueLabel, { color: highlightColor }]}>
                                      ★ BEST VALUE
                                    </Text>
                                  )}
                                </View>
                                {!isManual && (
                                  <Text style={styles.stockLabel}>
                                    {p.in_stock ? 'IN STOCK' : 'OUT OF STOCK'}
                                  </Text>
                                )}
                              </View>
                              <View style={styles.priceRight}>
                                <Text style={styles.priceVal}>
                                  ₹{Number(p.price).toLocaleString('en-IN')}
                                </Text>
                                {p.url ? (
                                  <Pressable
                                    style={[styles.shopButton, { backgroundColor: highlightColor }]}
                                    onPress={() => handleOpenLink(p.source, p.url!)}
                                  >
                                    <Text style={styles.shopButtonText}>SHOP →</Text>
                                  </Pressable>
                                ) : (
                                  <Text style={styles.noLinkText}>No link provided</Text>
                                )}
                              </View>
                            </View>
                          );
                        })}
                      </View>

                      {/* AI Reasoning Caption */}
                      {item.research && item.research.length > 0 && (item.research[0].specs as any)._best_price_reasoning ? (
                        <Text style={styles.reasoningText}>
                          💡 {String((item.research[0].specs as any)._best_price_reasoning)}
                        </Text>
                      ) : null}
                    </View>
                  );
                })()
              ) : (
                <View style={styles.placeholderBox}>
                  <Text style={styles.placeholderText}>
                    No verified prices found yet.
                  </Text>
                </View>
              )}

              {/* Add Manual Price Trigger & Form */}
              {!addingPrice ? (
                <Pressable
                  style={styles.addManualTrigger}
                  onPress={() => setAddingPrice(true)}
                >
                  <Text style={styles.addManualTriggerText}>+ Add Manual Price / Link</Text>
                </Pressable>
              ) : (
                <View style={styles.manualForm}>
                  <Text style={styles.manualFormTitle}>ADD CUSTOM OFFER</Text>
                  
                  <Text style={styles.inputLabel}>Price in INR (₹) *</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="e.g. 12999"
                    placeholderTextColor={DL.muted}
                    keyboardType="numeric"
                    value={manualPrice}
                    onChangeText={setManualPrice}
                  />
                  
                  <Text style={styles.inputLabel}>Product URL (Optional)</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="https://..."
                    placeholderTextColor={DL.muted}
                    autoCapitalize="none"
                    value={manualUrl}
                    onChangeText={setManualUrl}
                  />

                  <View style={styles.formActions}>
                    <Pressable
                      style={[styles.formBtn, styles.cancelBtn]}
                      onPress={() => {
                        setAddingPrice(false);
                        setManualPrice('');
                        setManualUrl('');
                      }}
                      disabled={submittingPrice}
                    >
                      <Text style={styles.cancelBtnText}>Cancel</Text>
                    </Pressable>
                    
                    <Pressable
                      style={[styles.formBtn, styles.submitBtn, { backgroundColor: TIER_COLOR[item.tier] }]}
                      onPress={handleAddManualPrice}
                      disabled={submittingPrice}
                    >
                      {submittingPrice ? (
                        <ActivityIndicator size="small" color="#0B0D10" />
                      ) : (
                        <Text style={styles.submitBtnText}>Add Offer</Text>
                      )}
                    </Pressable>
                  </View>
                </View>
              )}
            </View>
          )}

          {/* Screenshot Attachments strip */}
          <View style={styles.divider} />
          <Text style={styles.sectionHeader}>SCREENSHOT ATTACHMENTS</Text>
          <View style={styles.attachmentsSection}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.attachmentStrip}>
              {/* Pick photo trigger block */}
              <Pressable
                style={styles.uploadBlock}
                onPress={handlePickAndUploadImage}
                disabled={uploadingImage}
              >
                {uploadingImage ? (
                  <ActivityIndicator size="small" color={DL.now} />
                ) : (
                  <>
                    <Text style={styles.uploadPlus}>+</Text>
                    <Text style={styles.uploadText}>Add Image</Text>
                  </>
                )}
              </Pressable>

              {/* Show list of thumbnails */}
              {item.attachments && item.attachments.map((att) => {
                const publicUrl = supabase.storage.from('item-attachments').getPublicUrl(att.storage_path).data.publicUrl;
                return (
                  <View key={att.id} style={styles.thumbnailContainer}>
                    <Pressable onPress={() => handleOpenAttachment(att.storage_path)}>
                      <Image source={{ uri: publicUrl }} style={styles.thumbnailImage} />
                    </Pressable>
                    
                    <Pressable
                      style={styles.deleteThumbnailBtn}
                      onPress={() => handleDeleteAttachment(att.id, att.storage_path)}
                    >
                      <Text style={styles.deleteThumbnailText}>×</Text>
                    </Pressable>
                  </View>
                );
              })}
            </ScrollView>
          </View>
        </>
      )}

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: DL.bg,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 60,
  },
  detailHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 22,
    width: '100%',
  },
  circularBackBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderColor: DL.border,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  circularBackText: {
    color: DL.text,
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: -2,
  },
  detailHeaderTitle: {
    fontFamily: DLFonts.mono,
    fontSize: 10,
    letterSpacing: 2,
    color: DL.muted,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  trashBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(239, 68, 68, 0.06)',
    borderColor: 'rgba(239, 68, 68, 0.2)',
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  trashBtnText: {
    fontSize: 15,
  },
  skeletonContainer: {
    paddingHorizontal: 20,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    color: DL.muted,
    fontSize: 15,
    fontFamily: DLFonts.sans,
  },
  itemName: {
    fontSize: 26,
    fontWeight: '800',
    color: DL.text,
    fontFamily: DLFonts.sans,
    marginBottom: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  statusText: {
    fontSize: 11,
    fontFamily: DLFonts.mono,
    color: DL.muted,
    letterSpacing: 0.5,
  },
  categoryLabel: {
    fontSize: 10,
    letterSpacing: 2,
    fontFamily: DLFonts.mono,
    color: DL.muted,
    marginBottom: 4,
    opacity: 0.8,
  },
  divider: {
    height: 1.2,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    marginVertical: 22,
  },
  sectionHeader: {
    fontSize: 10,
    letterSpacing: 2,
    fontFamily: DLFonts.mono,
    color: DL.muted,
    marginBottom: 14,
  },
  tierRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 18,
  },
  tierPill: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1.2,
  },
  tierPillText: {
    fontSize: 12,
    fontWeight: 'bold',
    fontFamily: DLFonts.mono,
  },
  doneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(34, 197, 94, 0.05)',
    borderColor: 'rgba(34, 197, 94, 0.15)',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 22,
    gap: 12,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: DL.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkmark: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  doneLabel: {
    color: DL.text,
    fontSize: 14,
    fontWeight: '600',
    fontFamily: DLFonts.sans,
  },
  fieldLabel: {
    fontSize: 9,
    letterSpacing: 1.5,
    fontFamily: DLFonts.mono,
    color: DL.muted,
    marginBottom: 8,
  },
  notesBox: {
    backgroundColor: DL.card,
    borderColor: DL.border,
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginBottom: 14,
  },
  notesText: {
    color: DL.text,
    fontSize: 14,
    lineHeight: 20,
    fontFamily: DLFonts.sans,
  },
  mutedItalic: {
    color: DL.muted,
    fontSize: 14,
    fontStyle: 'italic',
    marginBottom: 12,
  },
  linkText: {
    color: DL.now,
    fontSize: 14,
    marginBottom: 4,
  },
  placeholderBox: {
    backgroundColor: DL.card,
    borderColor: DL.border,
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    color: DL.muted,
    fontSize: 13,
    fontStyle: 'italic',
    lineHeight: 18,
    textAlign: 'center',
    fontFamily: DLFonts.sans,
  },
  failedBanner: {
    backgroundColor: 'rgba(239, 68, 68, 0.06)',
    borderColor: 'rgba(239, 68, 68, 0.2)',
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    marginBottom: 22,
    alignItems: 'center',
  },
  failedTitle: {
    color: DL.danger,
    fontSize: 15,
    fontWeight: 'bold',
    fontFamily: DLFonts.sans,
    marginBottom: 4,
  },
  failedText: {
    color: DL.muted,
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 16,
    fontFamily: DLFonts.sans,
    marginBottom: 12,
  },
  retryButton: {
    backgroundColor: DL.danger,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
    fontFamily: DLFonts.sans,
  },
  researchCard: {
    backgroundColor: DL.card,
    borderColor: DL.border,
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  researchHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  brandModel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: DL.text,
    fontFamily: DLFonts.sans,
  },
  confidenceBadge: {
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  confidenceText: {
    fontSize: 9,
    fontFamily: DLFonts.mono,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  summaryText: {
    fontSize: 14,
    color: DL.text,
    lineHeight: 21,
    fontFamily: DLFonts.sans,
    marginBottom: 16,
  },
  specsContainer: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
    paddingTop: 14,
  },
  specsHeader: {
    fontSize: 9,
    letterSpacing: 1.5,
    fontFamily: DLFonts.mono,
    color: DL.muted,
    marginBottom: 10,
  },
  specRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 7,
    gap: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.02)',
  },
  specKey: {
    fontSize: 12,
    color: DL.muted,
    fontFamily: DLFonts.sans,
    flex: 1,
  },
  specValue: {
    fontSize: 12,
    color: DL.text,
    fontFamily: DLFonts.mono,
    flex: 1.5,
    textAlign: 'right',
  },
  priceTable: {
    backgroundColor: DL.card,
    borderColor: DL.border,
    borderWidth: 1,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 16,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.03)',
  },
  priceLeft: {
    gap: 4,
  },
  priceSource: {
    fontSize: 12,
    fontWeight: 'bold',
    color: DL.text,
    fontFamily: DLFonts.mono,
  },
  stockLabel: {
    fontSize: 9,
    fontFamily: DLFonts.mono,
    color: DL.muted,
    letterSpacing: 0.5,
  },
  priceRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  priceVal: {
    fontSize: 14,
    fontWeight: '700',
    color: DL.text,
    fontFamily: DLFonts.mono,
    letterSpacing: 2,
    textShadowColor: 'rgba(231, 233, 238, 0.25)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 4,
  },
  shopButton: {
    backgroundColor: DL.now,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  shopButtonText: {
    color: '#0B0D10',
    fontSize: 11,
    fontFamily: DLFonts.mono,
    fontWeight: 'bold',
  },
  sourceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  bestValueLabel: {
    fontSize: 8,
    fontFamily: DLFonts.mono,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  emptyLinkSpacer: {
    width: 60,
  },
  addManualTrigger: {
    alignSelf: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    backgroundColor: DL.card,
    marginVertical: 14,
  },
  addManualTriggerText: {
    color: DL.now,
    fontFamily: DLFonts.sans,
    fontSize: 13,
    fontWeight: 'bold',
  },
  manualForm: {
    backgroundColor: DL.card,
    borderColor: DL.border,
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    marginVertical: 14,
  },
  manualFormTitle: {
    fontSize: 9,
    fontFamily: DLFonts.mono,
    letterSpacing: 1.5,
    color: DL.muted,
    marginBottom: 14,
  },
  inputLabel: {
    fontSize: 11,
    color: DL.text,
    marginBottom: 6,
    fontFamily: DLFonts.sans,
    fontWeight: '600',
  },
  textInput: {
    backgroundColor: 'rgba(11, 13, 16, 0.4)',
    borderColor: DL.border,
    borderWidth: 1.2,
    borderRadius: 10,
    padding: 12,
    color: DL.text,
    fontSize: 14,
    marginBottom: 14,
    fontFamily: DLFonts.sans,
  },
  formActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 6,
  },
  formBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtn: {
    borderColor: DL.border,
    borderWidth: 1,
  },
  cancelBtnText: {
    color: DL.muted,
    fontSize: 13,
    fontWeight: 'bold',
    fontFamily: DLFonts.sans,
  },
  submitBtn: {
    minWidth: 100,
    backgroundColor: DL.now,
  },
  submitBtnText: {
    color: '#0B0D10',
    fontSize: 13,
    fontWeight: 'bold',
    fontFamily: DLFonts.sans,
  },
  attachmentsSection: {
    marginBottom: 8,
  },
  attachmentStrip: {
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 4,
  },
  uploadBlock: {
    width: 90,
    height: 90,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: DL.border,
    borderStyle: 'dashed',
    backgroundColor: DL.card,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
  },
  uploadPlus: {
    fontSize: 24,
    color: DL.muted,
    fontWeight: '300',
  },
  uploadText: {
    fontSize: 11,
    color: DL.muted,
    fontFamily: DLFonts.sans,
  },
  thumbnailContainer: {
    position: 'relative',
    width: 90,
    height: 90,
    borderRadius: 10,
    overflow: 'hidden',
    borderColor: DL.border,
    borderWidth: 1,
  },
  thumbnailImage: {
    width: 90,
    height: 90,
    backgroundColor: DL.card,
  },
  deleteThumbnailBtn: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(11, 13, 16, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    borderColor: DL.border,
    borderWidth: 1,
  },
  deleteThumbnailText: {
    color: DL.danger,
    fontSize: 12,
    fontWeight: 'bold',
    marginTop: -2,
  },
  deleteButton: {
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    borderColor: 'rgba(239, 68, 68, 0.2)',
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  deleteText: {
    color: DL.danger,
    fontSize: 15,
    fontWeight: 'bold',
    fontFamily: DLFonts.sans,
  },
  noLinkText: {
    fontSize: 11,
    fontFamily: DLFonts.mono,
    color: DL.muted,
    fontStyle: 'italic',
  },
  reasoningText: {
    fontSize: 12,
    fontFamily: DLFonts.sans,
    color: DL.muted,
    lineHeight: 18,
    marginTop: 8,
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  headerRightActions: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  editBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderColor: DL.border,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  editBtnText: {
    fontSize: 15,
    color: DL.text,
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginVertical: 8,
    marginBottom: 14,
  },
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.2,
    borderColor: DL.border,
    backgroundColor: 'rgba(255, 255, 255, 0.01)',
  },
  pillText: {
    fontFamily: DLFonts.mono,
    fontSize: 10,
    fontWeight: 'bold',
  },
  staleBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(217, 119, 6, 0.08)',
    borderColor: 'rgba(217, 119, 6, 0.3)',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  staleBannerLeft: {
    flex: 1,
    marginRight: 12,
  },
  staleBannerText: {
    color: '#D97706',
    fontSize: 12,
    fontFamily: DLFonts.sans,
    lineHeight: 16,
  },
  staleRefreshButton: {
    backgroundColor: '#D97706',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
  },
  staleRefreshButtonText: {
    color: '#000000',
    fontSize: 11,
    fontWeight: 'bold',
    fontFamily: DLFonts.medium,
  },
});
