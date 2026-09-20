import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, Vibration } from 'react-native';
import Svg, { Path, Polygon, G, Circle, Defs, RadialGradient, Stop } from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
  Easing,
  runOnJS,
} from 'react-native-reanimated';
import { DL, DLFonts } from '@/constants/design';
import { BalloonParticle } from './BalloonParticle';

interface FuneralBalloonProps {
  amount: number;
  note: string;
  categoryName?: string;
  onPop: () => void;
  onPopStart: () => void;
}

const CATEGORY_EMOJIS: Record<string, string> = {
  food: '🍔',
  transport: '🚗',
  shopping: '🛍️',
  bills: '💳',
  entertainment: '🎮',
  health: '💊',
  drinks: '🍺',
  other: '🪙',
};

export const FuneralBalloon: React.FC<FuneralBalloonProps> = ({
  amount,
  note,
  categoryName = 'other',
  onPop,
  onPopStart,
}) => {
  const emoji = CATEGORY_EMOJIS[categoryName.toLowerCase()] || '⚱️';
  
  // Size calculations (scale proportional to amount)
  const scaleFactor = Math.min(1.25, Math.max(0.85, 0.85 + (amount / 4000)));
  const baseWidth = 80;
  const baseHeight = 100;
  const balloonWidth = baseWidth * scaleFactor;
  const balloonHeight = baseHeight * scaleFactor;

  // Animation states
  const [phase, setPhase] = useState<'idle' | 'pop'>('idle');
  const [showFloatingText, setShowFloatingText] = useState(false);
  const [particlesActive, setParticlesActive] = useState(false);

  // Reanimated shared values
  const floatY = useSharedValue(0);
  const rotateDeg = useSharedValue(0);
  const scaleX = useSharedValue(1);
  const scaleY = useSharedValue(1);
  const opacity = useSharedValue(1);
  
  // Floating text values
  const textTranslateY = useSharedValue(0);
  const textOpacity = useSharedValue(1);

  // Particles config
  const PARTICLE_COUNT = 10;
  const [particles] = useState(() => {
    return Array.from({ length: PARTICLE_COUNT }).map((_, idx) => {
      const angle = (idx / PARTICLE_COUNT) * 2 * Math.PI + (Math.random() * 0.4 - 0.2);
      const speed = 40 + Math.random() * 50;
      return {
        id: idx,
        dx: Math.cos(angle) * speed,
        dy: Math.sin(angle) * speed - 20, // upward bias
      };
    });
  });

  // Initialize idle floating animation on mount
  useEffect(() => {
    // Randomize duration and delay to prevent synchronized mechanical movement
    const floatDuration = 2000 + Math.random() * 1200;
    const rotateDuration = 2500 + Math.random() * 1500;
    const floatDistance = 4 + Math.random() * 4;
    const rotateMax = 2 + Math.random() * 3;

    floatY.value = withRepeat(
      withTiming(floatDistance, {
        duration: floatDuration,
        easing: Easing.inOut(Easing.sin),
      }),
      -1,
      true
    );

    rotateDeg.value = withRepeat(
      withTiming(rotateMax, {
        duration: rotateDuration,
        easing: Easing.inOut(Easing.sin),
      }),
      -1,
      true
    );
  }, []);

  const handlePopPress = () => {
    if (phase !== 'idle') return;
    setPhase('pop');

    // Notify parent immediately to start counter countdown
    runOnJS(onPopStart)();

    // Trigger vibration feedback
    Vibration.vibrate(40);

    // 1. Squash Anticipation (0 - 100ms)
    scaleX.value = withTiming(1.22, { duration: 100, easing: Easing.linear });
    scaleY.value = withTiming(0.80, { duration: 100, easing: Easing.linear });

    // 2. Burst and Scatter Particles (100ms +)
    setTimeout(() => {
      // Scale balloon up quickly then make invisible
      scaleX.value = withTiming(1.3, { duration: 50 });
      scaleY.value = withTiming(1.3, { duration: 50 });
      opacity.value = withTiming(0, { duration: 50 });

      // Start particles & float up text
      setParticlesActive(true);
      setShowFloatingText(true);

      // Float up text animation
      textTranslateY.value = withTiming(-80, { duration: 600, easing: Easing.out(Easing.quad) });
      textOpacity.value = withTiming(0, { duration: 600 });

      // Complete pop sequence
      setTimeout(() => {
        runOnJS(onPop)();
      }, 550);
    }, 100);
  };

  const animatedStyle = useAnimatedStyle(() => {
    return {
      opacity: opacity.value,
      transform: [
        { translateY: floatY.value },
        { rotate: `${rotateDeg.value}deg` },
        { scaleX: scaleX.value },
        { scaleY: scaleY.value },
      ],
    };
  });

  const animatedTextStyle = useAnimatedStyle(() => {
    return {
      opacity: textOpacity.value,
      transform: [{ translateY: textTranslateY.value }],
    };
  });

  return (
    <View style={styles.container}>
      {phase === 'idle' ? (
        <Animated.View style={[animatedStyle, { width: balloonWidth, height: balloonHeight + 20 }]}>
          <Pressable onPress={handlePopPress} style={styles.balloonPressable}>
            <Svg width="100%" height="100%" viewBox="0 0 80 120">
              <Defs>
                <RadialGradient id={`balloonGrad-${amount}`} cx="35%" cy="35%" r="65%">
                  <Stop offset="0%" stopColor="#7F1D1D" />
                  <Stop offset="80%" stopColor="#180000" />
                  <Stop offset="100%" stopColor="#0B0909" />
                </RadialGradient>
              </Defs>
              <G>
                <Path
                  d="M 40,95 C 43,105 35,115 40,122"
                  stroke="#5A606C"
                  strokeWidth="1.2"
                  fill="none"
                  opacity="0.85"
                />

                <Polygon
                  points="40,89 36,97 44,97"
                  fill="#7F1D1D"
                  stroke="#3A0A0A"
                  strokeWidth="0.8"
                />

                <Circle
                  cx="40"
                  cy="50"
                  r="38"
                  fill={`url(#balloonGrad-${amount})`}
                  stroke="#3A0A0A"
                  strokeWidth="1.5"
                />

                <Path
                  d="M 18,34 C 18,22 30,16 42,16"
                  stroke="#FFFFFF"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  opacity="0.25"
                  fill="none"
                />
              </G>
            </Svg>

            {/* Inner Content Overlays */}
            <View style={styles.overlayContent}>
              <Text style={styles.emojiText}>{emoji}</Text>
              <Text style={styles.rupeeValue}>₹{amount.toLocaleString('en-IN')}</Text>
              <Text style={styles.noteText} numberOfLines={1}>
                {note || 'Unrated spend'}
              </Text>
            </View>
          </Pressable>
        </Animated.View>
      ) : null}

      {/* Origin Radial Flash / Pop Glow */}
      {particlesActive && (
        <View style={styles.glowFlash} pointerEvents="none" />
      )}

      {/* Floating text rising up */}
      {showFloatingText && (
        <Animated.View style={[styles.floatingTextContainer, animatedTextStyle]} pointerEvents="none">
          <Text style={styles.floatingText}>-₹{amount.toLocaleString('en-IN')}</Text>
        </Animated.View>
      )}

      {/* Bursting scattering particles */}
      {particlesActive &&
        particles.map((p) => (
          <BalloonParticle
            key={p.id}
            dx={p.dx}
            dy={p.dy}
            triggerPop={particlesActive}
          />
        ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 90,
    height: 140,
    position: 'relative',
  },
  balloonPressable: {
    width: '100%',
    height: '100%',
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  overlayContent: {
    position: 'absolute',
    top: 18,
    left: 8,
    right: 8,
    bottom: 34,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emojiText: {
    fontSize: 14,
    marginBottom: 2,
  },
  rupeeValue: {
    fontFamily: DLFonts.mono,
    fontSize: 10,
    fontWeight: 'bold',
    color: '#E7E9EE',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  noteText: {
    fontFamily: DLFonts.sans,
    fontSize: 7.5,
    color: '#7E848F',
    textAlign: 'center',
    width: '100%',
    marginTop: 2,
  },
  floatingTextContainer: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
  },
  floatingText: {
    fontFamily: DLFonts.mono,
    fontSize: 14,
    fontWeight: 'bold',
    color: '#FF3333',
  },
  glowFlash: {
    position: 'absolute',
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FF3333',
    opacity: 0.2,
  },
});
