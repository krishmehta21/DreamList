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
  Platform,
} from 'react-native';
import { CustomAlert as Alert } from '@/components/CustomAlert';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { getCachedItems, saveCachedItems } from '@/lib/database';
import { DL, DLFonts, TIER_COLOR } from '@/constants/design';
import { createItem } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import type { Category, Tier, WishlistItem } from '@/lib/types';
import { CATEGORIES, TIERS } from '@/lib/types';
import { BackButton } from '@/components/ui/BackButton';

// Category emoji mapping
const CATEGORY_EMOJIS: Record<Category, string> = {
  Tech: '💻',
  Home: '🏡',
  Apparel: '👕',
  Books: '📚',
  Fitness: '🏋️‍♂️',
  Other: '🏷️',
};

// Retailer metadata definition
interface RetailerInfo {
  name: string;
  icon: string;
  color: string;
  badge: string;
}

function getRetailerInfo(url: string): RetailerInfo | null {
  if (!url) return null;
  const lower = url.toLowerCase();
  if (lower.includes('amazon.in') || lower.includes('amazon.com') || lower.includes('amzn.to') || lower.includes('amzn.in')) {
    return { name: 'Amazon India', icon: '📦', color: '#FF9900', badge: 'Amazon India Verified' };
  }
  if (lower.includes('flipkart.com')) {
    return { name: 'Flipkart', icon: '🛒', color: '#2874F0', badge: 'Flipkart Verified' };
  }
  if (lower.includes('ikea.com') || lower.includes('ikea.in')) {
    return { name: 'IKEA', icon: '🛋️', color: '#0058A3', badge: 'IKEA Verified Store' };
  }
  if (lower.includes('meesho.com')) {
    return { name: 'Meesho', icon: '🛍️', color: '#E0197D', badge: 'Meesho Verified' };
  }
  if (lower.includes('myntra.com')) {
    return { name: 'Myntra', icon: '👗', color: '#FF3F6C', badge: 'Myntra Fashion' };
  }
  if (lower.includes('ajio.com')) {
    return { name: 'Ajio', icon: '🧥', color: '#2C4152', badge: 'Ajio Trends' };
  }
  if (lower.includes('croma.com')) {
    return { name: 'Croma', icon: '⚡', color: '#00B5B5', badge: 'Croma Electronics' };
  }
  if (lower.includes('reliancedigital.in')) {
    return { name: 'Reliance Digital', icon: '📱', color: '#E42529', badge: 'Reliance Digital' };
  }
  if (lower.includes('tatacliq.com')) {
    return { name: 'Tata Cliq', icon: '💎', color: '#1E293B', badge: 'Tata CLiQ Luxury' };
  }
  if (lower.includes('nykaa.com')) {
    return { name: 'Nykaa', icon: '💄', color: '#FC2779', badge: 'Nykaa Beauty' };
  }
  if (lower.includes('blinkit.com')) {
    return { name: 'Blinkit', icon: '⚡', color: '#EAB308', badge: 'Blinkit Express' };
  }
  if (lower.includes('zeptonow.com')) {
    return { name: 'Zepto', icon: '🚀', color: '#8800EC', badge: 'Zepto Instant' };
  }
  try {
    const raw = url.startsWith('http') ? url : `https://${url}`;
    const hostname = raw.split('/')[2]?.replace(/^www\./, '');
    if (hostname) {
      return { name: hostname, icon: '🌐', color: '#2563EB', badge: `${hostname} Direct Link` };
    }
  } catch {}
  return null;
}

