import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  TextInput,
  Modal,
  ActivityIndicator,
  RefreshControl,
  Vibration,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useBudget } from '@/context/BudgetContext';
import { DL, DLFonts } from '@/constants/design';
import { CustomAlert as Alert } from '@/components/CustomAlert';
import { ShieldLockIcon } from '@/components/ui/TabIcons';
import { IcebergRenderer } from '@/components/IcebergRenderer';
import { CategoryIcon, getCategoryEmoji } from '@/components/ui/CategoryIcon';

export default function VaultScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const {
    activeMonth,
    budgetMonth,
    budgetState,
    healthState,
    vaultBalance,
    categoryLimits,
    categories,
    isLoading,
    setupBudget,
    updateLimits,
    depositToVault,
    withdrawFromVault,
    refreshData,
  } = useBudget();

  const [refreshing, setRefreshing] = useState(false);

  // ─── Modal States ─────────────────────────────────────────────────────────
  const [showSetupModal, setShowSetupModal] = useState(false);
  const [salaryInput, setSalaryInput] = useState(String(budgetMonth?.salary_received || '35000'));
  const [savingsInput, setSavingsInput] = useState(String(budgetMonth?.savings_target || '10000'));
  const [isSubmittingSetup, setIsSubmittingSetup] = useState(false);

  const [showLimitsModal, setShowLimitsModal] = useState(false);
  const [limitsDraft, setLimitsDraft] = useState<Record<string, string>>({});
  const [isSubmittingLimits, setIsSubmittingLimits] = useState(false);

  const [customVaultAction, setCustomVaultAction] = useState<'deposit' | 'withdraw' | null>(null);
  const [customVaultAmount, setCustomVaultAmount] = useState('');
  const [customVaultNote, setCustomVaultNote] = useState('');
  const [isSubmittingVault, setIsSubmittingVault] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await refreshData();
    setRefreshing(false);
  };

  // ─── 1-Step Vault Quick Actions ───────────────────────────────────────────
  const handleQuickDeposit = async (amt: number) => {
    try {
      Vibration.vibrate(40);
      await depositToVault(amt, `Quick Vault Deposit`);
      Alert.alert('Vault Updated', `₹${amt.toLocaleString('en-IN')} locked into Vault.`);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Deposit failed');
    }
  };

  const handleQuickWithdraw = (amt: number) => {
    if (amt > vaultBalance) {
      Alert.alert('Insufficient Vault Balance', `You only have ₹${vaultBalance.toLocaleString('en-IN')} in the vault.`);
      return;
    }

    Alert.alert(
      'Withdraw & Spend',
      `Withdrawing ₹${amt.toLocaleString('en-IN')} will immediately log it as spent money from your reserve. Proceed?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Spend ₹' + amt.toLocaleString('en-IN'),
          style: 'destructive',
          onPress: async () => {
            try {
              Vibration.vibrate(60);
              await withdrawFromVault(amt, true, 'Vault withdrawal expense');
              Alert.alert('Vault Spent', `₹${amt.toLocaleString('en-IN')} withdrawn and recorded as spent.`);
            } catch (e: any) {
              Alert.alert('Error', e.message || 'Withdrawal failed');
            }
          },
        },
      ]
    );
  };

  const handleExecuteCustomVault = async () => {
    const num = parseFloat(customVaultAmount);
    if (isNaN(num) || num <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid positive amount.');
      return;
    }

    setIsSubmittingVault(true);
    try {
      if (customVaultAction === 'deposit') {
        await depositToVault(num, customVaultNote || 'Vault manual deposit');
        Alert.alert('Deposited', `₹${num.toLocaleString('en-IN')} deposited to vault.`);
      } else {
        if (num > vaultBalance) {
          Alert.alert('Insufficient Balance', `Vault balance is ₹${vaultBalance.toLocaleString('en-IN')}`);
          setIsSubmittingVault(false);
          return;
        }
        await withdrawFromVault(num, true, customVaultNote || 'Vault withdrawal expense');
        Alert.alert('Withdrawn', `₹${num.toLocaleString('en-IN')} withdrawn and logged as expense.`);
      }
      setCustomVaultAction(null);
      setCustomVaultAmount('');
      setCustomVaultNote('');
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Transaction failed');
    } finally {
      setIsSubmittingVault(false);
    }
  };

  // ─── Setup Budget Blueprint ───────────────────────────────────────────────
  const handleSaveBudgetBlueprint = async () => {
    const sal = parseFloat(salaryInput);
    const sav = parseFloat(savingsInput);
    if (isNaN(sal) || sal <= 0) {
      Alert.alert('Invalid Salary', 'Please enter a valid monthly salary/income.');
      return;
    }
    if (isNaN(sav) || sav < 0 || sav >= sal) {
      Alert.alert('Invalid Savings', 'Savings target must be less than monthly income.');
      return;
    }

    setIsSubmittingSetup(true);
    try {
      await setupBudget(sal, sav);
      setShowSetupModal(false);
      Alert.alert('Blueprint Saved', 'Monthly budget blueprint updated successfully.');
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to update blueprint.');
    } finally {
      setIsSubmittingSetup(false);
    }
  };

  // ─── Save Category Limits ────────────────────────────────────────────────
  const handleOpenLimitsModal = () => {
    const draft: Record<string, string> = {};
    categories.forEach((cat) => {
      const match = categoryLimits.find((l) => l.category_id === cat.id);
      draft[cat.id] = match ? String(match.limit_amount) : '';
    });
    setLimitsDraft(draft);
    setShowLimitsModal(true);
  };

  const handleSaveLimits = async () => {
    setIsSubmittingLimits(true);
    try {
      const payload = Object.entries(limitsDraft)
        .map(([categoryId, strVal]) => ({
          category_id: categoryId,
          limit_amount: parseFloat(strVal) || 0,
        }))
        .filter((item) => item.limit_amount > 0);

      await updateLimits(payload);
      setShowLimitsModal(false);
      Alert.alert('Limits Updated', 'Category envelope limits have been saved.');
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to update limits.');
    } finally {
      setIsSubmittingLimits(false);
    }
  };

  const totalSalary = Number(budgetMonth?.salary_received || budgetMonth?.spendable_allowance || 0);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={DL.muted} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Top Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>WEALTH & ENVELOPES</Text>
            <Text style={styles.title}>The Vault</Text>
          </View>
          <Pressable
            style={({ pressed }) => [styles.blueprintBtn, pressed && styles.btnPressed]}
            onPress={() => {
              Vibration.vibrate(12);
              setSalaryInput(String(budgetMonth?.salary_received || '35000'));
              setSavingsInput(String(budgetMonth?.savings_target || '10000'));
              setShowSetupModal(true);
            }}
          >
            <Text style={styles.blueprintBtnText}>EDIT BLUEPRINT</Text>
          </Pressable>
        </View>

        {/* Hero: Vault Balance Card */}
        <View style={styles.vaultCard}>
          <View style={styles.vaultBadgeRow}>
            <View style={styles.vaultIconPill}>
              <ShieldLockIcon color="#10B981" size={16} />
              <Text style={styles.vaultBadgeText}>LOCKED RESERVE</Text>
            </View>
            <Text style={styles.vaultSubtext}>Off-limits from daily spending</Text>
          </View>

          <Text style={styles.vaultAmount}>
            ₹{Math.round(vaultBalance).toLocaleString('en-IN')}
          </Text>

          {/* Quick 1-Step Vault Actions */}
          <View style={styles.oneStepSection}>
            <Text style={styles.sectionLabel}>1-STEP INSTANT VAULT</Text>

            {/* Quick Deposit Row */}
            <View style={styles.quickActionGroup}>
              <Text style={styles.quickActionTitle}>Deposit (Lock Away)</Text>
              <View style={styles.presetRow}>
                {[500, 1000, 2000, 5000].map((amt) => (
                  <Pressable
                    key={`dep-${amt}`}
                    style={({ pressed }) => [styles.depositChip, pressed && styles.btnPressed]}
                    onPress={() => {
                      Vibration.vibrate(10);
                      handleQuickDeposit(amt);
                    }}
                  >
                    <Text style={styles.depositChipText}>+₹{amt >= 1000 ? `${amt / 1000}k` : amt}</Text>
                  </Pressable>
                ))}
                <Pressable
                  style={({ pressed }) => [styles.depositChip, styles.customChip, pressed && styles.btnPressed]}
                  onPress={() => {
                    Vibration.vibrate(10);
                    setCustomVaultAction('deposit');
                    setCustomVaultAmount('');
                  }}
                >
                  <Text style={styles.customChipText}>Custom</Text>
                </Pressable>
              </View>
            </View>

            {/* Quick Withdraw Row */}
            <View style={styles.quickActionGroup}>
              <Text style={styles.quickActionTitle}>Withdraw & Spend (Emergency Out)</Text>
              <View style={styles.presetRow}>
                {[500, 1000, 2000, 5000].map((amt) => (
                  <Pressable
                    key={`wd-${amt}`}
                    style={({ pressed }) => [styles.withdrawChip, pressed && styles.btnPressed]}
                    onPress={() => {
                      Vibration.vibrate(10);
                      handleQuickWithdraw(amt);
                    }}
                  >
                    <Text style={styles.withdrawChipText}>-₹{amt >= 1000 ? `${amt / 1000}k` : amt}</Text>
                  </Pressable>
                ))}
                <Pressable
                  style={({ pressed }) => [styles.withdrawChip, styles.customChip, pressed && styles.btnPressed]}
                  onPress={() => {
                    Vibration.vibrate(10);
                    setCustomVaultAction('withdraw');
                    setCustomVaultAmount('');
                  }}
                >
                  <Text style={styles.customChipText}>Custom</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </View>

        {/* Blueprint Overview Strip */}
        <View style={styles.blueprintCard}>
          <Text style={styles.sectionHeader}>MONTHLY CASHFLOW ARCHITECTURE</Text>
          <View style={styles.blueprintGrid}>
            <View style={styles.blueprintCol}>
              <Text style={styles.blueprintColLabel}>TOTAL SALARY</Text>
              <Text style={styles.blueprintColVal}>₹{totalSalary.toLocaleString('en-IN')}</Text>
            </View>
            <View style={styles.blueprintDivider} />
            <View style={styles.blueprintCol}>
              <Text style={styles.blueprintColLabel}>TOTAL SPENT</Text>
              <Text style={[styles.blueprintColVal, { color: '#EF4444' }]}>
                ₹{Math.round(budgetState.spent).toLocaleString('en-IN')}
              </Text>
            </View>
            <View style={styles.blueprintDivider} />
            <View style={styles.blueprintCol}>
              <Text style={styles.blueprintColLabel}>SAVINGS GOAL</Text>
              <Text style={[styles.blueprintColVal, { color: '#10B981' }]}>
                ₹{(budgetMonth?.savings_target || 0).toLocaleString('en-IN')}
              </Text>
            </View>
          </View>
        </View>

        {/* Envelope Allocations Section */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionTitleRow}>
            <View>
              <Text style={styles.sectionHeader}>CATEGORY ENVELOPES</Text>
              <Text style={styles.sectionSub}>Monthly ceilings per category</Text>
            </View>
            <Pressable style={styles.manageLimitsBtn} onPress={handleOpenLimitsModal}>
              <Text style={styles.manageLimitsText}>MANAGE LIMITS</Text>
            </Pressable>
          </View>

          {budgetState.categories.length === 0 ? (
            <ActivityIndicator color={DL.muted} style={{ marginVertical: 16 }} />
          ) : (
            budgetState.categories.map((catStatus) => {
              const pct = catStatus.limit > 0 ? Math.min(100, Math.round((catStatus.spent / catStatus.limit) * 100)) : 0;
              const catMeta = categories.find((c) => c.id === catStatus.category_id);

              return (
                <View key={catStatus.category_id} style={styles.envelopeRow}>
                  <View style={styles.envelopeInfo}>
                    <CategoryIcon
                      icon={catMeta?.icon}
                      name={catStatus.category_name}
                      size={36}
                      fontSize={18}
                    />
                    <View style={{ flex: 1 }}>
                      <View style={styles.envelopeNameRow}>
                        <Text style={styles.envelopeName}>{catStatus.category_name}</Text>
                        <Text style={[styles.envelopeSpend, catStatus.isOverspent && { color: '#EF4444' }]}>
                          ₹{Math.round(catStatus.spent).toLocaleString('en-IN')}
                          <Text style={styles.envelopeLimit}>
                            {catStatus.limit > 0 ? ` / ₹${catStatus.limit.toLocaleString('en-IN')}` : ' (No limit)'}
                          </Text>
                        </Text>
                      </View>
                      {catStatus.limit > 0 && (
                        <View style={styles.progressTrack}>
                          <View
                            style={[
                              styles.progressBar,
                              {
                                width: `${pct}%`,
                                backgroundColor: catStatus.isOverspent
                                  ? '#EF4444'
                                  : pct > 80
                                  ? '#F59E0B'
                                  : '#10B981',
                              },
                            ]}
                          />
                        </View>
                      )}
                    </View>
                  </View>
                </View>
              );
            })
          )}
        </View>

        {/* Wealth Iceberg Visualization */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionHeader}>WEALTH ICEBERG & RUNWAY</Text>
          <Text style={styles.sectionSub}>Visualizing liquid buffer vs survival horizon</Text>
          <View style={styles.runwayRow}>
            <View style={styles.runwayPill}>
              <Text style={styles.runwayVal}>{healthState.streakDays} DAYS</Text>
              <Text style={styles.runwayLabel}>Safe Days Streak</Text>
            </View>
            <View style={styles.runwayPill}>
              <Text style={[styles.runwayVal, { color: healthState.score >= 80 ? '#10B981' : '#F59E0B' }]}>
                {healthState.score}%
              </Text>
              <Text style={styles.runwayLabel}>Health Score</Text>
            </View>
          </View>
          <View style={styles.icebergWrap}>
            <IcebergRenderer
              percentRemaining={budgetState.percentRemaining}
              healthScore={healthState.score}
              vaultBalance={vaultBalance}
              goalsTargetSum={budgetMonth?.savings_target || 0}
            />
          </View>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* ─── Setup Blueprint Modal ────────────────────────────────────────── */}
      <Modal visible={showSetupModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>MONTHLY BLUEPRINT</Text>
            <Text style={styles.modalSub}>Configure your expected income and target savings.</Text>

            <Text style={styles.inputLabel}>MONTHLY SALARY / INCOME (₹)</Text>
            <TextInput
              style={styles.input}
              keyboardType="numeric"
              value={salaryInput}
              onChangeText={setSalaryInput}
              placeholder="e.g. 35000"
              placeholderTextColor={DL.muted}
            />

            <Text style={styles.inputLabel}>SAVINGS TARGET (₹)</Text>
            <TextInput
              style={styles.input}
              keyboardType="numeric"
              value={savingsInput}
              onChangeText={setSavingsInput}
              placeholder="e.g. 10000"
              placeholderTextColor={DL.muted}
            />

            <View style={styles.modalBtnRow}>
              <Pressable style={styles.cancelBtn} onPress={() => setShowSetupModal(false)}>
                <Text style={styles.cancelBtnText}>CANCEL</Text>
              </Pressable>
              <Pressable
                style={[styles.submitBtn, isSubmittingSetup && { opacity: 0.6 }]}
                onPress={handleSaveBudgetBlueprint}
                disabled={isSubmittingSetup}
              >
                {isSubmittingSetup ? (
                  <ActivityIndicator color="#000" />
                ) : (
                  <Text style={styles.submitBtnText}>SAVE BLUEPRINT</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* ─── Manage Category Limits Modal ─────────────────────────────────── */}
      <Modal visible={showLimitsModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { maxHeight: '80%' }]}>
            <Text style={styles.modalTitle}>CATEGORY ENVELOPE LIMITS</Text>
            <Text style={styles.modalSub}>Set maximum monthly spending per category.</Text>

            <ScrollView style={{ marginVertical: 12 }} showsVerticalScrollIndicator={false}>
              {categories.map((cat) => (
                <View key={cat.id} style={styles.limitEditRow}>
                  <Text style={styles.limitEditCatName}>
                    {getCategoryEmoji(cat.icon, cat.name)} {cat.name}
                  </Text>
                  <TextInput
                    style={styles.limitInput}
                    keyboardType="numeric"
                    placeholder="Limit ₹"
                    placeholderTextColor={DL.muted}
                    value={limitsDraft[cat.id] || ''}
                    onChangeText={(val) =>
                      setLimitsDraft((prev) => ({ ...prev, [cat.id]: val }))
                    }
                  />
                </View>
              ))}
            </ScrollView>

            <View style={styles.modalBtnRow}>
              <Pressable style={styles.cancelBtn} onPress={() => setShowLimitsModal(false)}>
                <Text style={styles.cancelBtnText}>CANCEL</Text>
              </Pressable>
              <Pressable
                style={[styles.submitBtn, isSubmittingLimits && { opacity: 0.6 }]}
                onPress={handleSaveLimits}
                disabled={isSubmittingLimits}
              >
                {isSubmittingLimits ? (
                  <ActivityIndicator color="#000" />
                ) : (
                  <Text style={styles.submitBtnText}>SAVE LIMITS</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* ─── Custom Vault Deposit / Withdraw Modal ────────────────────────── */}
      <Modal visible={customVaultAction !== null} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {customVaultAction === 'deposit' ? 'DEPOSIT TO VAULT' : 'WITHDRAW & SPEND'}
            </Text>
            <Text style={styles.modalSub}>
              {customVaultAction === 'deposit'
                ? 'Lock funds away into your protected vault.'
                : 'Withdrawn funds are recorded as spent expenses.'}
            </Text>

            <Text style={styles.inputLabel}>AMOUNT (₹)</Text>
            <TextInput
              style={styles.input}
              keyboardType="numeric"
              value={customVaultAmount}
              onChangeText={setCustomVaultAmount}
              placeholder="e.g. 2500"
              placeholderTextColor={DL.muted}
              autoFocus
            />

            <Text style={styles.inputLabel}>NOTE / PURPOSE</Text>
            <TextInput
              style={styles.input}
              value={customVaultNote}
              onChangeText={setCustomVaultNote}
              placeholder="e.g. Emergency repair, Freelance bonus"
              placeholderTextColor={DL.muted}
            />

            <View style={styles.modalBtnRow}>
              <Pressable style={styles.cancelBtn} onPress={() => setCustomVaultAction(null)}>
                <Text style={styles.cancelBtnText}>CANCEL</Text>
              </Pressable>
              <Pressable
                style={[
                  styles.submitBtn,
                  customVaultAction === 'withdraw' && { backgroundColor: '#EF4444' },
                  isSubmittingVault && { opacity: 0.6 },
                ]}
                onPress={handleExecuteCustomVault}
                disabled={isSubmittingVault}
              >
                {isSubmittingVault ? (
                  <ActivityIndicator color="#000" />
                ) : (
                  <Text
                    style={[
                      styles.submitBtnText,
                      customVaultAction === 'withdraw' && { color: '#FFFFFF' },
                    ]}
                  >
                    {customVaultAction === 'deposit' ? 'DEPOSIT' : 'WITHDRAW & SPEND'}
                  </Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: DL.bg,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  btnPressed: {
    opacity: 0.72,
    transform: [{ scale: 0.96 }],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
  },
  eyebrow: {
    fontFamily: DLFonts.mono,
    fontSize: 10,
    letterSpacing: 2,
    color: DL.muted,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: DL.text,
    letterSpacing: -0.5,
    marginTop: 2,
  },
  blueprintBtn: {
    backgroundColor: DL.card,
    borderColor: DL.border,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  blueprintBtnText: {
    fontFamily: DLFonts.mono,
    fontSize: 10,
    fontWeight: '700',
    color: DL.text,
    letterSpacing: 1,
  },
  vaultCard: {
    backgroundColor: DL.card,
    borderColor: DL.border,
    borderWidth: 1,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  vaultBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  vaultIconPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderColor: 'rgba(16, 185, 129, 0.3)',
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  vaultBadgeText: {
    fontFamily: DLFonts.mono,
    fontSize: 10,
    fontWeight: '700',
    color: '#10B981',
    letterSpacing: 1,
  },
  vaultSubtext: {
    fontFamily: DLFonts.mono,
    fontSize: 10,
    color: DL.muted,
  },
  vaultAmount: {
    fontFamily: DLFonts.mono,
    fontSize: 34,
    fontWeight: '800',
    color: DL.text,
    letterSpacing: -1,
    marginVertical: 6,
  },
  oneStepSection: {
    marginTop: 16,
    paddingTop: 16,
    borderTopColor: DL.border,
    borderTopWidth: 1,
  },
  sectionLabel: {
    fontFamily: DLFonts.mono,
    fontSize: 9,
    letterSpacing: 1.5,
    color: DL.muted,
    marginBottom: 12,
  },
  quickActionGroup: {
    marginBottom: 12,
  },
  quickActionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: DL.text,
    marginBottom: 8,
  },
  presetRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  depositChip: {
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderColor: 'rgba(16, 185, 129, 0.3)',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  depositChipText: {
    fontFamily: DLFonts.mono,
    fontSize: 12,
    fontWeight: '700',
    color: '#10B981',
  },
  withdrawChip: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderColor: 'rgba(239, 68, 68, 0.3)',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  withdrawChipText: {
    fontFamily: DLFonts.mono,
    fontSize: 12,
    fontWeight: '700',
    color: '#EF4444',
  },
  customChip: {
    backgroundColor: DL.border,
    borderColor: DL.border,
  },
  customChipText: {
    fontFamily: DLFonts.mono,
    fontSize: 12,
    color: DL.text,
  },
  blueprintCard: {
    backgroundColor: DL.card,
    borderColor: DL.border,
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
  },
  sectionHeader: {
    fontFamily: DLFonts.mono,
    fontSize: 10,
    letterSpacing: 1.5,
    color: DL.muted,
    fontWeight: '700',
  },
  sectionSub: {
    fontSize: 12,
    color: DL.muted,
    marginTop: 2,
  },
  blueprintGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
  },
  blueprintCol: {
    flex: 1,
    alignItems: 'center',
  },
  blueprintColLabel: {
    fontFamily: DLFonts.mono,
    fontSize: 9,
    letterSpacing: 1,
    color: DL.muted,
    marginBottom: 4,
  },
  blueprintColVal: {
    fontFamily: DLFonts.mono,
    fontSize: 15,
    fontWeight: '800',
    color: DL.text,
  },
  blueprintDivider: {
    width: 1,
    height: 28,
    backgroundColor: DL.border,
  },
  sectionCard: {
    backgroundColor: DL.card,
    borderColor: DL.border,
    borderWidth: 1,
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  manageLimitsBtn: {
    backgroundColor: DL.border,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  manageLimitsText: {
    fontFamily: DLFonts.mono,
    fontSize: 9,
    fontWeight: '700',
    color: DL.text,
    letterSpacing: 1,
  },
  envelopeRow: {
    paddingVertical: 10,
    borderBottomColor: DL.border,
    borderBottomWidth: 1,
  },
  envelopeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  envelopeIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: DL.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  envelopeIcon: {
    fontSize: 18,
  },
  envelopeNameRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  envelopeName: {
    fontSize: 14,
    fontWeight: '600',
    color: DL.text,
  },
  envelopeSpend: {
    fontFamily: DLFonts.mono,
    fontSize: 13,
    fontWeight: '700',
    color: DL.text,
  },
  envelopeLimit: {
    color: DL.muted,
    fontSize: 11,
  },
  progressTrack: {
    height: 4,
    backgroundColor: DL.border,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: 2,
  },
  runwayRow: {
    flexDirection: 'row',
    gap: 12,
    marginVertical: 14,
  },
  runwayPill: {
    flex: 1,
    backgroundColor: '#090B0E',
    borderColor: DL.border,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
  },
  runwayVal: {
    fontFamily: DLFonts.mono,
    fontSize: 20,
    fontWeight: '800',
    color: DL.text,
  },
  runwayLabel: {
    fontFamily: DLFonts.mono,
    fontSize: 9,
    letterSpacing: 1,
    color: DL.muted,
    marginTop: 2,
  },
  icebergWrap: {
    marginTop: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: DL.card,
    borderColor: DL.border,
    borderWidth: 1,
    borderRadius: 18,
    padding: 22,
  },
  modalTitle: {
    fontFamily: DLFonts.mono,
    fontSize: 14,
    fontWeight: '800',
    color: DL.text,
    letterSpacing: 1.5,
  },
  modalSub: {
    fontSize: 12,
    color: DL.muted,
    marginTop: 4,
    marginBottom: 16,
  },
  inputLabel: {
    fontFamily: DLFonts.mono,
    fontSize: 9,
    letterSpacing: 1,
    color: DL.muted,
    marginBottom: 6,
    marginTop: 10,
  },
  input: {
    backgroundColor: '#F8FAFC',
    borderColor: DL.border,
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    color: DL.text,
    fontFamily: DLFonts.mono,
    fontSize: 15,
  },
  modalBtnRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  cancelBtn: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    borderColor: DL.border,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  cancelBtnText: {
    fontFamily: DLFonts.mono,
    fontSize: 11,
    fontWeight: '700',
    color: DL.muted,
    letterSpacing: 1,
  },
  submitBtn: {
    flex: 1,
    backgroundColor: DL.text,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  submitBtnText: {
    fontFamily: DLFonts.mono,
    fontSize: 11,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 1,
  },
  limitEditRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomColor: DL.border,
    borderBottomWidth: 1,
  },
  limitEditCatName: {
    fontSize: 14,
    color: DL.text,
    fontWeight: '500',
  },
  limitInput: {
    width: 100,
    backgroundColor: '#F8FAFC',
    borderColor: DL.border,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    color: DL.text,
    fontFamily: DLFonts.mono,
    fontSize: 13,
    textAlign: 'right',
  },
});
