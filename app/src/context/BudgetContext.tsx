import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { 
  BudgetMonth, 
  CategoryLimit, 
  RecoveryPlan, 
  DerivedBudgetState, 
  DerivedHealthState,
  RegretLevel,
  CategoryLimitStatus,
  UserProfile,
  Goal,
  GoalAllocation
} from '../lib/budgetTypes';
import { 
  Transaction, 
  ExpenseCategory, 
  fetchCategories,
  createTransaction as apiCreateTransaction,
  deleteTransaction as apiDeleteTransaction
} from '../lib/expensesApi';
import { 
  fetchActiveBudgetMonth, 
  initializeBudgetMonth, 
  fetchCategoryLimits, 
  saveCategoryLimits, 
  fetchActiveRecoveryPlan, 
  createRecoveryPlan, 
  updateRecoveryPlan
} from '../lib/budgetApi';

type ThemeName = 'emerald_forest' | 'amber_warning' | 'crimson_sunset';

interface BudgetContextType {
  activeMonth: string; // YYYY-MM
  budgetMonth: BudgetMonth | null;
  transactions: Transaction[];
  categoryLimits: CategoryLimit[];
  activeRecoveryPlan: RecoveryPlan | null;
  categories: ExpenseCategory[];
  isLoading: boolean;
  error: Error | null;
  
  // Custom user profile and vault calculations
  userProfile: UserProfile | null;
  vaultBalance: number;
  updateProfileDisplayName: (displayName: string) => Promise<void>;
  
  // Custom goals
  goals: Goal[];
  addGoal: (name: string, targetAmount: number, icon: string, linkedItemId?: string | null) => Promise<void>;
  updateGoal: (id: string, name: string, targetAmount: number, icon: string, linkedItemId?: string | null) => Promise<void>;
  deleteGoal: (id: string) => Promise<void>;
  contributeToGoal: (goalId: string, amount: number, isDeposit: boolean, note: string | null) => Promise<void>;

  // Custom goal allocations (deprecated but kept for compatibility)
  goalAllocations: GoalAllocation[];
  updateGoalAllocations: (allocations: { goal_name: string; percent: number }[]) => Promise<void>;

  // Derived states
  budgetState: DerivedBudgetState;
  healthState: DerivedHealthState;
  themeName: ThemeName;
  
  // Actions
  changeMonth: (monthStr: string) => Promise<void>;
  setupBudget: (salary: number, savingsTarget: number) => Promise<void>;
  addTransaction: (payload: {
    amount: number;
    category_id: string;
    note: string | null;
    occurred_at: string;
    is_ghost?: boolean;
    type?: 'expense' | 'income';
    goal_id?: string | null;
  }) => Promise<Transaction>;
  deleteTransactionContext: (transactionId: string) => Promise<void>;
  bulkDeleteTransactions: (transactionIds: string[]) => Promise<void>;
  bulkAddTransactions: (items: {
    amount: number;
    category_id: string;
    note: string | null;
    type?: 'expense' | 'income';
    occurred_at?: string;
  }[]) => Promise<void>;
  duplicateTransactionContext: (transaction: Transaction) => Promise<Transaction>;
  depositToVault: (amount: number, note?: string) => Promise<void>;
  withdrawFromVault: (amount: number, asExpense: boolean, note?: string) => Promise<void>;
  updateLimits: (limits: { category_id: string; limit_amount: number }[]) => Promise<void>;
  triggerRecovery: (durationDays: number) => Promise<RecoveryPlan>;
  rateTransaction: (transactionId: string, rating: RegretLevel) => Promise<void>;
  resetMonthData: (monthStr?: string) => Promise<void>;
  refreshData: () => Promise<void>;
}

export const isFixedExpenseCategory = (name?: string | null) => {
  if (!name) return false;
  const n = name.toLowerCase().trim();
  return (
    n.includes('bill') ||
    n.includes('rent') ||
    n.includes('utilit') ||
    n.includes('emi') ||
    n.includes('loan') ||
    n.includes('tax') ||
    n.includes('insurance') ||
    n.includes('electric') ||
    n.includes('water') ||
    n.includes('wifi') ||
    n.includes('broadband') ||
    n.includes('recharge') ||
    n.includes('subscription') ||
    n.includes('fee') ||
    n.includes('medical') ||
    n.includes('maintenance')
  );
};

const BudgetContext = createContext<BudgetContextType | undefined>(undefined);

export function useBudget() {
  const context = useContext(BudgetContext);
  if (!context) throw new Error('useBudget must be used within a BudgetProvider');
  return context;
}

