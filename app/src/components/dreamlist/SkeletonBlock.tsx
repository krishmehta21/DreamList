import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, ViewStyle } from 'react-native';
import { DL } from '@/constants/design';

interface SkeletonBlockProps {
  width?: number | string;
  height?: number;
  style?: ViewStyle;
}

export default function SkeletonBlock({
  width = '100%',
  height = 14,
  style,
}: SkeletonBlockProps) {
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.7,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.3,
          duration: 500,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        styles.block,
        { width: width as any, height, opacity },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  block: {
    backgroundColor: DL.border,
    borderRadius: 4,
  },
});
