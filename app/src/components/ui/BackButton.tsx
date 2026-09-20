import React from 'react';
import { Pressable, Text, StyleSheet, ViewStyle } from 'react-native';
import { useRouter } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { DL, DLFonts } from '@/constants/design';

interface BackButtonProps {
  onPress?: () => void;
  label?: string;
  style?: ViewStyle;
}

export function BackButton({ onPress, label, style }: BackButtonProps) {
  const router = useRouter();

  const handlePress = () => {
    if (onPress) {
      onPress();
    } else {
      router.back();
    }
  };

  return (
    <Pressable
      style={({ pressed }) => [styles.btn, pressed && styles.btnPressed, style]}
      onPress={handlePress}
      hitSlop={12}
    >
      <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
        <Path
          d="M15 19L8 12L15 5"
          stroke={DL.text}
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
      {label ? <Text style={styles.label}>{label}</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 7,
    alignSelf: 'flex-start',
  },
  btnPressed: {
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    transform: [{ scale: 0.97 }],
  },
  label: {
    fontFamily: DLFonts.mono,
    fontSize: 11,
    fontWeight: '700',
    color: DL.text,
    letterSpacing: 1,
  },
});