export const BudgetProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeMonth, setActiveMonth] = useState<string>(() => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  });

  const [budgetMonth, setBudgetMonth] = useState<BudgetMonth | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categoryLimits, setCategoryLimits] = useState<CategoryLimit[]>([]);
  const [activeRecoveryPlan, setActiveRecoveryPlan] = useState<RecoveryPlan | null>(null);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Custom goal allocations state (deprecated)
  const [goalAllocations, setGoalAllocations] = useState<GoalAllocation[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);

  // Helper to map goals and keep price in sync
  const mapGoalData = useCallback((g: any): Goal => {
    let targetAmount = Number(g.target_amount);
    if (g.wishlist_items) {
      const item = g.wishlist_items;
      const prices = item.item_prices || [];
      if (prices.length > 0) {
        const lowestPrice = Math.min(...prices.map((p: any) => Number(p.price)));
        if (lowestPrice > 0) {
          targetAmount = lowestPrice;
        }
      }
    }
    return {
      id: g.id,
      user_id: g.user_id,
      name: g.name,
      target_amount: targetAmount,
      icon: g.icon,
      created_at: g.created_at,
      linked_item_id: g.linked_item_id,
    };
  }, []);

  // Helper to load goals
  const loadGoals = useCallback(async (userId: string) => {
    try {
      const { data, error: gErr } = await supabase
        .from('goals')
        .select('*, wishlist_items(*, item_prices(*))')
        .order('created_at', { ascending: true });
      if (gErr) throw gErr;
      
      const mapped = (data || []).map(mapGoalData);
      setGoals(mapped);
    } catch (err) {
      console.warn('Failed to load goals:', err);
    }
  }, [mapGoalData]);

  // Helper to load/seed goals (deprecated, kept for compatibility)
  const loadGoalAllocations = useCallback(async (userId: string) => {
    setGoalAllocations([]);
  }, []);


  // Fetch all foundation data for the current active month in parallel
  const loadData = useCallback(async (monthStr: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setCategories([]);
        setBudgetMonth(null);
        setUserProfile(null);
        setTransactions([]);
        setCategoryLimits([]);
        setActiveRecoveryPlan(null);
        setIsLoading(false);
        return;
      }

      const startDate = `${monthStr}-01`;
      const [year, month] = monthStr.split('-').map(Number);
      const endDay = new Date(year, month, 0).getDate();
      const endDate = `${monthStr}-${String(endDay).padStart(2, '0')}`;

      // Execute primary independent fetches in parallel
      const [allCats, bMonth, profileRes, txRes] = await Promise.all([
        fetchCategories(),
        fetchActiveBudgetMonth(monthStr),
        supabase.from('users').select('*').eq('id', session.user.id).single(),
        supabase
          .from('transactions')
          .select(`*, category:expense_categories (*)`)
          .gte('occurred_at', startDate)
          .lte('occurred_at', endDate)
          .order('occurred_at', { ascending: false }),
        loadGoals(session.user.id),
        loadGoalAllocations(session.user.id),
      ]);

      setCategories(allCats);
      setBudgetMonth(bMonth);

      if (!profileRes.error && profileRes.data) {
        setUserProfile(profileRes.data);
      } else {
        setUserProfile({
          id: session.user.id,
          email: session.user.email || '',
          created_at: new Date().toISOString(),
        });
      }

      if (txRes.error) throw txRes.error;
      setTransactions(txRes.data || []);

      if (bMonth) {
        // Parallel fetch of category limits and active recovery plan
        const [limits, plan] = await Promise.all([
          fetchCategoryLimits(bMonth.id),
          fetchActiveRecoveryPlan(bMonth.id),
        ]);
        setCategoryLimits(limits);
        setActiveRecoveryPlan(plan);
      } else {
        setTransactions([]);
        setCategoryLimits([]);
        setActiveRecoveryPlan(null);
      }
    } catch (err) {
      console.error('Error loading budget data:', err);
      setError(err instanceof Error ? err : new Error('Unknown error loading data'));
    } finally {
      setIsLoading(false);
    }
  }, [loadGoals, loadGoalAllocations]);

  // Reload data trigger and auth state listener
  useEffect(() => {
    loadData(activeMonth);

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      loadData(activeMonth);
    });

    return () => subscription.unsubscribe();
  }, [activeMonth, loadData]);

  // Derived Budget calculations (Allowance, Spent, Remaining, Safe Spend, Category Limits)
  const budgetState = useMemo<DerivedBudgetState>(() => {
    const savingsCat = categories.find(c => c.name.toLowerCase() === 'savings');

    // actualIncome = sum of all income transactions (excluding pure savings transfers)
    const actualIncome = transactions
      .filter(tx => tx.type === 'income' && (!savingsCat || tx.category_id !== savingsCat.id))
      .reduce((sum, tx) => sum + Number(tx.amount), 0);

    // spent = sum of all expense transactions (excluding pure savings transfers and ghost items)
    const spent = transactions
      .filter(tx => tx.type === 'expense' && !tx.is_ghost && (!savingsCat || tx.category_id !== savingsCat.id))
      .reduce((sum, tx) => sum + Number(tx.amount), 0);

    // Base allowance is the actual income logged. Only fall back to planned salary if explicitly configured.
    // Never inject an artificial default salary!
    const plannedSalary = budgetMonth?.salary_received ? Number(budgetMonth.salary_received) : 0;
    const allowance = actualIncome > 0 ? actualIncome : plannedSalary;

    // Remaining cash balance is allowance - spent
    const remaining = allowance - spent;
    const percentRemaining = allowance > 0 ? Math.max(0, (remaining / allowance) * 100) : 0;

    // Daily safe spend: remaining budget / days left in month
    const [year, month] = activeMonth.split('-').map(Number);
    const totalDays = new Date(year, month, 0).getDate();
    const today = new Date();
    
    // Compute remaining days in the active month
    let daysRemaining = 1;
    const isCurrentMonth = today.getFullYear() === year && (today.getMonth() + 1) === month;
    if (isCurrentMonth) {
      daysRemaining = Math.max(1, totalDays - today.getDate() + 1);
    } else {
      const isActiveMonthPast = new Date(year, month - 1, 1).getTime() < new Date(today.getFullYear(), today.getMonth(), 1).getTime();
      daysRemaining = isActiveMonthPast ? 1 : totalDays;
    }

    // Daily safe spend: remaining budget / days left in month
    let dailySafeSpend = daysRemaining > 0 ? (remaining / daysRemaining) : 0;
    if (isNaN(dailySafeSpend)) dailySafeSpend = 0;
    
    if (activeRecoveryPlan && activeRecoveryPlan.is_active && activeRecoveryPlan.remaining_days > 0) {
      dailySafeSpend = Number(activeRecoveryPlan.adjusted_daily_limit);
      if (isNaN(dailySafeSpend)) dailySafeSpend = 0;
    }

    // Map out status of category limits
    const limitStatus: CategoryLimitStatus[] = categoryLimits.map(lim => {
      const cat = categories.find(c => c.id === lim.category_id);
      const catSpent = transactions
        .filter(tx => tx.category_id === lim.category_id && tx.type === 'expense' && !tx.is_ghost)
        .reduce((sum, tx) => sum + Number(tx.amount), 0);
      
      const limitVal = Number(lim.limit_amount);
      const catRemaining = Math.max(0, limitVal - catSpent);
      
      return {
        category_id: lim.category_id,
        category_name: cat?.name || 'Unknown',
        limit: limitVal,
        spent: catSpent,
        remaining: catRemaining,
        isOverspent: catSpent > limitVal
      };
    });

    return {
      allowance,
      spent,
      remaining,
      percentRemaining,
      dailySafeSpend,
      categories: limitStatus
    };
  }, [budgetMonth, transactions, categoryLimits, activeRecoveryPlan, categories, activeMonth]);

  // Derived Health Calculations (Health Score, Streaks, ECG heartbeat status)
  const healthState = useMemo<DerivedHealthState>(() => {
    if (!budgetMonth) {
      return {
        score: 100,
        heartbeatRate: 'normal',
        streakDays: 0,
        recoveryPlan: null,
        suggestion: 'No budget data available for this month.'
      };
    }

    const [year, month] = activeMonth.split('-').map(Number);
    const today = new Date();
    const isCurrentMonth = today.getFullYear() === year && (today.getMonth() + 1) === month;
    const endDayCheck = isCurrentMonth ? today.getDate() : new Date(year, month, 0).getDate();

    const spendsByDay: Record<string, number> = {};
    transactions
      .filter(tx => tx.type === 'expense' && !tx.is_ghost)
      .forEach(tx => {
        const day = tx.occurred_at; // YYYY-MM-DD
        spendsByDay[day] = (spendsByDay[day] || 0) + Number(tx.amount);
      });

    let consecutiveSafeDays = 0;
    let maxStreak = 0;

    // Calculate baseline daily budget from start
    const baselineDailyBudget = Number(budgetMonth.spendable_allowance || budgetMonth.salary_received) / new Date(year, month, 0).getDate();

    // Iterate day-by-day up to the current day of the selected month
    for (let day = 1; day <= endDayCheck; day++) {
      const dateString = `${activeMonth}-${String(day).padStart(2, '0')}`;
      const dailySpend = spendsByDay[dateString] || 0;

      if (dailySpend <= baselineDailyBudget) {
        consecutiveSafeDays++;
        if (consecutiveSafeDays > maxStreak) {
          maxStreak = consecutiveSafeDays;
        }
      } else {
        consecutiveSafeDays = 0;
      }
    }

    // Calculate actualIncome and spent
    const savingsCat = categories.find(c => c.name.toLowerCase() === 'savings');
    
    const actualIncome = transactions
      .filter(tx => tx.type === 'income' && (!savingsCat || tx.category_id !== savingsCat.id))
      .reduce((sum, tx) => sum + Number(tx.amount), 0);

    const plannedSalary = budgetMonth?.salary_received ? Number(budgetMonth.salary_received) : 0;
    const effectiveIncome = actualIncome > 0 ? actualIncome : plannedSalary;

    const spent = transactions
      .filter(tx => tx.type === 'expense' && !tx.is_ghost && (!savingsCat || tx.category_id !== savingsCat.id))
      .reduce((sum, tx) => sum + Number(tx.amount), 0);

    const netThisCycle = effectiveIncome - spent;

    let score = 100;
    let suggestion = '';

    // Calculate category spends for suggestion, isolating Fixed vs Discretionary
    const categorySpends: Record<string, { name: string; amount: number; isFixed: boolean }> = {};
    let totalFixedSpent = 0;
    let totalDiscretionarySpent = 0;

    transactions
      .filter(tx => tx.type === 'expense' && !tx.is_ghost && (!savingsCat || tx.category_id !== savingsCat.id))
      .forEach(tx => {
        const catId = tx.category_id || 'unknown';
        const catName = tx.category?.name || 'Other';
        const isFixed = isFixedExpenseCategory(catName);
        const amt = Number(tx.amount);

        if (!categorySpends[catId]) {
          categorySpends[catId] = { name: catName, amount: 0, isFixed };
        }
        categorySpends[catId].amount += amt;

        if (isFixed) {
          totalFixedSpent += amt;
        } else {
          totalDiscretionarySpent += amt;
        }
      });
    
    let topDiscretionaryName = '';
    let topDiscretionaryAmount = 0;
    Object.values(categorySpends).forEach(cs => {
      if (!cs.isFixed && cs.amount > topDiscretionaryAmount) {
        topDiscretionaryAmount = cs.amount;
        topDiscretionaryName = cs.name;
      }
    });

    const daysInMonth = new Date(year, month, 0).getDate();
    const daysElapsed = endDayCheck;
    const expectedPaceFraction = daysElapsed / daysInMonth;

    // Discretionary allowance: effective income minus fixed necessary bills
    const discretionaryAllowance = Math.max(0, effectiveIncome - totalFixedSpent);
    const expectedDiscretionaryPace = expectedPaceFraction * discretionaryAllowance;

    // Hard override: if net this cycle is negative, hard cap the score at 35 (Critical)
    if (netThisCycle < 0) {
      score = 35;
      
      if (topDiscretionaryAmount > 0) {
        suggestion = `${topDiscretionaryName} is your highest flexible spend (₹${Math.round(topDiscretionaryAmount).toLocaleString('en-IN')}) — trimming here is your fastest recovery lever.`;
      } else if (spent > 0) {
        suggestion = 'Expenses exceed current income. Consider logging income or transferring from your Vault.';
      } else {
        suggestion = 'Log your first salary or income transaction to kickstart this cycle.';
      }
    } else {
      // Pace penalty applies to DISCRETIONARY spending so paying rent/bills on Day 1 doesn't ruin the score
      let pacePenalty = 0;
      if (expectedDiscretionaryPace > 0 && totalDiscretionarySpent > expectedDiscretionaryPace) {
        const excessRatio = (totalDiscretionarySpent - expectedDiscretionaryPace) / expectedDiscretionaryPace;
        pacePenalty = Math.min(25, Math.round(excessRatio * 35));
      }

      // Category breach penalty (only for overspent limits)
      let breachedCategoriesCount = 0;
      categoryLimits.forEach(lim => {
        const catSpent = transactions
          .filter(tx => tx.category_id === lim.category_id && tx.type === 'expense' && !tx.is_ghost)
          .reduce((sum, tx) => sum + Number(tx.amount), 0);
        if (catSpent > Number(lim.limit_amount)) {
          breachedCategoriesCount++;
        }
      });
      const categoryPenalty = Math.min(20, breachedCategoriesCount * 5);

      score -= pacePenalty;
      score -= categoryPenalty;

      // Streak bonus
      let streakBonus = 0;
      if (maxStreak >= 15) streakBonus = 15;
      else if (maxStreak >= 7) streakBonus = 10;
      else if (maxStreak >= 3) streakBonus = 5;

      score += streakBonus;
      score = Math.max(0, Math.min(100, score));

      // Dynamic actionable suggestion focused on flexible spending
      if (effectiveIncome === 0) {
        suggestion = 'Log your first salary or income transaction to kickstart this cycle.';
      } else if (topDiscretionaryAmount > 0 && expectedDiscretionaryPace > 0 && totalDiscretionarySpent > expectedDiscretionaryPace) {
        suggestion = `Pacing is running hot on ${topDiscretionaryName} (₹${Math.round(topDiscretionaryAmount).toLocaleString('en-IN')}). Ease up on flexible buys to protect your safe spend.`;
      } else if (topDiscretionaryAmount > 0) {
        suggestion = `Pacing is on track! Flexible spending led by ${topDiscretionaryName} (₹${Math.round(topDiscretionaryAmount).toLocaleString('en-IN')}), well within safe limits.`;
      } else if (totalFixedSpent > 0) {
        suggestion = `Fixed essentials (₹${Math.round(totalFixedSpent).toLocaleString('en-IN')}) logged. Your discretionary spending reservoir is fresh!`;
      } else {
        suggestion = "Your pacing is solid and you're well under budget. Keep holding the line!";
      }
    }

    // Derive ECG Heartbeat state
    let heartbeatRate: 'normal' | 'arrhythmic' | 'slow' = 'normal';
    if (score < 50) {
      heartbeatRate = 'slow';
    } else if (score < 80) {
      heartbeatRate = 'arrhythmic';
    }

    return {
      score,
      heartbeatRate,
      streakDays: consecutiveSafeDays,
      recoveryPlan: activeRecoveryPlan,
      suggestion,
    };
  }, [budgetMonth, transactions, categoryLimits, activeRecoveryPlan, categories, activeMonth]);

  // Derived Theme mapping (Aesthetic Theme engine)
  const themeName = useMemo<ThemeName>(() => {
    const score = healthState.score;
    if (score >= 80) return 'emerald_forest';
    if (score >= 50) return 'amber_warning';
    return 'crimson_sunset';
  }, [healthState.score]);

  // Vault Reserves Calculation (Dynamic transfer ledger)
  const vaultBalance = useMemo(() => {
    const savingsCat = categories.find((c) => c.name.toLowerCase() === 'savings');
    if (!savingsCat) return 0;
    
    const toVault = transactions
      .filter((tx) => tx.type === 'expense' && !tx.is_ghost && tx.category_id === savingsCat.id)
      .reduce((sum, tx) => sum + Number(tx.amount), 0);
      
    const fromVault = transactions
      .filter((tx) => tx.type === 'income' && !tx.is_ghost && tx.category_id === savingsCat.id)
      .reduce((sum, tx) => sum + Number(tx.amount), 0);
      
    return toVault - fromVault;
  }, [transactions, categories]);


  const updateGoalAllocations = useCallback(async (allocations: { goal_name: string; percent: number }[]) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const totalPercent = allocations.reduce((sum, a) => sum + a.percent, 0);
      if (Math.round(totalPercent) !== 100) {
        throw new Error('Allocations must sum to 100%');
      }

      await supabase
        .from('goal_allocation')
        .delete()
        .eq('user_id', session.user.id);

      const payload = allocations.map(a => ({
        user_id: session.user.id,
        goal_name: a.goal_name,
        percent: a.percent
      }));

      const { data: inserted, error: insError } = await supabase
        .from('goal_allocation')
        .insert(payload)
        .select();

      if (insError) throw insError;
      setGoalAllocations(inserted || []);
    } catch (err) {
      console.error('Error updating goal allocations:', err);
      throw err;
    }
  }, []);

  const addGoal = useCallback(async (name: string, targetAmount: number, icon: string, linkedItemId?: string | null) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('goals')
        .insert([{ 
          user_id: session.user.id, 
          name, 
          target_amount: targetAmount, 
          icon,
          linked_item_id: linkedItemId || null
        }])
        .select('*, wishlist_items(*, item_prices(*))')
        .single();
      if (error) throw error;
      
      const mapped = mapGoalData(data);
      setGoals(prev => [...prev, mapped]);
    } catch (err) {
      console.error('Failed to add goal:', err);
      throw err;
    }
  }, [mapGoalData]);

  const updateGoal = useCallback(async (id: string, name: string, targetAmount: number, icon: string, linkedItemId?: string | null) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('goals')
        .update({ 
          name, 
          target_amount: targetAmount, 
          icon,
          linked_item_id: linkedItemId || null
        })
        .eq('id', id)
        .eq('user_id', session.user.id)
        .select('*, wishlist_items(*, item_prices(*))')
        .single();
      if (error) throw error;

      const mapped = mapGoalData(data);
      setGoals(prev => prev.map(g => g.id === id ? mapped : g));
    } catch (err) {
      console.error('Failed to update goal:', err);
      throw err;
    }
  }, [mapGoalData]);

  const updateProfileDisplayName = useCallback(async (displayName: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('users')
        .upsert({
          id: session.user.id,
          email: session.user.email || '',
          display_name: displayName,
        })
        .select()
        .single();
      
      if (error) throw error;
      setUserProfile(data);
    } catch (err) {
      console.error('Failed to update display name:', err);
      throw err;
    }
  }, []);

  const deleteGoal = useCallback(async (id: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('goals')
        .delete()
        .eq('id', id)
        .eq('user_id', session.user.id);
      if (error) throw error;

      setGoals(prev => prev.filter(g => g.id !== id));
    } catch (err) {
      console.error('Failed to delete goal:', err);
      throw err;
    }
  }, []);

  const contributeToGoal = useCallback(async (goalId: string, amount: number, isDeposit: boolean, note: string | null) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const savingsCat = categories.find(c => c.name.toLowerCase() === 'savings');
      if (!savingsCat) throw new Error("Could not find 'Savings' category. Please create it first in Expenses > Categories.");

      await apiCreateTransaction({
        amount,
        category_id: savingsCat.id,
        note: note || (isDeposit ? 'Deposit to Goal' : 'Withdrawal from Goal'),
        occurred_at: new Date().toISOString().split('T')[0],
        source: 'manual',
        type: isDeposit ? 'expense' : 'income',
        goal_id: goalId
      });

      await loadData(activeMonth);
    } catch (err) {
      console.error('Failed to contribute to goal:', err);
      throw err;
    }
  }, [categories, activeMonth, loadData]);

  // ACTION callbacks
  const changeMonth = useCallback(async (monthStr: string) => {
    setActiveMonth(monthStr);
  }, []);

  const setupBudget = useCallback(async (salary: number, savingsTarget: number) => {
    try {
      const initialized = await initializeBudgetMonth(activeMonth, salary, savingsTarget);
      setBudgetMonth(initialized);
      await loadData(activeMonth);
    } catch (err) {
      console.error('Error setting up budget:', err);
      throw err;
    }
  }, [activeMonth, loadData]);

  const addTransaction = useCallback(async (payload: {
    amount: number;
    category_id: string;
    note: string | null;
    occurred_at: string;
    is_ghost?: boolean;
    type?: 'expense' | 'income';
    goal_id?: string | null;
  }) => {
    try {
      const tx = await apiCreateTransaction({
        amount: payload.amount,
        category_id: payload.category_id,
        note: payload.note,
        occurred_at: payload.occurred_at,
        source: 'manual',
        type: payload.type ?? 'expense',
        is_ghost: payload.is_ghost,
        goal_id: payload.goal_id,
      });

      // Optimistic update or reload data
      await loadData(activeMonth);
      return tx;
    } catch (err) {
      console.error('Error adding transaction:', err);
      throw err;
    }
  }, [activeMonth, loadData]);

  const updateLimits = useCallback(async (limits: { category_id: string; limit_amount: number }[]) => {
    if (!budgetMonth) throw new Error('No active budget month');
    try {
      const updated = await saveCategoryLimits(budgetMonth.id, limits);
      setCategoryLimits(updated);
    } catch (err) {
      console.error('Error updating category limits:', err);
      throw err;
    }
  }, [budgetMonth]);

  const triggerRecovery = useCallback(async (durationDays: number) => {
    if (!budgetMonth) throw new Error('No active budget month');
    try {
      // Calculate how much we have overspent compared to the baseline
      const totalAllowance = Number(budgetMonth.spendable_allowance);
      const spentSoFar = budgetState.spent;
      
      const [year, month] = activeMonth.split('-').map(Number);
      const totalDays = new Date(year, month, 0).getDate();
      const currentDay = new Date().getDate();

      const expectedAccumulatedLimit = (totalAllowance / totalDays) * currentDay;
      const overspendAmount = Math.max(0, spentSoFar - expectedAccumulatedLimit);

      // Adjusted daily limit: (remaining budget - overspent amount amortized) or simple recalculation
      const remainingAllowance = budgetState.remaining;
      const adjustedLimit = Math.max(0, (remainingAllowance - overspendAmount) / durationDays);

      const newPlan = await createRecoveryPlan(budgetMonth.id, overspendAmount, adjustedLimit, durationDays);
      setActiveRecoveryPlan(newPlan);
      return newPlan;
    } catch (err) {
      console.error('Error triggering recovery plan:', err);
      throw err;
    }
  }, [budgetMonth, budgetState, activeMonth]);

  const rateTransaction = useCallback(async (transactionId: string, rating: RegretLevel) => {
    try {
      const { error: txError } = await supabase
        .from('transactions')
        .update({ regret: rating })
        .eq('id', transactionId);

      if (txError) throw txError;
      
      // Update transaction list in state locally
      setTransactions(prev => 
        prev.map(tx => tx.id === transactionId ? { ...tx, regret: rating } : tx)
      );
    } catch (err) {
      console.error('Error rating transaction:', err);
      throw err;
    }
  }, []);

  const deleteTransactionContext = useCallback(async (transactionId: string) => {
    try {
      await apiDeleteTransaction(transactionId);
      await loadData(activeMonth);
    } catch (err) {
      console.error('Error deleting transaction:', err);
      throw err;
    }
  }, [activeMonth, loadData]);

  const bulkDeleteTransactions = useCallback(async (transactionIds: string[]) => {
    try {
      if (transactionIds.length === 0) return;
      const { error } = await supabase
        .from('transactions')
        .delete()
        .in('id', transactionIds);
      if (error) throw error;
      await loadData(activeMonth);
    } catch (err) {
      console.error('Error in bulkDeleteTransactions:', err);
      throw err;
    }
  }, [activeMonth, loadData]);

  const bulkAddTransactions = useCallback(async (items: {
    amount: number;
    category_id: string;
    note: string | null;
    type?: 'expense' | 'income';
    occurred_at?: string;
  }[]) => {
    try {
      if (items.length === 0) return;
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const today = new Date().toISOString().split('T')[0];
      const rows = items.map((item) => ({
        user_id: session.user.id,
        amount: item.amount,
        category_id: item.category_id,
        note: item.note || null,
        occurred_at: item.occurred_at || today,
        type: item.type || 'expense',
        source: 'manual',
      }));

      const { error } = await supabase.from('transactions').insert(rows);
      if (error) throw error;
      await loadData(activeMonth);
    } catch (err) {
      console.error('Error in bulkAddTransactions:', err);
      throw err;
    }
  }, [activeMonth, loadData]);

  const duplicateTransactionContext = useCallback(async (transaction: Transaction) => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const dup = await apiCreateTransaction({
        amount: Number(transaction.amount),
        category_id: transaction.category_id,
        note: transaction.note ? `${transaction.note}` : 'Repeated transaction',
        occurred_at: today,
        source: 'manual',
        type: transaction.type,
      });
      await loadData(activeMonth);
      return dup;
    } catch (err) {
      console.error('Error duplicating transaction:', err);
      throw err;
    }
  }, [activeMonth, loadData]);

  const resetMonthData = useCallback(async (monthToReset?: string) => {
    const targetMonth = monthToReset || activeMonth;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const startDate = `${targetMonth}-01`;
      const [year, m] = targetMonth.split('-').map(Number);
      const lastDay = new Date(year, m, 0).getDate();
      const endDate = `${targetMonth}-${String(lastDay).padStart(2, '0')}`;

      // 1. Delete all transactions within this month range
      const { error: delErr } = await supabase
        .from('transactions')
        .delete()
        .eq('user_id', session.user.id)
        .gte('occurred_at', startDate)
        .lte('occurred_at', endDate);

      if (delErr) throw delErr;

      // 2. Delete the budget_month record for this month so no default salary or blueprint persists
      await supabase
        .from('budget_month')
        .delete()
        .eq('user_id', session.user.id)
        .eq('calendar_month', startDate);

      // 3. Clear local state for this month
      setBudgetMonth(null);
      setCategoryLimits([]);
      setActiveRecoveryPlan(null);
      setTransactions([]);

      await loadData(targetMonth);
    } catch (err) {
      console.error('Error resetting month data:', err);
      throw err;
    }
  }, [activeMonth, loadData]);

  const depositToVault = useCallback(async (amount: number, note?: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      let savingsCat = categories.find(c => c.name.toLowerCase() === 'savings');
      if (!savingsCat) {
        const { data: newCat } = await supabase
          .from('expense_categories')
          .insert({
            name: 'Savings',
            icon: 'Shield',
            color: '#10B981',
            is_default: true,
            type: 'expense',
            user_id: session.user.id
          })
          .select()
          .single();
        if (newCat) savingsCat = newCat;
      }

      if (!savingsCat) throw new Error('Could not find or create Savings category');

      const today = new Date().toISOString().split('T')[0];
      await apiCreateTransaction({
        amount,
        category_id: savingsCat.id,
        note: note || 'Locked into Vault (Savings)',
        occurred_at: today,
        source: 'manual',
        type: 'expense',
      });

      await loadData(activeMonth);
    } catch (err) {
      console.error('Error depositing to vault:', err);
      throw err;
    }
  }, [categories, activeMonth, loadData]);

  const withdrawFromVault = useCallback(async (amount: number, asExpense: boolean, note?: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      let savingsCat = categories.find(c => c.name.toLowerCase() === 'savings');
      if (!savingsCat) {
        const { data: newCat } = await supabase
          .from('expense_categories')
          .insert({
            name: 'Savings',
            icon: 'Shield',
            color: '#10B981',
            is_default: true,
            type: 'expense',
            user_id: session.user.id
          })
          .select()
          .single();
        if (newCat) savingsCat = newCat;
      }

      if (!savingsCat) throw new Error('Could not find or create Savings category');

      const today = new Date().toISOString().split('T')[0];
      
      // Withdrawing from vault reduces vault balance
      await apiCreateTransaction({
        amount,
        category_id: savingsCat.id,
        note: note || (asExpense ? 'Withdrawn from Vault & Spent' : 'Transferred from Vault to Spendable'),
        occurred_at: today,
        source: 'manual',
        type: 'income',
      });

      // If user specified "asExpense" ("if its out it means its spent")
      if (asExpense) {
        const otherCat = categories.find(c => c.type === 'expense' && c.name.toLowerCase() !== 'savings');
        await apiCreateTransaction({
          amount,
          category_id: otherCat ? otherCat.id : savingsCat.id,
          note: note ? `Vault Spend: ${note}` : 'Spent from Vault',
          occurred_at: today,
          source: 'manual',
          type: 'expense',
        });
      }

      await loadData(activeMonth);
    } catch (err) {
      console.error('Error withdrawing from vault:', err);
      throw err;
    }
  }, [categories, activeMonth, loadData]);

  const refreshData = useCallback(async () => {
    await loadData(activeMonth);
  }, [activeMonth, loadData]);

  const value = useMemo(() => ({
    activeMonth,
    budgetMonth,
    transactions,
    categoryLimits,
    activeRecoveryPlan,
    categories,
    userProfile,
    vaultBalance,
    updateProfileDisplayName,
    isLoading,
    error,
    budgetState,
    healthState,
    themeName,
    
    // Custom goals state
    goals,
    addGoal,
    updateGoal,
    deleteGoal,
    contributeToGoal,
    goalAllocations,
    updateGoalAllocations,

    changeMonth,
    setupBudget,
    addTransaction,
    deleteTransactionContext,
    bulkDeleteTransactions,
    bulkAddTransactions,
    duplicateTransactionContext,
    depositToVault,
    withdrawFromVault,
    updateLimits,
    triggerRecovery,
    rateTransaction,
    resetMonthData,

    refreshData
  }), [
    activeMonth,
    budgetMonth,
    transactions,
    categoryLimits,
    activeRecoveryPlan,
    categories,
    userProfile,
    vaultBalance,
    updateProfileDisplayName,
    isLoading,
    error,
    budgetState,
    healthState,
    themeName,
    
    goals,
    addGoal,
    updateGoal,
    deleteGoal,
    contributeToGoal,
    goalAllocations,
    updateGoalAllocations,

    changeMonth,
    setupBudget,
    addTransaction,
    deleteTransactionContext,
    bulkDeleteTransactions,
    bulkAddTransactions,
    duplicateTransactionContext,
    depositToVault,
    withdrawFromVault,
    updateLimits,
    triggerRecovery,
    rateTransaction,
    resetMonthData,

    refreshData
  ]);

  return (
    <BudgetContext.Provider value={value}>
      {children}
    </BudgetContext.Provider>
  );
};
