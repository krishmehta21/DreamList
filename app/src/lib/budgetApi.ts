import { supabase } from './supabase';
import { BudgetMonth, CategoryLimit, RecoveryPlan, RegretLevel } from './budgetTypes';
import { Transaction } from './expensesApi';

/**
 * Fetch a budget month record by calendar month (format: YYYY-MM)
 */
export async function fetchActiveBudgetMonth(monthStr: string): Promise<BudgetMonth | null> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');

  const startDate = `${monthStr}-01`;

  const { data, error } = await supabase
    .from('budget_month')
    .select('*')
    .eq('user_id', session.user.id)
    .eq('calendar_month', startDate)
    .maybeSingle();

  if (error) throw error;
  return data;
}

/**
 * Initialize a new budget month, and automatically log a Salary income transaction if one doesn't exist
 */
export async function initializeBudgetMonth(
  monthStr: string,
  salary: number,
  savingsTarget: number
): Promise<BudgetMonth> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');

  const startDate = `${monthStr}-01`;
  const spendableAllowance = salary - savingsTarget;

  // Upsert the budget month to handle existing cycles gracefully
  const { data: budgetMonth, error: budgetError } = await supabase
    .from('budget_month')
    .upsert(
      [
        {
          user_id: session.user.id,
          calendar_month: startDate,
          salary_received: salary,
          savings_target: savingsTarget,
          spendable_allowance: spendableAllowance,
          status: 'active',
        },
      ],
      { onConflict: 'user_id,calendar_month' }
    )
    .select()
    .single();

  if (budgetError) throw budgetError;

  return budgetMonth;
}

/**
 * Fetch category limits for a specific budget month
 */
export async function fetchCategoryLimits(budgetMonthId: string): Promise<CategoryLimit[]> {
  const { data, error } = await supabase
    .from('category_limit')
    .select('*')
    .eq('budget_month_id', budgetMonthId);

  if (error) throw error;
  return data || [];
}

/**
 * Upsert category limits (ensuring zero-sum is preserved on the frontend)
 */
export async function saveCategoryLimits(
  budgetMonthId: string,
  limits: { category_id: string; limit_amount: number }[]
): Promise<CategoryLimit[]> {
  const payload = limits.map((lim) => ({
    budget_month_id: budgetMonthId,
    category_id: lim.category_id,
    limit_amount: lim.limit_amount,
  }));

  const { data, error } = await supabase
    .from('category_limit')
    .upsert(payload, { onConflict: 'budget_month_id,category_id' })
    .select();

  if (error) throw error;
  return data || [];
}

/**
 * Fetch active recovery plan for a budget month
 */
export async function fetchActiveRecoveryPlan(budgetMonthId: string): Promise<RecoveryPlan | null> {
  const { data, error } = await supabase
    .from('recovery_plan')
    .select('*')
    .eq('budget_month_id', budgetMonthId)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .maybeSingle();

  if (error) throw error;
  return data;
}

/**
 * Create a new recovery plan and de-activate any existing ones
 */
export async function createRecoveryPlan(
  budgetMonthId: string,
  originalOverspend: number,
  adjustedLimit: number,
  durationDays: number
): Promise<RecoveryPlan> {
  // First, deactivate any active plans
  await supabase
    .from('recovery_plan')
    .update({ is_active: false })
    .eq('budget_month_id', budgetMonthId)
    .eq('is_active', true);

  // Create new active plan
  const { data, error } = await supabase
    .from('recovery_plan')
    .insert([
      {
        budget_month_id: budgetMonthId,
        original_overspend: originalOverspend,
        adjusted_daily_limit: adjustedLimit,
        duration_days: durationDays,
        remaining_days: durationDays,
        is_active: true,
      },
    ])
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Update a recovery plan (decrement remaining days or deactivate)
 */
export async function updateRecoveryPlan(
  planId: string,
  remainingDays: number,
  isActive: boolean
): Promise<RecoveryPlan> {
  const { data, error } = await supabase
    .from('recovery_plan')
    .update({
      remaining_days: remainingDays,
      is_active: isActive,
    })
    .eq('id', planId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Save regret ratings for transactions in the weekly reflection queue
 */
export async function saveWeeklyReflection(
  ratings: { id: string; regret: RegretLevel }[]
): Promise<void> {
  const promises = ratings.map((rating) =>
    supabase
      .from('transactions')
      .update({ regret: rating.regret })
      .eq('id', rating.id)
  );

  const results = await Promise.all(promises);
  for (const res of results) {
    if (res.error) throw res.error;
  }
}
