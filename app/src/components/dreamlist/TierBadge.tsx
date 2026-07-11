import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { Tier } from '@/lib/types';
import { TIER_COLOR, DLFonts } from '@/constants/design';

interface TierBadgeProps {
  tier: Tier;
  size?: 'sm' | 'md';
}

const SIZE_STYLES = {
  sm: { fontSize: 10, paddingHorizontal: 6, paddingVertical: 2 },
  md: { fontSize: 12, paddingHorizontal: 8, paddingVertical: 3 },
} as const;

export default function TierBadge({ tier, size = 'sm' }: TierBadgeProps) {
  const color = TIER_COLOR[tier];
  const s = SIZE_STYLES[size];

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: `${color}26`,
          paddingHorizontal: s.paddingHorizontal,
          paddingVertical: s.paddingVertical,
        },
      ]}
    >
      <Text
        style={[
          styles.label,
          { color, fontSize: s.fontSize },
        ]}
      >
        {tier.toUpperCase()}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  label: {
    fontFamily: DLFonts.mono,
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontWeight: '600',
  },
});
