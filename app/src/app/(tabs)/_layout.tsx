import { Tabs } from 'expo-router';
import { View, Text, StyleSheet } from 'react-native';
import { DL, DLFonts } from '@/constants/design';

function TabIcon({ name, focused }: { name: string; focused: boolean }) {
  const icons: Record<string, string> = {
    index: '⊞',
    expenses: '💳',
    settings: '⚙',
  };
  return (
    <View style={[styles.iconWrap, focused && styles.iconWrapActive]}>
      <Text style={[styles.iconText, focused && styles.iconTextActive]}>
        {icons[name] || '•'}
      </Text>
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: DL.card,
          borderTopColor: DL.border,
          borderTopWidth: 1,
          height: 72,
          paddingBottom: 12,
          paddingTop: 8,
        },
        tabBarActiveTintColor: DL.text,
        tabBarInactiveTintColor: DL.muted,
        tabBarLabelStyle: {
          fontFamily: DLFonts.mono,
          fontSize: 9,
          letterSpacing: 1.5,
          textTransform: 'uppercase',
          marginTop: 2,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ focused }) => <TabIcon name="index" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="expenses"
        options={{
          title: 'Expenses',
          tabBarIcon: ({ focused }) => <TabIcon name="expenses" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ focused }) => <TabIcon name="settings" focused={focused} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  iconWrap: {
    width: 32,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapActive: {
    backgroundColor: DL.border,
  },
  iconText: {
    fontSize: 18,
    color: DL.muted,
  },
  iconTextActive: {
    color: DL.text,
  },
});
