// TypeScript interfaces for the DreamList Budget Engine

export type RegretLevel = 'unrated' | 'love' | 'okay' | 'regret';
export type BudgetCycleStatus = 'active' | 'completed' | 'archived';

export interface BudgetMonth {
  id: string;
  user_id: string;
  calendar_month: string; // YYYY-MM-DD (typically first day of month)
  salary_received: number;
  savings_target: number;
  spendable_allowance: number;
  bills_reserved_amount: number;
  status: BudgetCycleStatus;
  created_at: string;
}

export interface CategoryLimit {
  id: string;
  budget_month_id: string;
  category_id: string;
  limit_amount: number;
}

export interface RecoveryPlan {
  id: string;
  budget_month_id: string;
  original_overspend: number;
  adjusted_daily_limit: number;
  duration_days: number;
  remaining_days: number;
  is_active: boolean;
  created_at: string;
}

export interface CategoryLimitStatus {
  category_id: string;
  category_name: string;
  limit: number;
  spent: number;
  remaining: number;
  isOverspent: boolean;
}

export interface DerivedBudgetState {
  allowance: number;
  spent: number;
  remaining: number;
  percentRemaining: number;
  dailySafeSpend: number;
  categories: CategoryLimitStatus[];
}

export interface DerivedHealthState {
  score: number;
  heartbeatRate: 'normal' | 'arrhythmic' | 'slow';
  streakDays: number;
  recoveryPlan: RecoveryPlan | null;
  suggestion: string;
}

export interface UserProfile {
  id: string;
  email: string;
  created_at: string;
  display_name?: string | null;
}

export interface GoalAllocation {
  id: string;
  user_id: string;
  goal_name: string;
  percent: number;
  created_at: string;
}

export interface Goal {
  id: string;
  user_id: string;
  name: string;
  target_amount: number;
  icon: string;
  created_at: string;
  linked_item_id?: string | null;
}
