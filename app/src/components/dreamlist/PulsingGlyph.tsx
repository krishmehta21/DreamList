import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Easing } from 'react-native';
import { DL } from '@/constants/design';

interface PulsingGlyphProps {
  status: 'pending' | 'researching' | 'ready' | 'failed';
  onAnimationComplete?: () => void;
}

export default function PulsingGlyph({ status, onAnimationComplete }: PulsingGlyphProps) {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const opacityAnim = useRef(new Animated.Value(0.6)).current;
  
  const [visible, setVisible] = useState(status === 'pending' || status === 'researching');
  const prevStatus = useRef(status);
  const pulseLoop = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    // 1. Loop pulse animation helper
    const startPulse = () => {
      pulseAnim.setValue(1);
      opacityAnim.setValue(0.6);
      
      pulseLoop.current = Animated.loop(
        Animated.parallel([
          Animated.sequence([
            Animated.timing(pulseAnim, {
              toValue: 1.35,
              duration: 750,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: true,
            }),
            Animated.timing(pulseAnim, {
              toValue: 1.0,
              duration: 750,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: true,
            }),
          ]),
          Animated.sequence([
            Animated.timing(opacityAnim, {
              toValue: 1.0,
              duration: 750,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: true,
            }),
            Animated.timing(opacityAnim, {
              toValue: 0.4,
              duration: 750,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: true,
            }),
          ]),
        ])
      );
      pulseLoop.current.start();
    };

    if (status === 'pending' || status === 'researching') {
      setVisible(true);
      startPulse();
    } else if (
      (prevStatus.current === 'pending' || prevStatus.current === 'researching') &&
      status === 'ready'
    ) {
      // 2. Play transition flash scale-up on completing research
      if (pulseLoop.current) {
        pulseLoop.current.stop();
      }
      
      pulseAnim.setValue(1.0);
      opacityAnim.setValue(1.0);
      
      Animated.parallel([
        Animated.timing(pulseAnim, {
          toValue: 2.2,
          duration: 350,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0,
          duration: 350,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      ]).start(() => {
        setVisible(false);
        if (onAnimationComplete) {
          onAnimationComplete();
        }
      });
    } else {
      // Immediate hide for failed or other unhandled states
      setVisible(false);
      if (pulseLoop.current) {
        pulseLoop.current.stop();
      }
    }
    
    prevStatus.current = status;
    
    return () => {
      if (pulseLoop.current) {
        pulseLoop.current.stop();
      }
    };
  }, [status]);

  if (!visible) return null;

  return (
    <Animated.View
      style={[
        styles.glyph,
        {
          transform: [{ scale: pulseAnim }],
          opacity: opacityAnim,
        },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  glyph: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: DL.dream, // Violet accent color
  },
});
