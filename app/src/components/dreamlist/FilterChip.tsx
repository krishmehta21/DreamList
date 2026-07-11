import React, { useRef } from 'react';
import { Pressable, StyleSheet, Text, Animated } from 'react-native';
import { DL, DLFonts } from '@/constants/design';

interface FilterChipProps {
  label: string;
  active: boolean;
  color: string;
  onPress: () => void;
}

export default function FilterChip({ label, active, color, onPress }: FilterChipProps) {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scale, {
      toValue: 0.94,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
    }).start();
  };

  return (
    <Pressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={styles.pressable}
    >
      <Animated.View
        style={[
          styles.chip,
          { transform: [{ scale }] },
          active
            ? {
                backgroundColor: `${color}18`,
                borderColor: color,
                shadowColor: color,
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.25,
                shadowRadius: 6,
                elevation: 4,
              }
            : {
                backgroundColor: 'rgba(255, 255, 255, 0.02)',
                borderColor: DL.border,
              },
        ]}
      >
        <Text
          style={[
            styles.label,
            { color: active ? color : DL.muted },
          ]}
        >
          {label}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressable: {
    marginVertical: 4,
  },
  chip: {
    borderRadius: 24,
    borderWidth: 1.2,
    paddingHorizontal: 16,
    paddingVertical: 7,
  },
  label: {
    fontFamily: DLFonts.mono,
    textTransform: 'uppercase',
    fontSize: 10,
    letterSpacing: 1.2,
    fontWeight: '700',
  },
});
