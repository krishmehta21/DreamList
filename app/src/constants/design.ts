// DreamList Design Tokens — Luminous Bluish-White Fintech Palette
import { Platform } from 'react-native';

export const DL = {
  bg: '#F0F4FC',            // Soft luminous bluish-white canvas
  card: '#FFFFFF',          // Pure elevated white cards
  cardAlt: '#F8FAFC',       // Subtle tinted surface
  border: 'rgba(226, 232, 240, 0.8)',
  borderLight: 'rgba(226, 232, 240, 0.5)',
  text: '#0B132B',          // Deep midnight slate (high contrast, ultra clean)
  textSecondary: '#334155',
  muted: '#64748B',         // Refined slate gray
  subtle: '#94A3B8',
  // Credit Card & Active Nav Gradient (exact match to picture 2)
  accent: '#2563EB',        // Electric Blue
  cyan: '#06B6D4',          // Vibrant Cyan
  purple: '#7C3AED',        // Royal Purple
  gradientStart: '#06B6D4',
  gradientMid: '#4F46E5',
  gradientEnd: '#A855F7',
  cardGradient: ['#06B6D4', '#4F46E5', '#A855F7'] as const,
  cardGradientLight: ['#38BDF8', '#6366F1', '#C084FC'] as const,
  navGradient: ['#06B6D4', '#4F46E5', '#A855F7'] as const,
  // Semantic
  danger: '#EF4444',
  success: '#10B981',
  warning: '#F59E0B',
  info: '#06B6D4',
  // DreamList Tiers
  now: '#EF4444',
  soon: '#F59E0B',
  dream: '#64748B',
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
