import React, { useState, useEffect } from 'react';
import { Tabs } from 'expo-router';
import { View, Text, StyleSheet, Pressable, Platform, Vibration, LayoutChangeEvent } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Reanimated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DL, DLFonts } from '@/constants/design';
import { DreamsIcon, HomeIcon, VaultIcon, SettingsIcon } from '@/components/ui/TabIcons';

interface TabRoute {
  key: string;
  name: string;
}

interface FloatingTabBarProps {
  state: any;
  navigation: any;
  descriptors?: any;
  insets?: any;
}

function FloatingTabBar({ state, navigation }: FloatingTabBarProps) {
  const insets = useSafeAreaInsets();
  const visibleRoutes = state.routes.filter(
    (route: TabRoute) => !['expenses', 'money', 'budget'].includes(route.name)
  );

  const [layouts, setLayouts] = useState<Record<string, { x: number; width: number }>>({});
  const indicatorX = useSharedValue(0);
  const indicatorWidth = useSharedValue(0);
  const indicatorOpacity = useSharedValue(0);

  const activeRoute = visibleRoutes.find(
    (r: TabRoute) => r.name === state.routes[state.index]?.name
  ) || visibleRoutes[0];

  useEffect(() => {
    if (activeRoute && layouts[activeRoute.key]) {
      const { x, width } = layouts[activeRoute.key];
      indicatorX.value = withSpring(x, { damping: 20, stiffness: 200, mass: 0.6 });
      indicatorWidth.value = withSpring(width, { damping: 20, stiffness: 200, mass: 0.6 });
      indicatorOpacity.value = withSpring(1, { damping: 18 });
    }
  }, [activeRoute?.key, layouts]);

  const animatedSliderStyle = useAnimatedStyle(() => ({
    position: 'absolute',
    left: 0,
    top: 9,
    bottom: 9,
    borderRadius: 24,
    overflow: 'hidden',
    transform: [{ translateX: indicatorX.value }],
    width: indicatorWidth.value,
    opacity: indicatorOpacity.value,
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 10,
    elevation: 4,
  }));

  const handleLayout = (key: string, event: LayoutChangeEvent) => {
    const { x, width } = event.nativeEvent.layout;
    setLayouts((prev) => {
      if (prev[key]?.x === x && prev[key]?.width === width) return prev;
      return { ...prev, [key]: { x, width } };
    });
  };

  return (
    <View
      style={[
        styles.floatingContainer,
        { bottom: Platform.OS === 'ios' ? Math.max(insets.bottom, 16) : 16 },
      ]}
    >
      {/* Smooth Shifting Animated Gradient Capsule */}
      <Reanimated.View style={animatedSliderStyle} pointerEvents="none">
        <LinearGradient
          colors={DL.cardGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0.5 }}
          style={StyleSheet.absoluteFill}
        />
      </Reanimated.View>

      {visibleRoutes.map((route: TabRoute) => {
        const isFocused = state.routes[state.index].name === route.name;

        const onPress = () => {
          Vibration.vibrate(10);
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });

          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name);
          }
        };

        const onLongPress = () => {
          navigation.emit({
            type: 'tabLongPress',
            target: route.key,
          });
        };

        const getTabInfo = () => {
          switch (route.name) {
            case 'index':
              return { label: 'HOME', Icon: HomeIcon };
            case 'vault':
              return { label: 'VAULT', Icon: VaultIcon };
            case 'dreams':
              return { label: 'DREAMS', Icon: DreamsIcon };
            case 'settings':
              return { label: 'SETTINGS', Icon: SettingsIcon };
            default:
              return { label: route.name.toUpperCase(), Icon: HomeIcon };
          }
        };

        const { label, Icon } = getTabInfo();

        return (
          <Pressable
            key={route.key}
            onLayout={(e) => handleLayout(route.key, e)}
            onPress={onPress}
            onLongPress={onLongPress}
            style={({ pressed }) => [
              styles.tabItem,
              isFocused ? styles.tabItemActive : styles.tabItemInactive,
              pressed && { opacity: 0.85, transform: [{ scale: 0.95 }] },
            ]}
          >
            <Icon color={isFocused ? '#FFFFFF' : '#64748B'} size={19} />
            {isFocused && <Text style={styles.activeLabel}>{label}</Text>}
          </Pressable>
        );
      })}
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      initialRouteName="index"
      tabBar={(props) => <FloatingTabBar {...props} />}
      screenOptions={{
        headerShown: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
        }}
      />
      <Tabs.Screen
        name="vault"
        options={{
          title: 'Vault',
        }}
      />
      <Tabs.Screen
        name="dreams"
        options={{
          title: 'Dreams',
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
        }}
      />

      {/* Hidden / Deprecated Routes */}
      <Tabs.Screen
        name="expenses"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="money"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="budget"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  floatingContainer: {
    position: 'absolute',
    left: 18,
    right: 18,
    height: 62,
    backgroundColor: 'rgba(255, 255, 255, 0.94)',
    borderRadius: 34,
    borderWidth: 1.2,
    borderColor: 'rgba(226, 232, 240, 0.95)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 8,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 12,
  },
  tabItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingVertical: 9,
    borderRadius: 24,
    zIndex: 2,
  },
  tabItemActive: {
    paddingHorizontal: 16,
  },
  tabItemInactive: {
    width: 44,
    height: 44,
    paddingHorizontal: 0,
  },
  activeLabel: {
    fontFamily: DLFonts.sans,
    fontSize: 11.5,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.8,
  },
});
