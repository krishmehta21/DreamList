import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Alert,
  ScrollView,
  Animated,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DL, DLFonts } from '@/constants/design';
import { useAuth } from '@/context/AuthContext';
import { useRouter, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fetchItems } from '@/lib/api';

// Custom Animated Toggle Switch
function AnimatedSwitch({ value, onValueChange }: { value: boolean; onValueChange: (v: boolean) => void }) {
  const switchTranslateX = useRef(new Animated.Value(value ? 18 : 2)).current;

  useEffect(() => {
    Animated.timing(switchTranslateX, {
      toValue: value ? 18 : 2,
      duration: 180,
      useNativeDriver: true,
    }).start();
  }, [value]);

  return (
    <Pressable
      onPress={() => onValueChange(!value)}
      style={[
        styles.switchTrack,
        value ? { backgroundColor: DL.soon } : { backgroundColor: 'rgba(255, 255, 255, 0.12)' },
      ]}
      hitSlop={12}
    >
      <Animated.View
        style={[
          styles.switchThumb,
          { transform: [{ translateX: switchTranslateX }] },
        ]}
      />
    </Pressable>
  );
}

// Tactile wrapper for list rows
function TactileRow({ onPress, style, children }: any) {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scale, { toValue: 0.98, useNativeDriver: true }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scale, { toValue: 1, useNativeDriver: true }).start();
  };

  return (
    <Pressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={styles.tactileWrapper}
    >
      <Animated.View style={[style, { transform: [{ scale }] }]}>
        {children}
      </Animated.View>
    </Pressable>
  );
}

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { user, signOut } = useAuth();
  const router = useRouter();

  // App preference states
  const [compactLayout, setCompactLayout] = useState(false);
  const [priceAlerts, setPriceAlerts] = useState(true);
  const [copiedField, setCopiedField] = useState<'email' | 'uid' | null>(null);

  // Stats states
  const [stats, setStats] = useState({ total: 0, acquired: 0, pending: 0 });
  const [statsLoading, setStatsLoading] = useState(true);

  // Load preferences from AsyncStorage
  useEffect(() => {
    const loadPreferences = async () => {
      try {
        const compactVal = await AsyncStorage.getItem('pref_compact_layout');
        const alertVal = await AsyncStorage.getItem('pref_price_alerts');
        if (compactVal !== null) setCompactLayout(compactVal === 'true');
        if (alertVal !== null) setPriceAlerts(alertVal === 'true');
      } catch (err) {
        console.warn('Failed to load settings preferences', err);
      }
    };
    loadPreferences();
  }, []);

  // Fetch items to compile live stats when the screen is focused
  const loadStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const items = await fetchItems();
      const total = items.length;
      const acquired = items.filter((i) => i.done).length;
      const pending = total - acquired;
      setStats({ total, acquired, pending });
    } catch {
      // ignore
    } finally {
      setStatsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadStats();
    }, [loadStats])
  );

  const toggleCompactLayout = async (val: boolean) => {
    setCompactLayout(val);
    try {
      await AsyncStorage.setItem('pref_compact_layout', String(val));
    } catch (err) {
      console.warn(err);
    }
  };

  const togglePriceAlerts = async (val: boolean) => {
    setPriceAlerts(val);
    try {
      await AsyncStorage.setItem('pref_price_alerts', String(val));
    } catch (err) {
      console.warn(err);
    }
  };

  const copyToClipboard = (field: 'email' | 'uid', text: string) => {
    setCopiedField(field);
    setTimeout(() => {
      setCopiedField(null);
    }, 2000);
  };

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          await signOut();
          router.replace('/login');
        },
      },
    ]);
  };

  // Get user initial from email
  const userEmail = user?.email ?? 'Dream User';
  const initial = userEmail.charAt(0).toUpperCase();
  const userName = userEmail.split('@')[0];

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 16 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Card */}
        <View style={styles.profileCard}>
          <View style={styles.avatarGradient}>
            <Text style={styles.avatarText}>{initial}</Text>
          </View>
          <View style={styles.profileDetails}>
            <Text style={styles.profileName}>{userName}</Text>
            <Text style={styles.profileEmail} numberOfLines={1}>{userEmail}</Text>
          </View>
        </View>

        {/* Wishlist Summary Stats */}
        <View style={styles.statsCard}>
          <Text style={styles.sectionTitle}>WISHLIST ACTIVITY</Text>
          {statsLoading ? (
            <View style={styles.statsLoader}>
              <ActivityIndicator color={DL.muted} size="small" />
            </View>
          ) : (
            <View style={styles.statsRow}>
              <View style={styles.statCol}>
                <Text style={[styles.statNum, { color: DL.text }]}>{stats.total}</Text>
                <Text style={styles.statLabel}>Total</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statCol}>
                <Text style={[styles.statNum, { color: DL.soon }]}>{stats.acquired}</Text>
                <Text style={styles.statLabel}>Acquired</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statCol}>
                <Text style={[styles.statNum, { color: DL.now }]}>{stats.pending}</Text>
                <Text style={styles.statLabel}>Pending</Text>
              </View>
            </View>
          )}
        </View>

        {/* Account Details Panel */}
        <View style={styles.cardGroup}>
          <Text style={styles.groupTitle}>ACCOUNT SETTINGS</Text>

          <TactileRow onPress={() => copyToClipboard('email', userEmail)} style={styles.row}>
            <View style={styles.rowLeft}>
              <Text style={styles.rowIcon}>✉️</Text>
              <View>
                <Text style={styles.rowLabel}>Email Address</Text>
                <Text style={styles.rowValue} numberOfLines={1}>{userEmail}</Text>
              </View>
            </View>
            <Text style={styles.actionText}>{copiedField === 'email' ? 'Copied!' : 'Copy'}</Text>
          </TactileRow>

          <View style={styles.rowSeparator} />

          <TactileRow onPress={() => copyToClipboard('uid', user?.id || '')} style={styles.row}>
            <View style={styles.rowLeft}>
              <Text style={styles.rowIcon}>🔑</Text>
              <View>
                <Text style={styles.rowLabel}>User ID</Text>
                <Text style={[styles.rowValue, styles.mono]} numberOfLines={1}>
                  {user?.id ?? '—'}
                </Text>
              </View>
            </View>
            <Text style={styles.actionText}>{copiedField === 'uid' ? 'Copied!' : 'Copy'}</Text>
          </TactileRow>
        </View>

        {/* App Preferences Panel */}
        <View style={styles.cardGroup}>
          <Text style={styles.groupTitle}>APP PREFERENCES</Text>

          <View style={styles.row}>
            <View style={styles.rowLeft}>
              <Text style={styles.rowIcon}>📱</Text>
              <View>
                <Text style={styles.rowLabel}>Compact Layout</Text>
                <Text style={styles.rowDesc}>Denser dashboard listing</Text>
              </View>
            </View>
            <AnimatedSwitch value={compactLayout} onValueChange={toggleCompactLayout} />
          </View>

          <View style={styles.rowSeparator} />

          <View style={styles.row}>
            <View style={styles.rowLeft}>
              <Text style={styles.rowIcon}>🔔</Text>
              <View>
                <Text style={styles.rowLabel}>Price Alerts</Text>
                <Text style={styles.rowDesc}>Alert when items drop in price</Text>
              </View>
            </View>
            <AnimatedSwitch value={priceAlerts} onValueChange={togglePriceAlerts} />
          </View>
        </View>

        {/* Support & Legal */}
        <View style={styles.cardGroup}>
          <Text style={styles.groupTitle}>SUPPORT</Text>

          <View style={styles.row}>
            <View style={styles.rowLeft}>
              <Text style={styles.rowIcon}>ℹ️</Text>
              <View>
                <Text style={styles.rowLabel}>DreamList Mobile</Text>
                <Text style={styles.rowDesc}>Version 1.0.0 (Expo SDK 54)</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Sign Out Button */}
        <Pressable
          style={({ pressed }) => [
            styles.signOutBtn,
            pressed && styles.signOutBtnPressed,
          ]}
          onPress={handleSignOut}
        >
          <Text style={styles.signOutText}>Sign Out Account</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: DL.bg,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 60,
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: DL.card,
    borderColor: DL.border,
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  avatarGradient: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: DL.dream,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  avatarText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#0B0D10',
    fontFamily: DLFonts.sans,
  },
  profileDetails: {
    flex: 1,
    marginLeft: 16,
  },
  profileName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: DL.text,
    fontFamily: DLFonts.sans,
    textTransform: 'capitalize',
  },
  profileEmail: {
    fontSize: 13,
    color: DL.muted,
    fontFamily: DLFonts.sans,
    marginTop: 2,
  },
  statsCard: {
    backgroundColor: DL.card,
    borderColor: DL.border,
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 10,
    letterSpacing: 1.5,
    color: DL.muted,
    fontFamily: DLFonts.mono,
    marginBottom: 12,
  },
  statsLoader: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  statCol: {
    flex: 1,
    alignItems: 'center',
  },
  statNum: {
    fontSize: 22,
    fontWeight: '800',
    fontFamily: DLFonts.mono,
  },
  statLabel: {
    fontSize: 11,
    color: DL.muted,
    marginTop: 4,
    fontFamily: DLFonts.sans,
  },
  statDivider: {
    width: 1,
    height: 24,
    backgroundColor: DL.border,
  },
  cardGroup: {
    backgroundColor: DL.card,
    borderColor: DL.border,
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
  },
  groupTitle: {
    fontSize: 9,
    letterSpacing: 2,
    color: DL.muted,
    fontFamily: DLFonts.mono,
    marginBottom: 12,
  },
  tactileWrapper: {
    width: '100%',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    width: '100%',
  },
  rowSeparator: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    marginVertical: 4,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    paddingRight: 16,
  },
  rowIcon: {
    fontSize: 18,
    marginRight: 14,
  },
  rowLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: DL.text,
    fontFamily: DLFonts.sans,
  },
  rowDesc: {
    fontSize: 11,
    color: DL.muted,
    fontFamily: DLFonts.sans,
    marginTop: 2,
  },
  rowValue: {
    fontSize: 12,
    color: DL.muted,
    fontFamily: DLFonts.sans,
    marginTop: 2,
  },
  mono: {
    fontFamily: DLFonts.mono,
  },
  actionText: {
    fontSize: 12,
    color: DL.soon,
    fontWeight: 'bold',
    fontFamily: DLFonts.sans,
  },
  switchTrack: {
    width: 42,
    height: 24,
    borderRadius: 12,
    padding: 2,
    justifyContent: 'center',
  },
  switchThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#0B0D10',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.5,
  },
  signOutBtn: {
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    borderColor: 'rgba(239, 68, 68, 0.2)',
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  signOutBtnPressed: {
    backgroundColor: 'rgba(239, 68, 68, 0.14)',
  },
  signOutText: {
    color: DL.danger,
    fontSize: 15,
    fontWeight: 'bold',
    fontFamily: DLFonts.sans,
  },
});