function extractNameFromUrl(url: string): string {
  try {
    const raw = url.startsWith('http') ? url : `https://${url}`;
    const path = raw.split('?')[0].split('#')[0];
    const parts = path.split('/').filter(Boolean).slice(2);
    for (const part of [...parts].reverse()) {
      if (part.length <= 2 || /^\d+$/.test(part) || ['item', 'product', 'p', 'dp'].includes(part)) continue;
      if (part.includes('-') || part.includes('_')) {
        const cleaned = part.replace(/[-_][0-9a-f]{8,}$/i, '').replace(/[-_]/g, ' ');
        const words = cleaned.split(/\s+/).filter(w => !/^\d+$/.test(w) && w.length > 1);
        if (words.length > 0) {
          return words.map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
        }
      }
    }
    if (parts.length > 0) {
      const last = parts[parts.length - 1].replace(/[-_]/g, ' ').trim();
      if (last.length > 2 && !/^\d+$/.test(last)) {
        return last.charAt(0).toUpperCase() + last.slice(1);
      }
    }
  } catch {}
  return '';
}

// Tactile button wrapper
function TactileButton({ onPress, style, children, disabled }: any) {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scale, { toValue: 0.97, useNativeDriver: true }).start();
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

export default function AddItemScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ category?: string; sharedUrl?: string; sharedText?: string }>();
  const { user } = useAuth();

  const [link, setLink] = useState(() => params.sharedUrl || '');
  const [name, setName] = useState(() => {
    if (params.sharedText) return params.sharedText;
    if (params.sharedUrl) {
      const derived = extractNameFromUrl(params.sharedUrl);
      return derived || 'Researching details...';
    }
    return '';
  });
  const [notes, setNotes] = useState('');

  const [category, setCategory] = useState<Category>(() => {
    const rawCat = params.category || 'Tech';
    const formatted = rawCat.charAt(0).toUpperCase() + rawCat.slice(1).toLowerCase();
    return (formatted as Category) || 'Tech';
  });
  const [isCustomCategory, setIsCustomCategory] = useState(false);
  const [customCategory, setCustomCategory] = useState('');
  const [tier, setTier] = useState<Tier>('soon');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Focus states for input card styling
  const [isNameFocused, setIsNameFocused] = useState(false);
  const [isLinkFocused, setIsLinkFocused] = useState(false);
  const [isNotesFocused, setIsNotesFocused] = useState(false);
  const [isCustomCatFocused, setIsCustomCatFocused] = useState(false);

  // Live retailer detection
  const detectedRetailer = useMemo(() => getRetailerInfo(link.trim()), [link]);

  const handleLinkChange = (text: string) => {
    setLink(text);
    // If the name is blank or default placeholder, attempt auto-filling from link slug
    const trimmed = text.trim();
    if (trimmed && (!name || name === 'Researching details...')) {
      const candidate = extractNameFromUrl(trimmed);
      if (candidate) {
        setName(candidate);
      }
    }
  };

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
    let finalName = name.trim();
    const trimmedLink = link.trim();

    // If no name entered, fallback to derived slug or placeholder
    if (!finalName && trimmedLink) {
      finalName = extractNameFromUrl(trimmedLink) || 'Researching details...';
    }

    if (!finalName) {
      setError('Please provide an item name or product link.');
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

    const manual_link = trimmedLink || undefined;
    const manual_notes = notes.trim() || undefined;

    setError(null);
    setSubmitting(true);

    const tempId = `temp-${Date.now()}`;
    const newItem: WishlistItem = {
      id: tempId,
      user_id: user?.id || 'temp-user',
      name: finalName,
      category: finalCategory,
      tier: tier,
      status: 'pending',
      done: false,
      manual_notes: manual_notes || null,
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

      // 3. Trigger remote creation in background
      createItem({ 
        name: finalName, 
        category: finalCategory, 
        tier, 
        manual_link,
        manual_notes,
      })
        .then((realItem) => {
          const latest = getCachedItems();
          const updated = latest.map((item) =>
            item.id === tempId ? { ...item, ...realItem } : item
          );
          saveCachedItems(updated);
        })
        .catch(() => {
          const latest = getCachedItems();
          const filtered = latest.filter((item) => item.id !== tempId);
          saveCachedItems(filtered);
          Alert.alert('Sync Failed', `Failed to save "${finalName}" on the server. Rolled back.`);
        });

    } catch (e: any) {
      setError(e.message || 'Failed to add item.');
      setSubmitting(false);
    }
  };

  return (
    <ScrollView
      style={[styles.screen, { paddingTop: insets.top + 12 }]}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 60 }]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.topRow}>
          <BackButton style={{ marginBottom: 0 }} />
          <View style={styles.badgeContainer}>
            <Text style={styles.headerEyebrow}>AI POWERED WISH</Text>
          </View>
        </View>
        <Text style={styles.title}>Add to DreamList</Text>
        <Text style={styles.subtitle}>
          Paste any store link or name. AI will crawl live pricing, photos, and specs automatically.
        </Text>
      </View>

      {/* Main Elevated Form Container */}
      <View style={styles.mainCard}>
        {/* Product Link Input */}
        <View style={styles.fieldGroup}>
          <View style={styles.labelRow}>
            <Text style={styles.fieldLabel}>PRODUCT LINK</Text>
            <Text style={styles.optionalTag}>AUTO-DETECTS RETAILER</Text>
          </View>
          
          <View
            style={[
              styles.inputContainer,
              isLinkFocused && styles.inputContainerFocused,
              detectedRetailer && { borderColor: detectedRetailer.color },
            ]}
          >
            <Text style={styles.inputPrefixIcon}>
              {detectedRetailer ? detectedRetailer.icon : '🔗'}
            </Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. https://ikea.com/... or amazon.in/..."
              placeholderTextColor={DL.subtle}
              value={link}
              onChangeText={handleLinkChange}
              autoCapitalize="none"
              keyboardType="url"
              editable={!submitting}
              onFocus={() => setIsLinkFocused(true)}
              onBlur={() => setIsLinkFocused(false)}
            />
            {link.length > 0 && (
              <Pressable onPress={() => handleLinkChange('')} hitSlop={10}>
                <View style={styles.clearCircle}>
                  <Text style={styles.clearText}>✕</Text>
                </View>
              </Pressable>
            )}
          </View>

          {/* Detected Retailer Pill */}
          {detectedRetailer ? (
            <View style={[styles.retailerBanner, { borderColor: `${detectedRetailer.color}33`, backgroundColor: `${detectedRetailer.color}0D` }]}>
              <Text style={styles.retailerBannerIcon}>{detectedRetailer.icon}</Text>
              <Text style={[styles.retailerBannerText, { color: detectedRetailer.color }]}>
                {detectedRetailer.badge} · AI will scrape INR price & photo
              </Text>
            </View>
          ) : null}
        </View>

        {/* Item Name Input */}
        <View style={styles.fieldGroup}>
          <View style={styles.labelRow}>
            <Text style={styles.fieldLabel}>ITEM NAME</Text>
            {link.length > 0 && (
              <Text style={styles.optionalTag}>AUTO-DERIVED FROM LINK</Text>
            )}
          </View>
          
          <View
            style={[
              styles.inputContainer,
              isNameFocused && styles.inputContainerFocused,
            ]}
          >
            <TextInput
              style={styles.input}
              placeholder="e.g. Sony WH-1000XM5 or Billy Bookcase"
              placeholderTextColor={DL.subtle}
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
              editable={!submitting}
              onFocus={() => setIsNameFocused(true)}
              onBlur={() => setIsNameFocused(false)}
            />
            {name.length > 0 && (
              <Pressable onPress={() => setName('')} hitSlop={10}>
                <View style={styles.clearCircle}>
                  <Text style={styles.clearText}>✕</Text>
                </View>
              </Pressable>
            )}
          </View>
        </View>

        {/* Priority Tier Selector */}
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>PRIORITY TIER</Text>
          <View style={styles.tierContainer}>
            {TIERS.map((t) => {
              const active = tier === t;
              const accentColor = TIER_COLOR[t];
              
              let tierEmoji = '✨';
              let tierSub = 'Vision / Long-term';
              if (t === 'now') {
                tierEmoji = '🔥';
                tierSub = 'Ready to buy';
              } else if (t === 'soon') {
                tierEmoji = '⏳';
                tierSub = 'Next 30–90 days';
              }

              return (
                <Pressable
                  key={t}
                  style={[
                    styles.tierCard,
                    active && {
                      borderColor: accentColor,
                      backgroundColor: `${accentColor}10`,
                    },
                  ]}
                  onPress={() => setTier(t)}
                >
                  <View style={styles.tierTopRow}>
                    <Text style={styles.tierEmoji}>{tierEmoji}</Text>
                    <Text style={[styles.tierTitle, active && { color: accentColor }]}>
                      {t.toUpperCase()}
                    </Text>
                  </View>
                  <Text style={styles.tierSubtitle}>{tierSub}</Text>
                  {active && (
                    <View style={[styles.activeIndicatorDot, { backgroundColor: accentColor }]} />
                  )}
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Category Pills */}
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>CATEGORY</Text>
          <View style={styles.pillRow}>
            {availableCategories.map((cat) => {
              const active = !isCustomCategory && category === cat;
              return (
                <Pressable
                  key={cat}
                  style={[
                    styles.categoryPill,
                    active && styles.categoryPillActive,
                  ]}
                  onPress={() => {
                    setIsCustomCategory(false);
                    setCategory(cat);
                  }}
                >
                  <Text style={styles.categoryEmoji}>
                    {CATEGORY_EMOJIS[cat as keyof typeof CATEGORY_EMOJIS] || '🏷️'}
                  </Text>
                  <Text
                    style={[
                      styles.categoryPillText,
                      active && styles.categoryPillTextActive,
                    ]}
                  >
                    {cat}
                  </Text>
                </Pressable>
              );
            })}
            
            <Pressable
              style={[
                styles.categoryPill,
                isCustomCategory && styles.categoryPillActive,
              ]}
              onPress={() => setIsCustomCategory(true)}
            >
              <Text style={styles.categoryEmoji}>✨</Text>
              <Text
                style={[
                  styles.categoryPillText,
                  isCustomCategory && styles.categoryPillTextActive,
                ]}
              >
                + Custom
              </Text>
            </Pressable>
          </View>

          {isCustomCategory && (
            <View
              style={[
                styles.inputContainer,
                { marginTop: 12 },
                isCustomCatFocused && styles.inputContainerFocused,
              ]}
            >
              <TextInput
                style={styles.input}
                placeholder="Type custom category..."
                placeholderTextColor={DL.subtle}
                value={customCategory}
                onChangeText={setCustomCategory}
                autoCapitalize="words"
                maxLength={40}
                editable={!submitting}
                onFocus={() => setIsCustomCatFocused(true)}
                onBlur={() => setIsCustomCatFocused(false)}
              />
            </View>
          )}
        </View>

        {/* Optional Notes / Target Budget */}
        <View style={[styles.fieldGroup, { marginBottom: 8 }]}>
          <View style={styles.labelRow}>
            <Text style={styles.fieldLabel}>SPECIFICATIONS / BUDGET NOTES</Text>
            <Text style={styles.optionalTag}>OPTIONAL</Text>
          </View>
          
          <View
            style={[
              styles.inputContainer,
              { height: 84, alignItems: 'flex-start', paddingTop: 10 },
              isNotesFocused && styles.inputContainerFocused,
            ]}
          >
            <TextInput
              style={[styles.input, { height: '100%', textAlignVertical: 'top' }]}
              placeholder="e.g. Size 42, Black color, max budget ₹15,000"
              placeholderTextColor={DL.subtle}
              value={notes}
              onChangeText={setNotes}
              multiline
              numberOfLines={3}
              editable={!submitting}
              onFocus={() => setIsNotesFocused(true)}
              onBlur={() => setIsNotesFocused(false)}
            />
          </View>
        </View>
      </View>

      {/* Error Banner */}
      {error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>⚠️ {error}</Text>
        </View>
      )}

      {/* Submit CTA */}
      <TactileButton
        style={styles.submitButton}
        onPress={handleSubmit}
        disabled={submitting}
      >
        {submitting ? (
          <View style={styles.submittingRow}>
            <ActivityIndicator color="#FFFFFF" size="small" />
            <Text style={styles.submitText}>Initiating AI Research...</Text>
          </View>
        ) : (
          <Text style={styles.submitText}>Add Dream & Start AI Research 🚀</Text>
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
    paddingTop: 8,
  },
  header: {
    marginBottom: 20,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  badgeContainer: {
    backgroundColor: 'rgba(37, 99, 235, 0.08)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(37, 99, 235, 0.18)',
  },
  headerEyebrow: {
    fontSize: 9,
    letterSpacing: 1.5,
    color: DL.accent,
    fontFamily: DLFonts.mono,
    fontWeight: '700',
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: DL.text,
    fontFamily: DLFonts.sans,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 13,
    color: DL.muted,
    fontFamily: DLFonts.sans,
    lineHeight: 18,
    marginTop: 4,
  },
  mainCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: DL.border,
    padding: 18,
    marginBottom: 20,
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  fieldGroup: {
    marginBottom: 20,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  fieldLabel: {
    fontSize: 10,
    letterSpacing: 1.2,
    color: DL.muted,
    fontFamily: DLFonts.mono,
    fontWeight: '600',
    marginBottom: 8,
  },
  optionalTag: {
    fontSize: 8,
    letterSpacing: 1,
    color: DL.subtle,
    fontFamily: DLFonts.mono,
    fontWeight: '600',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderColor: DL.border,
    borderWidth: 1.2,
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 52,
  },
  inputContainerFocused: {
    borderColor: DL.accent,
    backgroundColor: '#FFFFFF',
    shadowColor: DL.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 1,
  },
  inputPrefixIcon: {
    fontSize: 16,
    marginRight: 10,
  },
  input: {
    flex: 1,
    color: DL.text,
    fontSize: 15,
    fontFamily: DLFonts.sans,
    fontWeight: '500',
  },
  clearCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#E2E8F0',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 6,
  },
  clearText: {
    color: '#475569',
    fontSize: 11,
    fontWeight: 'bold',
  },
  retailerBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 8,
    gap: 8,
  },
  retailerBannerIcon: {
    fontSize: 14,
  },
  retailerBannerText: {
    fontSize: 11,
    fontWeight: '600',
    fontFamily: DLFonts.sans,
  },
  tierContainer: {
    flexDirection: 'row',
    gap: 8,
    width: '100%',
  },
  tierCard: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderColor: DL.border,
    borderWidth: 1.2,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
    position: 'relative',
  },
  tierTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  tierEmoji: {
    fontSize: 13,
  },
  tierTitle: {
    fontSize: 12,
    fontWeight: '700',
    fontFamily: DLFonts.sans,
    color: DL.text,
  },
  tierSubtitle: {
    fontSize: 9,
    color: DL.muted,
    fontFamily: DLFonts.sans,
    textAlign: 'center',
  },
  activeIndicatorDot: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderColor: DL.border,
    borderWidth: 1.2,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 6,
  },
  categoryPillActive: {
    backgroundColor: DL.accent,
    borderColor: DL.accent,
  },
  categoryEmoji: {
    fontSize: 13,
  },
  categoryPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: DL.textSecondary,
    fontFamily: DLFonts.sans,
  },
  categoryPillTextActive: {
    color: '#FFFFFF',
  },
  errorBox: {
    backgroundColor: '#FEE2E2',
    borderColor: 'rgba(239, 68, 68, 0.3)',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    color: DL.danger,
    fontSize: 12,
    fontWeight: '600',
    fontFamily: DLFonts.sans,
    textAlign: 'center',
  },
  tactileWrapper: {
    width: '100%',
  },
  submitButton: {
    backgroundColor: DL.accent,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: DL.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 3,
  },
  submittingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  submitText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    fontFamily: DLFonts.sans,
  },
});
