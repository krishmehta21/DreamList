import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  Animated,
  ActivityIndicator,
  TextInput,
  Modal,
} from 'react-native';
import { CustomAlert as Alert } from '@/components/CustomAlert';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DL, DLFonts } from '@/constants/design';
import { useAuth } from '@/context/AuthContext';
import { useRouter, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fetchItems } from '@/lib/api';
import { useBudget } from '@/context/BudgetContext';
import { WishlistItem } from '@/lib/types';
const CATEGORY_EMOJI: Record<string, string> = {
  tech: '💻',
  electronics: '🔌',
  automotive: '🚗',
  apparel: '👕',
  clothing: '👕',
  home: '🏠',
  furniture: '🛋️',
  sports: '🏀',
  fitness: '🏋️',
  hobbies: '🎨',
  books: '📚',
  travel: '✈️',
  other: '🎁',
};

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

  const { 
    userProfile, 
    updateProfileDisplayName,
    goals,
    addGoal,
    updateGoal,
    deleteGoal,
  } = useBudget();

  // Profile Inline Display Name Editing
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempDisplayName, setTempDisplayName] = useState('');

  // Goals CRUD state
  const [goalModalVisible, setGoalModalVisible] = useState(false);
  const [editingGoalId, setEditingGoalId] = useState<string | null>(null);
  const [goalName, setGoalName] = useState('');
  const [goalTarget, setGoalTarget] = useState('');
  const [goalIcon, setGoalIcon] = useState('🎯');
  const [isSavingGoal, setIsSavingGoal] = useState(false);

  // New wishlist-linked goal features
  const [goalMode, setGoalMode] = useState<'wishlist' | 'custom'>('wishlist');
  const [wishlistItems, setWishlistItems] = useState<WishlistItem[]>([]);
  const [wishlistSearch, setWishlistSearch] = useState('');
  const [linkedItemId, setLinkedItemId] = useState<string | null>(null);

  // Sync temp display name when userProfile changes
  useEffect(() => {
    if (userProfile?.display_name) {
      setTempDisplayName(userProfile.display_name);
    } else {
      setTempDisplayName(user?.email?.split('@')[0] || '');
    }
  }, [userProfile, user]);

  const openAddGoalModal = () => {
    setEditingGoalId(null);
    setGoalName('');
    setGoalTarget('');
    setGoalIcon('🎯');
    setLinkedItemId(null);
    setGoalMode('wishlist');
    setWishlistSearch('');
    setGoalModalVisible(true);
  };

  const openEditGoalModal = (g: any) => {
    setEditingGoalId(g.id);
    setGoalName(g.name);
    setGoalTarget(String(g.target_amount));
    setGoalIcon(g.icon || '🎯');
    setLinkedItemId(g.linked_item_id || null);
    setGoalMode(g.linked_item_id ? 'wishlist' : 'custom');
    setWishlistSearch('');
    setGoalModalVisible(true);
  };

  const handleSaveGoal = async () => {
    if (!goalName.trim()) {
      Alert.alert('Missing Field', 'Please enter a goal name.');
      return;
    }
    const targetAmt = parseFloat(goalTarget);
    if (isNaN(targetAmt) || targetAmt <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid target amount.');
      return;
    }
    setIsSavingGoal(true);
    try {
      const linkId = goalMode === 'wishlist' ? linkedItemId : null;
      if (editingGoalId) {
        await updateGoal(editingGoalId, goalName.trim(), targetAmt, goalIcon, linkId);
        Alert.alert('Saved!', 'Goal updated successfully.');
      } else {
        await addGoal(goalName.trim(), targetAmt, goalIcon, linkId);
        Alert.alert('Created!', 'Goal created successfully.');
      }
      setGoalModalVisible(false);
    } catch (err) {
      Alert.alert('Error', 'Failed to save goal.');
    } finally {
      setIsSavingGoal(false);
    }
  };

  const handleDeleteGoal = (id: string, name: string) => {
    Alert.alert(
      'Delete Goal',
      `Are you sure you want to delete the goal "${name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteGoal(id);
              Alert.alert('Deleted', 'Goal deleted successfully.');
            } catch (err) {
              Alert.alert('Error', 'Failed to delete goal.');
            }
          }
        }
      ]
    );
  };



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
      setWishlistItems(items || []);
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
            {isEditingName ? (
              <View style={styles.inlineEditContainer}>
                <TextInput
                  style={styles.inlineNameInput}
                  value={tempDisplayName}
                  onChangeText={setTempDisplayName}
                  autoFocus={true}
                  placeholder="Enter name..."
                  placeholderTextColor={DL.muted}
                />
                <Pressable
                  style={styles.inlineEditBtn}
                  onPress={async () => {
                    if (tempDisplayName.trim()) {
                      try {
                        await updateProfileDisplayName(tempDisplayName.trim());
                        setIsEditingName(false);
                      } catch {
                        Alert.alert('Error', 'Failed to save name.');
                      }
                    }
                  }}
                >
                  <Text style={styles.inlineEditBtnText}>✅</Text>
                </Pressable>
                <Pressable
                  style={styles.inlineEditBtn}
                  onPress={() => {
                    setTempDisplayName(userProfile?.display_name || user?.email?.split('@')[0] || '');
                    setIsEditingName(false);
                  }}
                >
                  <Text style={styles.inlineEditBtnText}>✕</Text>
                </Pressable>
              </View>
            ) : (
              <View style={styles.profileNameContainer}>
                <Text style={styles.profileName}>
                  {userProfile?.display_name || user?.email?.split('@')[0] || 'Dream User'}
                </Text>
                <Pressable style={styles.editNameIcon} onPress={() => setIsEditingName(true)}>
                  <Text style={{ fontSize: 13, marginLeft: 6 }}>✏️</Text>
                </Pressable>
              </View>
            )}
            <Text style={styles.profileEmail} numberOfLines={1}>{userEmail}</Text>
          </View>
        </View>





        {/* Goal CRUD Manager */}
        <View style={styles.cardGroup}>
          <Text style={styles.groupTitle}>PROTECTED WEALTH GOALS</Text>
          <Text style={styles.groupSubtitle}>
            Define targets for your protected wealth. Funds can be manually deposited to or withdrawn from these goals on the Money tab.
          </Text>

          <View style={{ marginVertical: 8 }}>
            {goals.length === 0 ? (
              <Text style={{ fontFamily: DLFonts.sans, fontSize: 13, color: DL.muted, textAlign: 'center', marginVertical: 20 }}>
                No goals defined yet.
              </Text>
            ) : (
              goals.map((g) => (
                <View key={g.id} style={styles.goalItemRow}>
                  <View style={styles.goalItemInfo}>
                    <Text style={styles.goalItemIcon}>{g.icon || '🎯'}</Text>
                    <View>
                      <Text style={styles.goalItemName}>{g.name}</Text>
                      <Text style={styles.goalItemTarget}>
                        Target: ₹{Number(g.target_amount).toLocaleString('en-IN')}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.goalItemActions}>
                    <Pressable style={styles.goalActionBtn} onPress={() => openEditGoalModal(g)}>
                      <Text style={styles.goalActionBtnText}>EDIT</Text>
                    </Pressable>
                    <Pressable style={styles.goalActionBtn} onPress={() => handleDeleteGoal(g.id, g.name)}>
                      <Text style={[styles.goalActionBtnText, { color: DL.danger }]}>DELETE</Text>
                    </Pressable>
                  </View>
                </View>
              ))
            )}
          </View>

          <Pressable style={styles.addGoalBtn} onPress={openAddGoalModal}>
            <Text style={styles.addGoalBtnText}>+ ADD NEW SAVINGS GOAL</Text>
          </Pressable>
        </View>

        {/* GOAL ADD/EDIT MODAL */}
        <Modal
          animationType="fade"
          transparent={true}
          visible={goalModalVisible}
          onRequestClose={() => setGoalModalVisible(false)}
        >
          <View style={styles.modalBackdrop}>
            <View style={[styles.modalContent, { maxHeight: '90%' }]}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>
                  {editingGoalId ? '✏️ EDIT SAVINGS GOAL' : '🎯 ADD NEW SAVINGS GOAL'}
                </Text>
                <Pressable onPress={() => setGoalModalVisible(false)}>
                  <Text style={styles.modalCloseBtn}>✕</Text>
                </Pressable>
              </View>

              {/* Mode Selector Toggle Switch */}
              <View style={styles.modalToggleRow}>
                <Pressable 
                  style={[styles.modalTogglePill, goalMode === 'wishlist' && styles.modalTogglePillActive]} 
                  onPress={() => setGoalMode('wishlist')}
                >
                  <Text style={[styles.modalTogglePillText, goalMode === 'wishlist' && styles.modalTogglePillTextActive]}>
                    FROM WISHLIST
                  </Text>
                </Pressable>
                <Pressable 
                  style={[styles.modalTogglePill, goalMode === 'custom' && styles.modalTogglePillActive]} 
                  onPress={() => setGoalMode('custom')}
                >
                  <Text style={[styles.modalTogglePillText, goalMode === 'custom' && styles.modalTogglePillTextActive]}>
                    CUSTOM GOAL
                  </Text>
                </Pressable>
              </View>

              {goalMode === 'wishlist' ? (
                <>
                  {/* Search Wishlist items */}
                  <View style={styles.inputGroup}>
                    <Text style={styles.modalInputLabel}>SEARCH WISHLIST ITEMS</Text>
                    <TextInput
                      style={styles.textInput}
                      value={wishlistSearch}
                      onChangeText={setWishlistSearch}
                      placeholder="🔍 Search items..."
                      placeholderTextColor={DL.muted}
                    />
                  </View>

                  {/* Scrollable list of selectable items */}
                  <View style={styles.wishlistScrollWrapper}>
                    <ScrollView style={styles.wishlistScroll} nestedScrollEnabled={true}>
                      {wishlistItems.filter(item => 
                        item.name.toLowerCase().includes(wishlistSearch.toLowerCase())
                      ).length === 0 ? (
                        <Text style={styles.noWishlistText}>No matching wishlist items.</Text>
                      ) : (
                        wishlistItems
                          .filter(item => item.name.toLowerCase().includes(wishlistSearch.toLowerCase()))
                          .map((item) => {
                            const prices = item.prices;
                            const lowestPrice = prices && prices.length > 0
                              ? Math.min(...prices.map((p) => Number(p.price)))
                              : 0;
                            const isSelected = linkedItemId === item.id;
                            
                            return (
                              <Pressable
                                key={item.id}
                                style={[styles.wishlistItemRow, isSelected && styles.wishlistItemRowSelected]}
                                onPress={() => {
                                  setLinkedItemId(item.id);
                                  setGoalName(item.name);
                                  setGoalTarget(lowestPrice > 0 ? String(Math.round(lowestPrice)) : '0');
                                  
                                  const cat = (item.category || 'other').toLowerCase();
                                  const defaultEmoji = CATEGORY_EMOJI[cat] || '🎯';
                                  setGoalIcon(defaultEmoji);
                                }}
                              >
                                <View style={{ flex: 1 }}>
                                  <Text style={styles.wishlistItemName} numberOfLines={1}>{item.name}</Text>
                                  <Text style={styles.wishlistItemPrice}>
                                    {lowestPrice > 0 ? `₹${Math.round(lowestPrice).toLocaleString('en-IN')}` : 'Price pending research'}
                                  </Text>
                                </View>
                                {isSelected && <Text style={{ color: '#10B981', fontFamily: DLFonts.mono, fontSize: 10, fontWeight: 'bold' }}>✓ SELECTED</Text>}
                              </Pressable>
                            );
                          })
                      )}
                    </ScrollView>
                  </View>

                  {linkedItemId && (
                    <View style={styles.linkedNotice}>
                      <Text style={styles.linkedNoticeText}>
                        🔗 Target price will stay synced with the live tracked price of this item.
                      </Text>
                    </View>
                  )}
                </>
              ) : null}

              {/* Editable Fields */}
              <View style={styles.inputGroup}>
                <Text style={styles.modalInputLabel}>GOAL NAME</Text>
                <TextInput
                  style={styles.textInput}
                  value={goalName}
                  onChangeText={setGoalName}
                  placeholder="e.g. Cafe Racer Bike"
                  placeholderTextColor={DL.muted}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.modalInputLabel}>
                  TARGET AMOUNT (₹) {goalMode === 'wishlist' && linkedItemId ? '(Synced)' : ''}
                </Text>
                <TextInput
                  style={[styles.textInput, goalMode === 'wishlist' && linkedItemId ? { opacity: 0.7, backgroundColor: 'rgba(255,255,255,0.02)' } : {}]}
                  keyboardType="numeric"
                  value={goalTarget}
                  onChangeText={setGoalTarget}
                  editable={goalMode === 'custom' || !linkedItemId}
                  placeholder="e.g. 150000"
                  placeholderTextColor={DL.muted}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.modalInputLabel}>EMOJI ICON</Text>
                <TextInput
                  style={styles.textInput}
                  value={goalIcon}
                  onChangeText={setGoalIcon}
                  maxLength={4}
                  placeholder="e.g. 🏍️"
                  placeholderTextColor={DL.muted}
                />
              </View>

              <View style={styles.modalButtonsRow}>
                <Pressable style={styles.btnSecondary} onPress={() => setGoalModalVisible(false)}>
                  <Text style={styles.btnSecondaryText}>CANCEL</Text>
                </Pressable>
                <Pressable style={styles.btnPrimary} onPress={handleSaveGoal} disabled={isSavingGoal}>
                  {isSavingGoal ? (
                    <ActivityIndicator color="#000000" size="small" />
                  ) : (
                    <Text style={styles.btnPrimaryText}>SAVE GOAL</Text>
                  )}
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>

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
  inputLabel: {
    fontFamily: DLFonts.mono,
    fontSize: 9,
    color: DL.muted,
    letterSpacing: 1,
    marginBottom: 6,
  },
  groupSubtitle: {
    fontFamily: DLFonts.sans,
    fontSize: 11,
    color: DL.muted,
    marginBottom: 12,
  },
  inputRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  inputCol: {
    flex: 1,
  },
  bonusTextInput: {
    backgroundColor: '#F8FAFC',
    borderColor: 'rgba(0, 0, 0, 0.08)',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontFamily: DLFonts.mono,
    fontSize: 13,
    color: DL.text,
  },
  saveBonusesBtn: {
    backgroundColor: '#0F172A',
    borderRadius: 12,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
  },
  saveBonusesBtnText: {
    fontFamily: DLFonts.mono,
    fontSize: 11,
    color: '#FFFFFF',
    fontWeight: 'bold',
    letterSpacing: 1.5,
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
    backgroundColor: 'rgba(0, 0, 0, 0.06)',
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
  scheduleList: {
    marginVertical: 8,
  },
  scheduleItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  scheduleDateText: {
    fontFamily: DLFonts.mono,
    fontSize: 12,
    color: DL.text,
  },
  scheduleAmountText: {
    fontFamily: DLFonts.mono,
    fontSize: 12,
    color: '#10B981',
    fontWeight: 'bold',
  },
  scheduleDeleteBtn: {
    padding: 6,
  },
  scheduleDeleteBtnText: {
    color: DL.danger,
    fontSize: 12,
    fontWeight: 'bold',
  },
  scheduleForm: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-end',
    marginTop: 12,
  },
  scheduleFormBtn: {
    backgroundColor: '#1C2026',
    borderWidth: 1,
    borderColor: DL.border,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scheduleFormBtnText: {
    fontFamily: DLFonts.mono,
    fontSize: 10,
    color: DL.text,
    fontWeight: 'bold',
  },
  goalItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#16191D',
  },
  goalItemInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  goalItemIcon: {
    fontSize: 20,
  },
  goalItemName: {
    fontFamily: DLFonts.sans,
    fontSize: 14,
    color: DL.text,
    fontWeight: '600',
  },
  goalItemTarget: {
    fontFamily: DLFonts.mono,
    fontSize: 12,
    color: DL.muted,
    marginTop: 2,
  },
  goalItemActions: {
    flexDirection: 'row',
    gap: 12,
  },
  goalActionBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    backgroundColor: '#16191D',
  },
  goalActionBtnText: {
    fontFamily: DLFonts.mono,
    fontSize: 10,
    fontWeight: 'bold',
    color: DL.text,
  },
  addGoalBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#1C2026',
    marginTop: 16,
  },
  addGoalBtnText: {
    fontFamily: DLFonts.mono,
    fontSize: 11,
    fontWeight: 'bold',
    color: '#38BDF8',
    letterSpacing: 0.5,
  },
  // Modal styles matching standard dark theme
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 24,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontFamily: DLFonts.sans,
    fontSize: 15,
    fontWeight: 'bold',
    color: DL.text,
    letterSpacing: 0.5,
  },
  modalCloseBtn: {
    fontSize: 18,
    color: DL.muted,
  },
  inputGroup: {
    marginBottom: 16,
  },
  modalInputLabel: {
    fontFamily: DLFonts.mono,
    fontSize: 10,
    letterSpacing: 1.5,
    color: DL.muted,
    marginBottom: 6,
  },
  textInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontFamily: DLFonts.sans,
    fontSize: 13,
    color: DL.text,
  },
  modalButtonsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  btnSecondary: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnSecondaryText: {
    fontFamily: DLFonts.mono,
    fontSize: 11,
    fontWeight: 'bold',
    color: DL.muted,
    letterSpacing: 0.5,
  },
  btnPrimary: {
    flex: 1,
    backgroundColor: '#0F172A',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPrimaryText: {
    fontFamily: DLFonts.mono,
    fontSize: 11,
    fontWeight: 'bold',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  modalToggleRow: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 2,
    marginBottom: 16,
  },
  modalTogglePill: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 6,
  },
  modalTogglePillActive: {
    backgroundColor: '#FFFFFF',
  },
  modalTogglePillText: {
    fontFamily: DLFonts.mono,
    fontSize: 9.5,
    fontWeight: 'bold',
    color: DL.muted,
  },
  modalTogglePillTextActive: {
    color: '#0F172A',
  },
  wishlistScrollWrapper: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
    maxHeight: 160,
    marginBottom: 16,
    overflow: 'hidden',
  },
  wishlistScroll: {
    padding: 6,
  },
  wishlistItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 6,
    marginBottom: 4,
    backgroundColor: '#FFFFFF',
  },
  wishlistItemRowSelected: {
    borderColor: 'rgba(16, 185, 129, 0.4)',
    borderWidth: 1,
    backgroundColor: 'rgba(16, 185, 129, 0.05)',
  },
  wishlistItemName: {
    fontFamily: DLFonts.sans,
    fontSize: 12.5,
    fontWeight: 'bold',
    color: '#0F172A',
  },
  wishlistItemPrice: {
    fontFamily: DLFonts.mono,
    fontSize: 10,
    color: DL.muted,
    marginTop: 2,
  },
  noWishlistText: {
    fontFamily: DLFonts.sans,
    fontSize: 12,
    color: DL.muted,
    textAlign: 'center',
    paddingVertical: 20,
  },
  linkedNotice: {
    backgroundColor: 'rgba(59, 130, 246, 0.05)',
    borderColor: 'rgba(59, 130, 246, 0.2)',
    borderWidth: 1,
    borderRadius: 6,
    padding: 8,
    marginBottom: 16,
  },
  linkedNoticeText: {
    fontFamily: DLFonts.sans,
    fontSize: 10.5,
    color: '#2563EB',
  },
  profileNameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  inlineEditContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
    marginBottom: 6,
  },
  inlineNameInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    color: '#0F172A',
    fontFamily: DLFonts.sans,
    fontSize: 16,
    fontWeight: 'bold',
    minWidth: 150,
  },
  inlineEditBtn: {
    marginLeft: 8,
    padding: 6,
    borderRadius: 4,
    backgroundColor: '#F1F5F9',
  },
  inlineEditBtnText: {
    fontSize: 12,
  },
  editNameIcon: {
    padding: 2,
  },
});
