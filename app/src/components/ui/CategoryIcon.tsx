import React from 'react';
import { Text, View, StyleSheet } from 'react-native';

const ICON_MAP: Record<string, string> = {
  // Common name mappings
  utensils: '🍔',
  food: '🍔',
  dining: '🍽️',
  restaurant: '🍽️',
  grocery: '🛒',
  coffee: '☕',
  car: '🚗',
  transport: '🚗',
  commute: '🚇',
  travel: '✈️',
  fuel: '⛽',
  shoppingbag: '🛍️',
  shopping: '🛍️',
  apparel: '👕',
  clothes: '👕',
  creditcard: '💳',
  bills: '💳',
  utilities: '⚡',
  rent: '🏠',
  home: '🏠',
  tv: '📺',
  entertainment: '🎬',
  gamepad: '🎮',
  games: '🎮',
  heart: '❤️',
  health: '🏥',
  medical: '💊',
  fitness: '🏋️',
  coins: '🪙',
  other: '🏷️',
  general: '🏷️',
  banknote: '💵',
  salary: '💵',
  income: '💰',
  laptop: '💻',
  tech: '💻',
  freelance: '💻',
  gift: '🎁',
  rotateccw: '🔄',
  refund: '🔄',
  pluscircle: '➕',
  book: '📚',
  education: '🎓',
  briefcase: '💼',
  work: '💼',
  wrench: '🔧',
  shield: '🛡️',
  savings: '🛡️',
  vault: '🔒',
};

interface CategoryIconProps {
  icon?: string | null;
  name?: string | null;
  size?: number;
  fontSize?: number;
  backgroundColor?: string;
}

export function getCategoryEmoji(icon?: string | null, name?: string | null): string {
  // If icon is already a single emoji (or contains emoji), return it
  if (icon && /\p{Extended_Pictographic}/u.test(icon)) {
    return icon;
  }

  // Check normalized icon key
  if (icon) {
    const key = icon.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (ICON_MAP[key]) return ICON_MAP[key];
  }

  // Check category name key
  if (name) {
    const key = name.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (ICON_MAP[key]) return ICON_MAP[key];
    // Substring checks
    for (const [k, emoji] of Object.entries(ICON_MAP)) {
      if (key.includes(k)) return emoji;
    }
  }

  return '🏷️';
}

export function CategoryIcon({
  icon,
  name,
  size = 36,
  fontSize = 17,
  backgroundColor = '#F1F5F9',
}: CategoryIconProps) {
  const emoji = getCategoryEmoji(icon, name);

  return (
    <View
      style={[
        styles.wrap,
        {
          width: size,
          height: size,
          borderRadius: Math.round(size * 0.28),
          backgroundColor,
        },
      ]}
    >
      <Text style={[styles.emoji, { fontSize }]}>{emoji}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: {
    textAlign: 'center',
    includeFontPadding: false,
  },
});
