import React, { useEffect, useRef, useMemo, useCallback } from 'react';
import { Pressable, StyleSheet, Text, View, Animated } from 'react-native';
import { Image } from 'expo-image';
import type { WishlistItem } from '@/lib/types';
import { DL, DLFonts, TIER_COLOR } from '@/constants/design';
import PulsingGlyph from './PulsingGlyph';

interface ItemCardProps {
  item: WishlistItem;
  onPress: (item: WishlistItem) => void;
  onToggleDone: (id: string, done: boolean) => void;
  onRetryResearch?: (id: string) => void;
}

function ItemCard({ item, onPress, onToggleDone, onRetryResearch }: ItemCardProps) {
  const showResearching = item.status === 'pending' || item.status === 'researching';

  // Animation values
  const rowOpacity = useRef(new Animated.Value(item.done ? 0.5 : 1)).current;
  const checkboxScale = useRef(new Animated.Value(item.done ? 1 : 0)).current;

  // Sync animation when done state changes
  useEffect(() => {
    Animated.parallel([
      Animated.spring(checkboxScale, {
        toValue: item.done ? 1 : 0,
        useNativeDriver: true,
        tension: 180,
        friction: 8,
      }),
      Animated.timing(rowOpacity, {
        toValue: item.done ? 0.45 : 1,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
  }, [item.done]);

  // Interpolate dot scale
  const dotScaleStyle = {
    transform: [{ scale: checkboxScale }],
    opacity: checkboxScale,
  };

  // Get lowest price if available - memoized to prevent recomputation on scroll frames
  const lowestPrice = useMemo(() => {
    if (!item.prices || item.prices.length === 0) return null;
    return Math.min(...item.prices.map((p) => Number(p.price)));
  }, [item.prices]);

  // Get product image URL if available - memoized to prevent recomputation on scroll frames
  const imageUrl = useMemo(() => {
    if (item.research && item.research.length > 0) {
      return item.research[0].image_url || null;
    }
    return null;
  }, [item.research]);

  // Stable callbacks to avoid inline function prop creation
  const handlePress = useCallback(() => {
    onPress(item);
  }, [item, onPress]);

  const handleCheckboxPress = useCallback(() => {
    onToggleDone(item.id, !item.done);
  }, [item.id, item.done, onToggleDone]);

  const handleRetryPress = useCallback(() => {
    if (onRetryResearch) {
      onRetryResearch(item.id);
    }
  }, [item.id, onRetryResearch]);

  // Memoized style to prevent recreation on every render pass
  const accentBarStyle = useMemo(() => [
    styles.accentBar,
    {
      backgroundColor: TIER_COLOR[item.tier] || DL.text,
    },
  ], [item.tier]);

  return (
    <Animated.View style={[styles.rowContainer, { opacity: rowOpacity }]}>
      <Pressable onPress={handlePress} style={styles.pressableRow}>
        
        {/* Per-Row Accent Bar (Distinctly separated via absolute centering) */}
        <View style={accentBarStyle} />

        {/* 1. Tucked Checkbox (Leading Element) */}
        <Pressable
          onPress={handleCheckboxPress}
          style={[
            styles.checkbox,
            item.done ? styles.checkboxActive : styles.checkboxInactive,
          ]}
          hitSlop={8}
        >
          <Animated.View style={[styles.checkboxDot, dotScaleStyle]} />
        </Pressable>

        {/* 2. 40x40 Thumbnail (Real image only - collapses space if empty) */}
        {imageUrl ? (
          <View style={styles.thumbnailContainer}>
            <Image
              source={{ uri: imageUrl }}
              style={styles.thumbnail}
              contentFit="cover"
              transition={200}
            />
          </View>
        ) : null}

        {/* 3. Title + Subline Stack */}
        <View style={styles.textStack}>
          <Text
            style={[
              styles.name,
              item.done && styles.nameDone,
            ]}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {item.name}
          </Text>
          <Text style={styles.subline}>
            {`${item.category} · ${item.tier.charAt(0).toUpperCase() + item.tier.slice(1)}`}
          </Text>
        </View>

        {/* 4. Right Price / Status Column */}
        <View style={styles.rightColumn}>
          {/* Render price / failed status when not researching */}
          {!showResearching && (
            item.status === 'failed' ? (
              <Pressable
                onPress={handleRetryPress}
                style={styles.retryButton}
                hitSlop={12}
              >
                <Text style={styles.statusFailed}>RETRY 🔄</Text>
              </Pressable>
            ) : lowestPrice !== null ? (
              <Text style={styles.priceText}>
                ₹{lowestPrice.toLocaleString('en-IN')}
              </Text>
            ) : (
              <Text style={styles.statusMuted}>no price</Text>
            )
          )}
          
          {/* Pulsing research glyph (positioned absolute when price shows, relative when not) */}
          <View style={showResearching ? styles.glyphRelative : styles.glyphAbsolute}>
            <PulsingGlyph status={item.status} />
          </View>
        </View>

      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  rowContainer: {
    backgroundColor: DL.card,
    position: 'relative',
  },
  pressableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  accentBar: {
    position: 'absolute',
    left: 0,
    top: 4,
    bottom: 4,
    width: 3,
    borderTopRightRadius: 1.5,
    borderBottomRightRadius: 1.5,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.2,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    marginLeft: 4, // slight inset to make space for accent bar
  },
  checkboxInactive: {
    borderColor: '#4A4F59',
    backgroundColor: 'transparent',
  },
  checkboxActive: {
    borderColor: '#E7E9EE',
    backgroundColor: 'transparent',
  },
  checkboxDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#E7E9EE',
  },
  thumbnailContainer: {
    width: 40,
    height: 40,
    borderRadius: 6,
    overflow: 'hidden',
    backgroundColor: '#0B0D10', // same dark surface as screen background
    borderColor: DL.border, // app's existing divider color
    borderWidth: 0.5,
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbnail: {
    width: '100%',
    height: '100%',
  },
  textStack: {
    flex: 1,
    minWidth: 0,
    marginRight: 12,
    justifyContent: 'center',
  },
  name: {
    fontFamily: DLFonts.sans,
    color: '#FFFFFF', // pure white for maximum pop/emphasis
    fontSize: 15,
    fontWeight: '600', // bold to act as the primary visual anchor
    marginBottom: 2,
  },
  nameDone: {
    textDecorationLine: 'line-through',
    color: '#5A606C',
  },
  subline: {
    fontFamily: DLFonts.mono,
    color: '#7E848F', // clearly secondary/muted
    fontSize: 10.5,
  },
  rightColumn: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    flexShrink: 0,
  },
  priceText: {
    fontFamily: DLFonts.mono,
    color: '#F2B84B', // distinct gold color to stand out without competing with title weight
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 2,
    textShadowColor: 'rgba(242, 184, 75, 0.25)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 4,
  },
  statusMuted: {
    fontFamily: DLFonts.mono,
    color: '#5A606C',
    fontSize: 11,
  },
  retryButton: {
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderRadius: 4,
    backgroundColor: '#1C1315',
  },
  statusFailed: {
    fontFamily: DLFonts.mono,
    color: '#FF3333',
    fontSize: 11,
    fontWeight: 'bold',
  },
  glyphRelative: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingRight: 6,
  },
  glyphAbsolute: {
    position: 'absolute',
    right: 6,
    top: '50%',
    marginTop: -3.5,
    zIndex: 10,
  },
});

export default React.memo(ItemCard);
