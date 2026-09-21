import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import Svg, { Path, Polygon, G, Circle, Rect, Line } from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { DL, DLFonts } from '@/constants/design';

interface IcebergRendererProps {
  percentRemaining: number;
  healthScore: number;
  vaultBalance: number;
  goalsTargetSum: number;
}

export const IcebergRenderer: React.FC<IcebergRendererProps> = ({
  percentRemaining,
  healthScore,
  vaultBalance,
  goalsTargetSum,
}) => {
  // Gentle bobbing animation
  const bobbing = useSharedValue(0);

  useEffect(() => {
    bobbing.value = withRepeat(
      withTiming(4, {
        duration: 2600,
        easing: Easing.inOut(Easing.sin),
      }),
      -1,
      true
    );
  }, [bobbing]);

  const animatedIcebergStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateY: bobbing.value }],
    };
  });

  const totalWealth = Math.max(1, vaultBalance + goalsTargetSum);
  const deepRatio = Math.round((vaultBalance / totalWealth) * 100);

  return (
    <View style={styles.cardContainer}>
      {/* Aquatic Canvas */}
      <View style={styles.aquaticStage}>
        {/* Sky to Sea Gradient */}
        <LinearGradient
          colors={['#F8FAFC', '#E0F2FE', '#BAE6FD', '#7DD3FC']}
          locations={[0, 0.28, 0.45, 1]}
          style={StyleSheet.absoluteFill}
        />

        {/* Floating Clouds / Light Rays */}
        <View style={styles.sunGlow} />

        {/* Animated Iceberg Svg */}
        <Animated.View style={[styles.icebergWrap, animatedIcebergStyle]}>
          <Svg width="220" height="150" viewBox="0 0 220 150" fill="none">
            {/* ─── Above Water Tip (Surface Wealth) ─── */}
            {/* Tip Facet 1 (Left bright face) */}
            <Polygon
              points="110,14 74,48 110,48"
              fill="#FFFFFF"
              stroke="#E2E8F0"
              strokeWidth={1}
            />
            {/* Tip Facet 2 (Right shaded face) */}
            <Polygon
              points="110,14 110,48 144,48"
              fill="#E0F2FE"
              stroke="#CBD5E1"
              strokeWidth={1}
            />
            {/* Tip Peak Highlight */}
            <Polygon
              points="110,14 98,34 110,34"
              fill="#FFFFFF"
            />

            {/* ─── Waterline Surface Glow & Ripple ─── */}
            <Line
              x1="18"
              y1="48"
              x2="202"
              y2="48"
              stroke="#0284C7"
              strokeWidth={2.5}
              strokeLinecap="round"
              opacity={0.85}
            />
            <Line
              x1="36"
              y1="52"
              x2="184"
              y2="52"
              stroke="#38BDF8"
              strokeWidth={1.2}
              strokeDasharray="4,6"
              opacity={0.6}
            />

            {/* ─── Below Water Mass (Submerged Vault) ─── */}
            {/* Deep Undersea Silhouette Shadow */}
            <Polygon
              points="74,48 144,48 184,92 168,138 110,146 52,138 36,92"
              fill="#0284C7"
              opacity={0.25}
            />
            {/* Submerged Facet Left Outer */}
            <Polygon
              points="74,48 110,48 88,110 52,138 36,92"
              fill="#0284C7"
              opacity={0.7}
              stroke="#0369A1"
              strokeWidth={1}
            />
            {/* Submerged Facet Left Center */}
            <Polygon
              points="110,48 110,146 88,110"
              fill="#0369A1"
              opacity={0.85}
              stroke="#075985"
              strokeWidth={1}
            />
            {/* Submerged Facet Right Center */}
            <Polygon
              points="110,48 144,48 132,110 110,146"
              fill="#0284C7"
              opacity={0.9}
              stroke="#0369A1"
              strokeWidth={1}
            />
            {/* Submerged Facet Right Outer */}
            <Polygon
              points="144,48 184,92 168,138 110,146 132,110"
              fill="#075985"
              opacity={0.75}
              stroke="#0C4A6E"
              strokeWidth={1}
            />
          </Svg>
        </Animated.View>

        {/* Surface Pointer Callout */}
        <View style={styles.surfaceTag}>
          <Text style={styles.tagEmoji}>💧</Text>
          <View>
            <Text style={styles.tagLabel}>SURFACE CASH</Text>
            <Text style={styles.tagAmount}>
              ₹{Math.round(goalsTargetSum || 0).toLocaleString('en-IN')}
            </Text>
          </View>
        </View>

        {/* Submerged Pointer Callout */}
        <View style={styles.deepTag}>
          <Text style={styles.tagEmoji}>🛡️</Text>
          <View>
            <Text style={styles.tagLabel}>LOCKED VAULT</Text>
            <Text style={[styles.tagAmount, { color: '#0369A1' }]}>
              ₹{Math.round(vaultBalance).toLocaleString('en-IN')}
            </Text>
          </View>
        </View>
      </View>

      {/* Insight Footer */}
      <View style={styles.icebergFooter}>
        <View style={styles.footerCol}>
          <Text style={styles.footerLabel}>DEEP WEALTH RATIO</Text>
          <Text style={styles.footerValue}>{vaultBalance > 0 ? `${deepRatio}%` : '0%'}</Text>
        </View>

        <View style={styles.footerDivider} />

        <View style={styles.footerCol}>
          <Text style={styles.footerLabel}>LIQUID HORIZON</Text>
          <Text style={[styles.footerValue, { color: '#10B981' }]}>
            {vaultBalance > 10000 ? 'Secured' : 'Building'}
          </Text>
        </View>

        <View style={styles.footerDivider} />

        <View style={styles.footerCol}>
          <Text style={styles.footerLabel}>FINANCIAL HEALTH</Text>
          <Text style={[styles.footerValue, { color: healthScore >= 80 ? '#10B981' : '#F59E0B' }]}>
            {healthScore}%
          </Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  cardContainer: {
    width: '100%',
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(226, 232, 240, 0.9)',
    backgroundColor: '#FFFFFF',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 14,
    elevation: 4,
    marginTop: 8,
  },
  aquaticStage: {
    height: 175,
    width: '100%',
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  sunGlow: {
    position: 'absolute',
    top: -20,
    width: 140,
    height: 70,
    borderRadius: 70,
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
  },
  icebergWrap: {
    width: 220,
    height: 150,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Floating Callout Tags
  surfaceTag: {
    position: 'absolute',
    top: 12,
    left: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(226, 232, 240, 0.8)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  deepTag: {
    position: 'absolute',
    bottom: 12,
    right: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(2, 132, 199, 0.25)',
    shadowColor: '#0284C7',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  tagEmoji: {
    fontSize: 14,
  },
  tagLabel: {
    fontFamily: DLFonts.mono,
    fontSize: 8.5,
    fontWeight: '700',
    color: '#64748B',
    letterSpacing: 0.8,
  },
  tagAmount: {
    fontFamily: DLFonts.sans,
    fontSize: 11.5,
    fontWeight: '800',
    color: '#0F172A',
  },

  // Footer Row
  icebergFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  footerCol: {
    flex: 1,
    alignItems: 'center',
  },
  footerLabel: {
    fontFamily: DLFonts.mono,
    fontSize: 8.5,
    fontWeight: '700',
    color: '#64748B',
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  footerValue: {
    fontFamily: DLFonts.sans,
    fontSize: 13.5,
    fontWeight: '800',
    color: '#0F172A',
  },
  footerDivider: {
    width: 1,
    height: 22,
    backgroundColor: '#E2E8F0',
  },
});
