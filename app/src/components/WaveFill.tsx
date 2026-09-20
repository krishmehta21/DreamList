import React from 'react';
import Animated, { useAnimatedProps, useSharedValue, withRepeat, withTiming, Easing, SharedValue } from 'react-native-reanimated'; import Svg, { Path } from 'react-native-svg';
import { View, StyleSheet } from 'react-native';

const AnimatedPath = Animated.createAnimatedComponent(Path);

function buildWavePath(width: number, height: number, amplitude: number, phase: number, baseY: number) {
    'worklet';
    let d = `M0,${baseY}`;
    const steps = 24;
    const stepWidth = width / steps;
    for (let i = 0; i <= steps; i++) {
        const x = i * stepWidth;
        const y = baseY + Math.sin((i / steps) * Math.PI * 2 + phase) * amplitude;
        d += ` L${x.toFixed(1)},${y.toFixed(1)}`;
    }
    d += ` L${width},${height} L0,${height} Z`;
    return d;
}

type Props = {
    width: number;
    height: number;
    fillPercent: SharedValue<number>;
    color: string;
};

export function WaveFill({ width, height, fillPercent, color }: Props) {
    const phase1 = useSharedValue(0);
    const phase2 = useSharedValue(0);

    React.useEffect(() => {
        phase1.value = withRepeat(withTiming(Math.PI * 2, { duration: 3200, easing: Easing.linear }), -1, false);
        phase2.value = withRepeat(withTiming(Math.PI * 2, { duration: 4600, easing: Easing.linear }), -1, false);
    }, []);

    const animatedPropsBack = useAnimatedProps(() => {
        const baseY = height * (1 - fillPercent.value / 100);
        return { d: buildWavePath(width, height, 6, phase2.value, baseY) };
    });

    const animatedPropsFront = useAnimatedProps(() => {
        const baseY = height * (1 - fillPercent.value / 100);
        return { d: buildWavePath(width, height, 9, phase1.value, baseY) };
    });

    return (
        <View style={StyleSheet.absoluteFill}>
            <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
                <AnimatedPath animatedProps={animatedPropsBack} fill={color} opacity={0.18} />
                <AnimatedPath animatedProps={animatedPropsFront} fill={color} opacity={0.3} />
            </Svg>
        </View>
    );
}