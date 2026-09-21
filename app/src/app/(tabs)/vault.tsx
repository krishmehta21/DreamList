import React, { useState, useMemo } from 'react';
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
  Platform,
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
    transactions,
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
  // Do NOT fill any default salary! Start empty or with existing value
  const [salaryInput, setSalaryInput] = useState(
    budgetMonth?.salary_received ? String(budgetMonth.salary_received) : ''
  );
  const [savingsInput, setSavingsInput] = useState(
    budgetMonth?.savings_target ? String(budgetMonth.savings_target) : ''
  );
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

  // Safe tab bar clearance
  const tabBottom = Platform.OS === 'ios' ? Math.max(insets.bottom, 16) : 16;

  // ─── 1-Step Vault Quick Actions ───────────────────────────────────────────
  const handleQuickDeposit = async (amt: number) => {
    try {
      Vibration.vibrate(40);
      await depositToVault(amt, 'Quick Vault Deposit');
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
    const sav = savingsInput ? parseFloat(savingsInput) : 0;
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

  // ─── Financial Runway Calculation ────────────────────────────────────────
  const actualLoggedIncome = useMemo(() => {
    const savingsCat = categories.find((c) => c.name.toLowerCase() === 'savings');
    return transactions
      .filter((t) => t.type === 'income' && (!savingsCat || t.category_id !== savingsCat.id))
      .reduce((sum, t) => sum + Number(t.amount), 0);
  }, [transactions, categories]);

  const monthlySpent = Math.round(budgetState.spent);
  const runwayMonths = useMemo(() => {
    if (vaultBalance <= 0) return 0;
    if (monthlySpent <= 0) return vaultBalance > 0 ? 12 : 0;
    return Math.round((vaultBalance / monthlySpent) * 10) / 10;
  }, [vaultBalance, monthlySpent]);

  const runwayDays = useMemo(() => {
    return Math.round(runwayMonths * 30.5);
  }, [runwayMonths]);

  return (
    <View style={[styles.container, { paddingTop: insets.top + 8 }]}>
      {/* Ambient glowing circles */}
      <View style={styles.ambientGlowTopRight} pointerEvents="none" />
      <View style={styles.ambientGlowBottomLeft} pointerEvents="none" />

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: tabBottom + 110 },
        ]}
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
              setSalaryInput(budgetMonth?.salary_received ? String(budgetMonth.salary_received) : '');
              setSavingsInput(budgetMonth?.savings_target ? String(budgetMonth.savings_target) : '');
              setShowSetupModal(true);
            }}
          >
            <Text style={styles.blueprintBtnText}>EDIT BLUEPRINT</Text>
          </Pressable>
        </View>

        {/* ─── Hero: Vault Balance Card ────────────────────────────────────── */}
        <View style={styles.vaultCard}>
          <View style={styles.vaultBadgeRow}>
            <View style={styles.vaultIconPill}>
              <ShieldLockIcon color="#10B981" size={16} />
              <Text style={styles.vaultBadgeText}>LOCKED RESERVE</Text>
            </View>
            <Text style={styles.vaultSubtext}>Off-limits from daily impulse spend</Text>
          </View>

          <Text style={styles.vaultAmount}>
            ₹{Math.round(vaultBalance).toLocaleString('en-IN')}
          </Text>

          {/* Quick 1-Step Vault Actions */}
          <View style={styles.oneStepSection}>
            <Text style={styles.sectionLabel}>1-STEP INSTANT VAULT</Text>

            {/* Quick Deposit Row */}
            <View style={styles.quickActionGroup}>
              <Text style={styles.quickActionTitle}>Deposit (Store Away)</Text>
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
              <Text style={styles.quickActionTitle}>Withdraw (Emergency Out)</Text>
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

        {/* ─── Cashflow Architecture Overview ──────────────────────────────── */}
        <View style={styles.blueprintCard}>
          <Text style={styles.sectionHeader}>MONTHLY CASHFLOW ARCHITECTURE</Text>
          <View style={styles.blueprintGrid}>
            <View style={styles.blueprintCol}>
              <Text style={styles.blueprintColLabel}>ACTUAL INCOME</Text>
              <Text style={[styles.blueprintColVal, { color: actualLoggedIncome > 0 ? '#10B981' : '#64748B' }]}>
                ₹{actualLoggedIncome.toLocaleString('en-IN')}
              </Text>
            </View>
            <View style={styles.blueprintDivider} />
            <View style={styles.blueprintCol}>
              <Text style={styles.blueprintColLabel}>TOTAL SPENT</Text>
              <Text style={[styles.blueprintColVal, { color: monthlySpent > 0 ? '#EF4444' : '#64748B' }]}>
                ₹{monthlySpent.toLocaleString('en-IN')}
              </Text>
            </View>
            <View style={styles.blueprintDivider} />
            <View style={styles.blueprintCol}>
              <Text style={styles.blueprintColLabel}>SAVINGS GOAL</Text>
              <Text style={[styles.blueprintColVal, { color: '#4F46E5' }]}>
                {budgetMonth?.savings_target ? `₹${Number(budgetMonth.savings_target).toLocaleString('en-IN')}` : 'None'}
              </Text>
            </View>
          </View>
        </View>

        {/* ─── Wealth Iceberg & Financial Runway ────────────────────────────── */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionTitleRow}>
            <View>
              <Text style={styles.sectionHeader}>WEALTH ICEBERG & RUNWAY</Text>
              <Text style={styles.sectionSub}>Survival runway & protected reserves</Text>
            </View>
          </View>

          {/* Clean Light-Themed Runway Horizon Cards */}
          <View style={styles.runwayRow}>
            <View style={styles.runwayCard}>
              <Text style={styles.runwayVal}>
                {runwayMonths > 0 ? `${runwayMonths} mo` : '0 days'}
              </Text>
              <Text style={styles.runwayLabel}>Financial Runway</Text>
              <Text style={styles.runwayHint}>
                {runwayDays > 0 ? `~${runwayDays} days of survival` : 'Fund safety reserve'}
              </Text>
            </View>

            <View style={styles.runwayCard}>
              <Text style={[styles.runwayVal, { color: '#0369A1' }]}>
                {monthlySpent > 0 ? `₹${monthlySpent.toLocaleString('en-IN')}` : '₹0'}
              </Text>
              <Text style={styles.runwayLabel}>Monthly Burn Rate</Text>
              <Text style={styles.runwayHint}>Outflow this cycle</Text>
            </View>
          </View>

          {/* Self-Contained Vector Iceberg Component */}
          <IcebergRenderer
            percentRemaining={budgetState.percentRemaining}
            healthScore={healthState.score}
            vaultBalance={vaultBalance}
            goalsTargetSum={budgetMonth?.savings_target || budgetState.remaining || 0}
          />
        </View>

        {/* ─── Category Envelopes Section ──────────────────────────────────── */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionTitleRow}>
            <View>
              <Text style={styles.sectionHeader}>CATEGORY ENVELOPES</Text>
              <Text style={styles.sectionSub}>Monthly ceilings per category</Text>
            </View>
            <Pressable
              style={({ pressed }) => [styles.manageLimitsBtn, pressed && styles.btnPressed]}
              onPress={handleOpenLimitsModal}
            >
              <Text style={styles.manageLimitsText}>MANAGE LIMITS</Text>
            </Pressable>
          </View>

          {budgetState.categories.length === 0 ? (
            <View style={styles.emptyEnvelopes}>
              <Text style={styles.emptyEnvelopesText}>
                No category envelopes set yet. Tap "MANAGE LIMITS" to set spending caps.
              </Text>
            </View>
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
      </ScrollView>

      {/* ─── Setup Blueprint Modal ────────────────────────────────────────── */}
      <Modal visible={showSetupModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>MONTHLY BLUEPRINT</Text>
            <Text style={styles.modalSub}>Configure your expected income and target savings.</Text>

            <Text style={styles.inputLabel}>MONTHLY SALARY / EXPECTED INCOME (₹)</Text>
            <TextInput
              style={styles.input}
              keyboardType="numeric"
              value={salaryInput}
              onChangeText={setSalaryInput}
              placeholder="e.g. 50000"
              placeholderTextColor="#94A3B8"
            />

            <Text style={styles.inputLabel}>SAVINGS TARGET (OPTIONAL) (₹)</Text>
            <TextInput
              style={styles.input}
              keyboardType="numeric"
              value={savingsInput}
              onChangeText={setSavingsInput}
              placeholder="e.g. 10000"
              placeholderTextColor="#94A3B8"
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
                  <ActivityIndicator color="#FFFFFF" size="small" />
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
            <Text style={styles.modalSub}>Set maximum monthly spending ceilings per category.</Text>

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
                    placeholderTextColor="#94A3B8"
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
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.submitBtnText}>SAVE LIMITS</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* ─── Custom Vault Deposit / Withdraw Modal ────────────────────────── */}
      <Modal visible={!!customVaultAction} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {customVaultAction === 'deposit' ? 'DEPOSIT TO VAULT' : 'WITHDRAW FROM VAULT'}
            </Text>
            <Text style={styles.modalSub}>
              {customVaultAction === 'deposit'
                ? 'Lock cash away into your protected wealth reserve.'
                : 'Withdraw cash from vault reserve to spend immediately.'}
            </Text>

            <Text style={styles.inputLabel}>AMOUNT (₹)</Text>
            <TextInput
              style={styles.input}
              keyboardType="numeric"
              placeholder="e.g. 2500"
              placeholderTextColor="#94A3B8"
              value={customVaultAmount}
              onChangeText={setCustomVaultAmount}
            />

            <Text style={styles.inputLabel}>REASON / NOTE (OPTIONAL)</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Emergency buffer, Bonus"
              placeholderTextColor="#94A3B8"
              value={customVaultNote}
              onChangeText={setCustomVaultNote}
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
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.submitBtnText}>
                    {customVaultAction === 'deposit' ? 'DEPOSIT' : 'WITHDRAW'}
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

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: DL.bg,
  },
  ambientGlowTopRight: {
    position: 'absolute',
    top: -40,
    right: -40,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
  },
  ambientGlowBottomLeft: {
    position: 'absolute',
    bottom: 80,
    left: -60,
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: 'rgba(6, 182, 212, 0.07)',
  },
  scrollContent: {
    paddingHorizontal: 18,
    paddingTop: 8,
  },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 16,
  },
  eyebrow: {
    fontFamily: DLFonts.mono,
    fontSize: 10,
    letterSpacing: 2,
    color: '#64748B',
    fontWeight: '700',
    marginBottom: 2,
  },
  title: {
    fontFamily: DLFonts.sans,
    fontSize: 26,
    fontWeight: '900',
    color: DL.text,
    letterSpacing: -0.5,
  },
  blueprintBtn: {
    backgroundColor: '#FFFFFF',
    borderColor: 'rgba(226, 232, 240, 0.9)',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 7,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  blueprintBtnText: {
    fontFamily: DLFonts.mono,
    fontSize: 9.5,
    fontWeight: '800',
    color: '#4F46E5',
    letterSpacing: 0.8,
  },

  // Vault Hero Card
  vaultCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(226, 232, 240, 0.9)',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.07,
    shadowRadius: 18,
    elevation: 4,
  },
  vaultBadgeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  vaultIconPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#ECFDF5',
    borderColor: 'rgba(16, 185, 129, 0.3)',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  vaultBadgeText: {
    fontFamily: DLFonts.mono,
    fontSize: 10,
    fontWeight: '800',
    color: '#059669',
    letterSpacing: 0.5,
  },
  vaultSubtext: {
    fontFamily: DLFonts.sans,
    fontSize: 11,
    color: '#94A3B8',
  },
  vaultAmount: {
    fontFamily: DLFonts.sans,
    fontSize: 34,
    fontWeight: '900',
    color: '#0B132B',
    letterSpacing: -0.8,
    marginBottom: 16,
  },

  // 1-Step Instant Vault Section
  oneStepSection: {
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 14,
  },
  sectionLabel: {
    fontFamily: DLFonts.mono,
    fontSize: 9.5,
    fontWeight: '700',
    letterSpacing: 1.2,
    color: '#64748B',
    marginBottom: 10,
  },
  quickActionGroup: {
    marginBottom: 12,
  },
  quickActionTitle: {
    fontFamily: DLFonts.sans,
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 6,
  },
  presetRow: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
  },
  depositChip: {
    backgroundColor: '#ECFDF5',
    borderColor: 'rgba(16, 185, 129, 0.3)',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  depositChipText: {
    fontFamily: DLFonts.mono,
    fontSize: 11.5,
    fontWeight: '800',
    color: '#059669',
  },
  withdrawChip: {
    backgroundColor: '#FEF2F2',
    borderColor: 'rgba(239, 68, 68, 0.25)',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  withdrawChipText: {
    fontFamily: DLFonts.mono,
    fontSize: 11.5,
    fontWeight: '800',
    color: '#DC2626',
  },
  customChip: {
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
  },
  customChipText: {
    fontFamily: DLFonts.mono,
    fontSize: 11.5,
    color: '#475569',
    fontWeight: '700',
  },

  // Blueprint Card
  blueprintCard: {
    backgroundColor: '#FFFFFF',
    borderColor: 'rgba(226, 232, 240, 0.9)',
    borderWidth: 1,
    borderRadius: 20,
    padding: 18,
    marginBottom: 16,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
  },
  sectionHeader: {
    fontFamily: DLFonts.mono,
    fontSize: 10,
    letterSpacing: 1.2,
    color: '#64748B',
    fontWeight: '800',
  },
  sectionSub: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
  },
  blueprintGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 14,
  },
  blueprintCol: {
    flex: 1,
    alignItems: 'center',
  },
  blueprintColLabel: {
    fontFamily: DLFonts.mono,
    fontSize: 9,
    letterSpacing: 0.8,
    color: '#64748B',
    marginBottom: 4,
  },
  blueprintColVal: {
    fontFamily: DLFonts.sans,
    fontSize: 16,
    fontWeight: '900',
    color: DL.text,
  },
  blueprintDivider: {
    width: 1,
    height: 30,
    backgroundColor: '#F1F5F9',
  },

  // Section Card
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderColor: 'rgba(226, 232, 240, 0.9)',
    borderWidth: 1,
    borderRadius: 22,
    padding: 18,
    marginBottom: 16,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 3,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  manageLimitsBtn: {
    backgroundColor: '#F0F4FC',
    borderColor: '#E2E8F0',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  manageLimitsText: {
    fontFamily: DLFonts.mono,
    fontSize: 9.5,
    fontWeight: '800',
    color: '#4F46E5',
    letterSpacing: 0.8,
  },

  // Runway Cards
  runwayRow: {
    flexDirection: 'row',
    gap: 10,
    marginVertical: 12,
  },
  runwayCard: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderColor: 'rgba(226, 232, 240, 0.9)',
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    alignItems: 'flex-start',
  },
  runwayVal: {
    fontFamily: DLFonts.sans,
    fontSize: 22,
    fontWeight: '900',
    color: '#0B132B',
    letterSpacing: -0.5,
  },
  runwayLabel: {
    fontFamily: DLFonts.sans,
    fontSize: 11.5,
    fontWeight: '700',
    color: '#475569',
    marginTop: 2,
  },
  runwayHint: {
    fontFamily: DLFonts.mono,
    fontSize: 9.5,
    color: '#94A3B8',
    marginTop: 3,
  },

  // Category Envelopes
  envelopeRow: {
    paddingVertical: 10,
    borderBottomColor: '#F8FAFC',
    borderBottomWidth: 1,
  },
  envelopeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  envelopeNameRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  envelopeName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  envelopeSpend: {
    fontFamily: DLFonts.mono,
    fontSize: 12.5,
    fontWeight: '700',
    color: '#0F172A',
  },
  envelopeLimit: {
    color: '#94A3B8',
    fontSize: 11,
  },
  progressTrack: {
    height: 4,
    backgroundColor: '#F1F5F9',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: 2,
  },
  emptyEnvelopes: {
    paddingVertical: 18,
    alignItems: 'center',
  },
  emptyEnvelopesText: {
    fontFamily: DLFonts.sans,
    fontSize: 12.5,
    color: '#94A3B8',
    textAlign: 'center',
  },

  // Modals
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'center',
    padding: 22,
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderColor: 'rgba(226, 232, 240, 0.9)',
    borderWidth: 1,
    borderRadius: 24,
    padding: 24,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 8,
  },
  modalTitle: {
    fontFamily: DLFonts.mono,
    fontSize: 13,
    fontWeight: '800',
    color: '#0B132B',
    letterSpacing: 1.5,
  },
  modalSub: {
    fontSize: 12.5,
    color: '#64748B',
    marginTop: 4,
    marginBottom: 16,
  },
  inputLabel: {
    fontFamily: DLFonts.mono,
    fontSize: 9.5,
    letterSpacing: 1,
    color: '#64748B',
    marginBottom: 6,
    marginTop: 10,
    fontWeight: '700',
  },
  input: {
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
    borderWidth: 1.2,
    borderRadius: 12,
    padding: 12,
    color: '#0F172A',
    fontFamily: DLFonts.sans,
    fontSize: 14.5,
  },
  modalBtnRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 22,
  },
  cancelBtn: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
  },
  cancelBtnText: {
    fontFamily: DLFonts.mono,
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    letterSpacing: 0.8,
  },
  submitBtn: {
    flex: 1,
    backgroundColor: '#4F46E5',
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
  },
  submitBtnText: {
    fontFamily: DLFonts.mono,
    fontSize: 11,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.8,
  },

  limitEditRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 9,
    borderBottomColor: '#F1F5F9',
    borderBottomWidth: 1,
  },
  limitEditCatName: {
    fontSize: 14,
    color: '#0F172A',
    fontWeight: '600',
  },
  limitInput: {
    width: 110,
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
    borderWidth: 1.2,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
    color: '#0F172A',
    fontFamily: DLFonts.mono,
    fontSize: 13,
    textAlign: 'right',
  },

  btnPressed: {
    opacity: 0.82,
    transform: [{ scale: 0.97 }],
  },
});
