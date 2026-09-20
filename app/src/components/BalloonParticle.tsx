import React, { useEffect } from 'react';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  Easing,
} from 'react-native-reanimated';

interface BalloonParticleProps {
  dx: number;
  dy: number;
  triggerPop: boolean;
}

export const BalloonParticle: React.FC<BalloonParticleProps> = ({ dx, dy, triggerPop }) => {
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const opacity = useSharedValue(1);
  const scale = useSharedValue(1);

  useEffect(() => {
    if (triggerPop) {
      x.value = withTiming(dx, { duration: 500, easing: Easing.out(Easing.quad) });
      y.value = withSequence(
        withTiming(dy, { duration: 250, easing: Easing.out(Easing.quad) }),
        withTiming(dy + 100, { duration: 250, easing: Easing.in(Easing.quad) })
      );
      opacity.value = withTiming(0, { duration: 500 });
      scale.value = withTiming(0.1, { duration: 500 });
    }
  }, [triggerPop]);

  const pStyle = useAnimatedStyle(() => {
    return {
      position: 'absolute',
      width: 7,
      height: 7,
      borderRadius: 3.5,
      backgroundColor: '#FF3333',
      opacity: opacity.value,
      transform: [
        { translateX: x.value },
        { translateY: y.value },
        { scale: scale.value },
      ],
    };
  });

  return <Animated.View style={pStyle} pointerEvents="none" />;
};
