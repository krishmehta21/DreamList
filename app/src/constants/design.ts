// DreamList Design Tokens — exact palette from scope
import { Platform } from 'react-native';

export const DL = {
  bg: '#000000',
  card: '#0C0E12',
  border: '#16191D',
  text: '#E7E9EE',
  muted: '#7E848F',
  // Nothing OS Accent Tier colors
  now: '#FF3333',
  soon: '#E7E9EE',
  dream: '#5A606C',
  // semantic
  danger: '#FF3333',
  success: '#E7E9EE',
} as const;

export const TIER_COLOR: Record<string, string> = {
  now: DL.now,
  soon: DL.soon,
  dream: DL.dream,
};

export const DLFonts = Platform.select({
  ios: { mono: 'Menlo', sans: 'System' },
  android: { mono: 'monospace', sans: 'sans-serif' },
  default: { mono: 'monospace', sans: 'System' },
})!;
