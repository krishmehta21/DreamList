import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, LayoutChangeEvent } from 'react-native';
import { useSharedValue, withTiming, Easing } from 'react-native-reanimated';
import { WaveFill } from './WaveFill';
import { DLFonts } from '../constants/design';

interface ReservoirRendererProps {
  spendableCash: number;
  totalIncome: number;
  themeName?: string;
}

export const ReservoirRenderer: React.FC<ReservoirRendererProps> = ({
  spendableCash,
  totalIncome,
}) => {
  const [dimensions, setDimensions] = useState({ width: 0, height: 210 });
  const animatedFill = useSharedValue(0);

  const isZeroIncome = totalIncome === 0;
  const isOverdrawn = spendableCash < 0;

  let targetPercent = 0;
  if (totalIncome > 0) {
    targetPercent = Math.max(0, Math.min((spendableCash / totalIncome) * 100, 100));
  }

  useEffect(() => {
    animatedFill.value = withTiming(targetPercent, {
      duration: 900,
      easing: Easing.out(Easing.cubic),
    });
  }, [targetPercent]);

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (width > 0 && height > 0) {
      setDimensions({ width, height });
    }
  };

  const formattedSpendable = spendableCash.toLocaleString('en-IN');
  const formattedIncome = totalIncome.toLocaleString('en-IN');
  const waveColor = isOverdrawn ? '#EF4444' : '#10B981';

  return (
    <View style={styles.tankOuter} onLayout={onLayout}>
      {/* Animated Wave Fluid Fill */}
      {dimensions.width > 0 && (
        <WaveFill
          width={dimensions.width}
          height={dimensions.height}
          fillPercent={animatedFill}
          color={waveColor}
        />
      )}

      {/* Surface Liquid Glow Line */}
      <View
        style={[
          styles.ambientGlow,
          { backgroundColor: isOverdrawn ? 'rgba(239, 68, 68, 0.06)' : 'rgba(16, 185, 129, 0.05)' },
        ]}
      />

      {/* ONE Centered Label — Zero overlapping text */}
      <View style={styles.tankLabelWrap} pointerEvents="none">
        <Text
          style={[
            styles.tankLabelAmount,
            isOverdrawn && { color: '#EF4444' },
          ]}
          numberOfLines={1}
          adjustsFontSizeToFit
        >
          ₹{formattedSpendable}
        </Text>
        <Text style={styles.tankLabelSub}>
          {isZeroIncome
            ? 'No income logged yet this cycle'
            : `REMAINING OF ₹${formattedIncome}`}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  tankOuter: {
    height: 190,
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderColor: 'rgba(0, 0, 0, 0.06)',
    borderWidth: 1,
    borderRadius: 22,
    overflow: 'hidden',
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
  },
  ambientGlow: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
  },
  tankLabelWrap: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    zIndex: 10,
  },
  tankLabelAmount: {
    fontFamily: DLFonts.mono,
    fontSize: 38,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: -1,
    textAlign: 'center',
  },
  tankLabelSub: {
    fontFamily: DLFonts.mono,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 6,
  },
});
