import React, { useState, useRef, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Animated,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { getCachedItems, saveCachedItems } from '@/lib/database';
import { DL, DLFonts, TIER_COLOR } from '@/constants/design';
import { createItem } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import type { Category, Tier, WishlistItem } from '@/lib/types';
import { CATEGORIES, TIERS } from '@/lib/types';

// Category emoji dictionary
const CATEGORY_EMOJIS: Record<Category, string> = {
  Tech: '💻',
  Home: '🏡',
  Apparel: '👕',
  Books: '📚',
  Fitness: '🏋️‍♂️',
  Other: '🏷️',
};

// Custom tactile button component for form actions
function TactileButton({ onPress, style, children, disabled }: any) {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scale, { toValue: 0.96, useNativeDriver: true }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scale, { toValue: 1, useNativeDriver: true }).start();
  };

  return (
    <Pressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled}
      style={styles.tactileWrapper}
    >
      <Animated.View style={[style, { transform: [{ scale }] }]}>
        {children}
      </Animated.View>
    </Pressable>
  );
}

// Category/Tier interactive pill selector component
function SelectionPill({ label, active, onPress, emoji, activeBgColor, activeTextColor }: any) {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scale, { toValue: 0.93, useNativeDriver: true }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scale, { toValue: 1, useNativeDriver: true }).start();
  };

  return (
    <Pressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
    >
      <Animated.View
        style={[
          styles.pill,
          { transform: [{ scale }] },
          active
            ? { backgroundColor: activeBgColor || DL.text, borderColor: activeBgColor || DL.text }
            : { backgroundColor: 'rgba(255, 255, 255, 0.02)', borderColor: DL.border },
        ]}
      >
        <Text
          style={[
            styles.pillText,
            { color: active ? (activeTextColor || '#0B0D10') : DL.muted },
          ]}
        >
          {emoji ? `${emoji}  ` : ''}{label}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

export default function AddItemScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ category?: string; sharedUrl?: string; sharedText?: string }>();
  const { user } = useAuth();

  const [name, setName] = useState(() => {
    if (params.sharedUrl) {
      return 'Researching details...';
    }
    if (params.sharedText) {
      return params.sharedText;
    }
    return '';
  });
  const [link, setLink] = useState(() => {
    if (params.sharedUrl) {
      return params.sharedUrl;
    }
    return '';
  });
  const [category, setCategory] = useState<Category>(() => {
    // Capitalize parameter to match categories keys
    const rawCat = params.category || 'Tech';
    const formatted = rawCat.charAt(0).toUpperCase() + rawCat.slice(1).toLowerCase();
    return (formatted as Category) || 'Tech';
  });
  const [isCustomCategory, setIsCustomCategory] = useState(false);
  const [customCategory, setCustomCategory] = useState('');
  const [isCategoryInputFocused, setIsCategoryInputFocused] = useState(false);
  const [tier, setTier] = useState<Tier>('soon');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [isLinkFocused, setIsLinkFocused] = useState(false);

  const availableCategories = useMemo(() => {
    try {
      const cached = getCachedItems();
      const custom = Array.from(new Set(cached.map((i) => i.category || 'Other')));
      return Array.from(new Set([...CATEGORIES, ...custom])).filter(Boolean);
    } catch {
      return CATEGORIES;
    }
  }, []);

  const handleSubmit = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Item name is required.');
      return;
    }

    let finalCategory = category;
    if (isCustomCategory) {
      const trimmedCustom = customCategory.trim();
      if (!trimmedCustom) {
        setError('Custom category name is required.');
        return;
      }
      finalCategory = trimmedCustom;
    }

    const trimmedLink = link.trim();
    const manual_link = trimmedLink ? trimmedLink : undefined;

    setError(null);
    setSubmitting(true);

    const tempId = `temp-${Date.now()}`;
    const newItem: WishlistItem = {
      id: tempId,
      user_id: user?.id || 'temp-user',
      name: trimmed,
      category: finalCategory,
      tier: tier,
      status: 'pending',
      done: false,
      manual_notes: null,
      manual_link: manual_link || null,
      created_at: new Date().toISOString(),
      prices: [],
      research: [],
    };

    try {
      // 1. Optimistic Write to cache
      const cached = getCachedItems();
      saveCachedItems([newItem, ...cached]);

      // 2. Navigate back to dashboard instantly
      router.back();

      // 3. Trigger remote Supabase creation in background
      createItem({ name: trimmed, category: finalCategory, tier, manual_link })
        .then((realItem) => {
          // Swap tempId with the real UUID returned by backend in the cache
          const latest = getCachedItems();
          const updated = latest.map((item) =>
            item.id === tempId ? { ...item, ...realItem } : item
          );
          saveCachedItems(updated);
        })
        .catch((err) => {
          // Sync Failed: Rollback (remove the temp item from cache)
          const latest = getCachedItems();
          const filtered = latest.filter((item) => item.id !== tempId);
          saveCachedItems(filtered);
          Alert.alert('Sync Failed', `Failed to add "${trimmed}" on the server. Rolled back.`);
        });

    } catch (e: any) {
      setError(e.message || 'Failed to add item.');
      setSubmitting(false);
    }
  };

  return (
    <ScrollView
      style={[styles.screen, { paddingTop: insets.top + 12 }]}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.eyebrow}>ADD ITEM</Text>
        <Text style={styles.title}>New Wishlist Item</Text>
      </View>

      {/* Item Name Input */}
      <View style={styles.fieldGroup}>
        <Text style={styles.label}>ITEM NAME</Text>
        <View
          style={[
            styles.inputContainer,
            isFocused && styles.inputContainerFocused,
          ]}
        >
          <TextInput
            style={styles.input}
            placeholder="e.g. Sony WH-1000XM5"
            placeholderTextColor={DL.muted}
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
            editable={!submitting}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
          />
          {name.length > 0 && (
            <Pressable onPress={() => setName('')} hitSlop={8}>
              <Text style={styles.clearText}>✕</Text>
            </Pressable>
          )}
        </View>
      </View>

      {/* Product Link Input */}
      <View style={styles.fieldGroup}>
        <Text style={styles.label}>PRODUCT LINK (OPTIONAL)</Text>
        <View
          style={[
            styles.inputContainer,
            isLinkFocused && styles.inputContainerFocused,
          ]}
        >
          <TextInput
            style={styles.input}
            placeholder="https://example.com/product"
            placeholderTextColor={DL.muted}
            value={link}
            onChangeText={setLink}
            autoCapitalize="none"
            keyboardType="url"
            editable={!submitting}
            onFocus={() => setIsLinkFocused(true)}
            onBlur={() => setIsLinkFocused(false)}
          />
          {link.length > 0 && (
            <Pressable onPress={() => setLink('')} hitSlop={8}>
              <Text style={styles.clearText}>✕</Text>
            </Pressable>
          )}
        </View>
      </View>

      {/* Category Pills selection */}
      <View style={styles.fieldGroup}>
        <Text style={styles.label}>CATEGORY</Text>
        <View style={styles.pillRow}>
          {availableCategories.map((cat) => (
            <SelectionPill
              key={cat}
              label={cat}
              emoji={CATEGORY_EMOJIS[cat as keyof typeof CATEGORY_EMOJIS] || '🏷️'}
              active={!isCustomCategory && category === cat}
              onPress={() => {
                setIsCustomCategory(false);
                setCategory(cat);
              }}
              activeBgColor={DL.text}
              activeTextColor="#0B0D10"
            />
          ))}
          <SelectionPill
            label="+ Custom"
            emoji="✨"
            active={isCustomCategory}
            onPress={() => {
              setIsCustomCategory(true);
            }}
            activeBgColor={DL.soon}
            activeTextColor="#0B0D10"
          />
        </View>

        {isCustomCategory && (
          <View
            style={[
              styles.inputContainer,
              { marginTop: 12 },
              isCategoryInputFocused && styles.inputContainerFocused,
            ]}
          >
            <TextInput
              style={styles.input}
              placeholder="e.g. Gaming, Kitchen, Books"
              placeholderTextColor={DL.muted}
              value={customCategory}
              onChangeText={setCustomCategory}
              autoCapitalize="words"
              maxLength={40}
              editable={!submitting}
              onFocus={() => setIsCategoryInputFocused(true)}
              onBlur={() => setIsCategoryInputFocused(false)}
            />
            {customCategory.length > 0 && (
              <Pressable onPress={() => setCustomCategory('')} hitSlop={8}>
                <Text style={styles.clearText}>✕</Text>
              </Pressable>
            )}
          </View>
        )}
      </View>

      {/* Tier selection */}
      <View style={styles.fieldGroup}>
        <Text style={styles.label}>PRIORITY TIER</Text>
        <View style={styles.tierRow}>
          {TIERS.map((t) => (
            <View key={t} style={{ flex: 1 }}>
              <SelectionPill
                label={t.toUpperCase()}
                active={tier === t}
                onPress={() => setTier(t)}
                activeBgColor={TIER_COLOR[t]}
                activeTextColor="#0B0D10"
              />
            </View>
          ))}
        </View>
      </View>

      {/* Error Output */}
      {error && <Text style={styles.error}>{error}</Text>}

      {/* Submit Button */}
      <TactileButton
        style={styles.submitButton}
        onPress={handleSubmit}
        disabled={submitting}
      >
        {submitting ? (
          <ActivityIndicator color="#0B0D10" size="small" />
        ) : (
          <Text style={styles.submitText}>Add to Wishlist</Text>
        )}
      </TactileButton>
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
  header: {
    marginBottom: 28,
  },
  eyebrow: {
    fontSize: 10,
    letterSpacing: 2,
    color: DL.muted,
    fontFamily: DLFonts.mono,
    marginBottom: 4,
  },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
    color: DL.text,
  },
  fieldGroup: {
    marginBottom: 26,
  },
  label: {
    fontSize: 9,
    letterSpacing: 1.5,
    color: DL.muted,
    fontFamily: DLFonts.mono,
    marginBottom: 10,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderColor: DL.border,
    borderWidth: 1.2,
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 52,
  },
  inputContainerFocused: {
    borderColor: DL.soon,
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
  },
  input: {
    flex: 1,
    color: DL.text,
    fontSize: 15,
    fontFamily: DLFonts.sans,
  },
  clearText: {
    color: DL.muted,
    fontSize: 14,
    paddingLeft: 8,
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1.2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillText: {
    fontSize: 13,
    fontWeight: '600',
    fontFamily: DLFonts.sans,
  },
  tierRow: {
    flexDirection: 'row',
    gap: 8,
    width: '100%',
  },
  error: {
    color: DL.danger,
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 16,
    fontFamily: DLFonts.sans,
  },
  tactileWrapper: {
    width: '100%',
  },
  submitButton: {
    backgroundColor: DL.now,
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 8,
  },
  submitText: {
    color: '#0B0D10',
    fontSize: 15,
    fontWeight: 'bold',
    fontFamily: DLFonts.sans,
  },
});
