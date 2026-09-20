import React, { useEffect } from 'react';
import { View, StyleSheet, useWindowDimensions } from 'react-native';
import Svg, { Path, Polygon, G, Circle, Rect, Text as SvgText } from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedProps,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { DL, DLFonts } from '@/constants/design';

interface IcebergRendererProps {
  percentRemaining: number; // 0 to 100 (for float height)
  healthScore: number; // 0 to 100 (for size, tilt, and status)
  vaultBalance: number;
  goalsTargetSum: number;
}

const AnimatedG = Animated.createAnimatedComponent(G);

export const IcebergRenderer: React.FC<IcebergRendererProps> = ({
  percentRemaining,
  healthScore,
  vaultBalance,
  goalsTargetSum,
}) => {
  const { width: windowWidth } = useWindowDimensions();
  const containerWidth = windowWidth - 40;
  const containerHeight = 280;

  // Animation values
  const bobbingValue = useSharedValue(0);
  const icebergScale = useSharedValue(1);
  const icebergRotation = useSharedValue(0);
  const floatY = useSharedValue(containerHeight);

  // Initialize gentle bobbing animation (sinusoidal loop)
  useEffect(() => {
    bobbingValue.value = withRepeat(
      withTiming(6, {
        duration: 2500,
        easing: Easing.inOut(Easing.sin),
      }),
      -1,
      true
    );
  }, [bobbingValue]);

  // Adjust iceberg visual properties based on health score and remaining budget
  useEffect(() => {
    // 1. Scale decreases as health drops (normal, caution, danger)
    let targetScale = 1.0;
    let targetRotation = 0; // in degrees

    if (healthScore < 50) {
      targetScale = 0.65; // shrunken / melted
      targetRotation = 12; // tilted in distress
    } else if (healthScore < 80) {
      targetScale = 0.85; // slightly shrunken
      targetRotation = 4; // slight tilt
    }

    icebergScale.value = withTiming(targetScale, { duration: 1000 });
    icebergRotation.value = withTiming(targetRotation, { duration: 1000 });

    // 2. Synchronize floating height with liquid levels
    const clampedPercent = Math.max(0, Math.min(100, percentRemaining));
    
    // Map percentage to target Y (centered around liquid level)
    const liquidY = containerHeight - (clampedPercent / 100) * (containerHeight - 40);
    
    // Iceberg sits centered on the waterline (y-offset of -95px balances above/below water graphics)
    const targetFloatY = liquidY - 95;

    floatY.value = withTiming(targetFloatY, {
      duration: 1000,
      easing: Easing.out(Easing.quad),
    });
  }, [percentRemaining, healthScore, floatY, icebergScale, icebergRotation]);

  // Animated styling combining float level, bobbing offset, scale, and tilt rotation
  const animatedIcebergStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { translateY: floatY.value + bobbingValue.value },
        { scale: icebergScale.value },
        { rotate: `${icebergRotation.value}deg` },
      ],
    };
  });

  return (
    <View style={[StyleSheet.absoluteFill, styles.overlayContainer]} pointerEvents="none">
      <Animated.View style={[styles.icebergWrapper, animatedIcebergStyle]}>
        <Svg width={300} height={200} viewBox="0 0 300 200">
          <G>
            {/* Tip pointer line & text */}
            <Path
              d="M 140,25 L 85,25"
              stroke="#10B981"
              strokeWidth="1"
              strokeDasharray="2,2"
              opacity="0.8"
            />
            <SvgText
              x="80"
              y="28"
              fill="#10B981"
              fontSize="10"
              fontWeight="bold"
              fontFamily={DLFonts.mono}
              textAnchor="end"
            >
              ₹{vaultBalance.toLocaleString('en-IN')} PROTECTED
            </SvgText>

            {/* Base pointer line & text */}
            <Path
              d="M 185,110 L 215,110"
              stroke="#38BDF8"
              strokeWidth="1"
              strokeDasharray="2,2"
              opacity="0.8"
            />
            <SvgText
              x="220"
              y="113"
              fill="#38BDF8"
              fontSize="10"
              fontWeight="bold"
              fontFamily={DLFonts.mono}
              textAnchor="start"
            >
              TARGETS: ₹{goalsTargetSum.toLocaleString('en-IN')}
            </SvgText>

            <G transform="translate(60, 0)">
              {/* Translucent Deep ocean depth container below waterline (y=35) */}
              <Rect
                x={5}
                y={35}
                width={170}
                height={160}
                fill="#0A141D"
                opacity={0.65}
                rx={12}
              />

              {/* BELOW WATER (Submerged Body) - Large Submerged Mass (Ratio ~1:7) */}
              <Polygon
                points="75,35 105,35 155,75 145,135 90,185 35,135 25,75"
                fill="#0284C7"
                opacity={0.5}
                stroke="#0EA5E9"
                strokeWidth={1.5}
              />
              {/* Below water facets for 3D polygonal texture */}
              <Polygon
                points="75,35 90,35 90,185 35,135 25,75"
                fill="#0369a1"
                opacity={0.4}
              />
              <Polygon
                points="90,35 105,35 155,75 145,135 90,185"
                fill="#0c4a6e"
                opacity={0.35}
              />

              {/* ABOVE WATER (Iceberg Tip) - Small Visible wealth above y=35 */}
              {/* Left/Light Facet */}
              <Polygon
                points="90,10 90,35 75,35"
                fill="#E0F2FE"
                stroke="#E0F2FE"
                strokeWidth={0.5}
              />
              {/* Right/Shadow Facet */}
              <Polygon
                points="90,10 105,35 90,35"
                fill="#BAE6FD"
                stroke="#BAE6FD"
                strokeWidth={0.5}
              />
              
              {/* Extra facet details for premium vector polish */}
              <Polygon
                points="90,10 82,35 90,35"
                fill="#F0F9FF"
                opacity={0.75}
              />
              <Polygon
                points="90,10 97,35 90,35"
                fill="#7DD3FC"
                opacity={0.45}
              />

              {/* Solid vibrant waterline split */}
              <Path
                d="M5 35 L175 35"
                stroke="#38BDF8"
                strokeWidth={3}
                opacity={0.9}
              />
            </G>
          </G>
        </Svg>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  overlayContainer: {
    justifyContent: 'flex-start',
    alignItems: 'center',
    position: 'absolute',
  },
  icebergWrapper: {
    width: 300,
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
