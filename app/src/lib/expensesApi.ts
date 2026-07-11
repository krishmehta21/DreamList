import { supabase } from './supabase';

export interface ExpenseCategory {
  id: string;
  user_id: string | null;
  name: string;
  icon: string;
  color: string;
  is_default: boolean;
  type: 'expense' | 'income';
  created_at: string;
}

export interface Transaction {
  id: string;
  user_id: string;
  amount: number;
  category_id: string;
  note: string | null;
  occurred_at: string; // YYYY-MM-DD
  source: 'manual' | 'wishlist_link';
  linked_item_id: string | null;
  type: 'expense' | 'income';
  created_at: string;
  category?: ExpenseCategory;
}

/**
 * Fetch categories visible to the current user.
 * Pass `type` to filter to only expense or income categories.
 * Omit `type` to fetch all (for list display).
 */
export async function fetchCategories(type?: 'expense' | 'income'): Promise<ExpenseCategory[]> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');

  let query = supabase
    .from('expense_categories')
    .select('*')
    .order('name', { ascending: true });

  if (type) {
    query = query.eq('type', type);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

/**
 * Add a custom category
 */
export async function createCategory(
  name: string,
  icon: string,
  color: string,
  type: 'expense' | 'income' = 'expense'
): Promise<ExpenseCategory> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('expense_categories')
    .insert([
      {
        user_id: session.user.id,
        name,
        icon,
        color,
        is_default: false,
        type,
      },
    ])
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Delete a custom category.
 * Throws if there are existing transactions referencing it.
 */
export async function deleteCategory(id: string): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');

  // Check if there are transactions linked to this category
  const { count, error: countError } = await supabase
    .from('transactions')
    .select('*', { count: 'exact', head: true })
    .eq('category_id', id);

  if (countError) throw countError;
  if (count && count > 0) {
    throw new Error('Cannot delete category because it has linked transactions.');
  }

  const { error } = await supabase
    .from('expense_categories')
    .delete()
    .eq('id', id)
    .eq('user_id', session.user.id);

  if (error) throw error;
}

/**
 * Fetch transactions for a specific month (YYYY-MM).
 * Optionally filter by type ('expense' | 'income').
 */
export async function fetchTransactions(
  monthStr: string,
  type?: 'expense' | 'income'
): Promise<Transaction[]> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');

  const startDate = `${monthStr}-01`;
  const [year, month] = monthStr.split('-').map(Number);
  const endDay = new Date(year, month, 0).getDate();
  const endDate = `${monthStr}-${String(endDay).padStart(2, '0')}`;

  let query = supabase
    .from('transactions')
    .select(`
      *,
      category:expense_categories (*)
    `)
    .eq('user_id', session.user.id)
    .gte('occurred_at', startDate)
    .lte('occurred_at', endDate)
    .order('occurred_at', { ascending: false })
    .order('created_at', { ascending: false });

  if (type) {
    query = query.eq('type', type);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

/**
 * Add a new transaction
 */
export async function createTransaction(payload: {
  amount: number;
  category_id: string;
  note: string | null;
  occurred_at: string; // YYYY-MM-DD
  source: 'manual' | 'wishlist_link';
  linked_item_id?: string | null;
  type?: 'expense' | 'income';
}): Promise<Transaction> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('transactions')
    .insert([
      {
        user_id: session.user.id,
        amount: payload.amount,
        category_id: payload.category_id,
        note: payload.note,
        occurred_at: payload.occurred_at,
        source: payload.source,
        linked_item_id: payload.linked_item_id || null,
        type: payload.type ?? 'expense',
      },
    ])
    .select(`
      *,
      category:expense_categories (*)
    `)
    .single();

  if (error) throw error;
  return data;
}

/**
 * Delete a transaction
 */
export async function deleteTransaction(id: string): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('transactions')
    .delete()
    .eq('id', id)
    .eq('user_id', session.user.id);

  if (error) throw error;
}

/**
 * Reassign all transactions from one category to another
 */
export async function reassignTransactions(fromCategoryId: string, toCategoryId: string): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('transactions')
    .update({ category_id: toCategoryId })
    .eq('category_id', fromCategoryId)
    .eq('user_id', session.user.id);

  if (error) throw error;
}

/**
 * Update an existing transaction
 */
export async function updateTransaction(id: string, payload: {
  amount: number;
  category_id: string;
  note: string | null;
  occurred_at: string; // YYYY-MM-DD
  linked_item_id?: string | null;
  type?: 'expense' | 'income';
}): Promise<Transaction> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');

  const updatePayload: Record<string, unknown> = {
    amount: payload.amount,
    category_id: payload.category_id,
    note: payload.note,
    occurred_at: payload.occurred_at,
    linked_item_id: payload.linked_item_id || null,
  };

  if (payload.type !== undefined) {
    updatePayload.type = payload.type;
  }

  const { data, error } = await supabase
    .from('transactions')
    .update(updatePayload)
    .eq('id', id)
    .eq('user_id', session.user.id)
    .select(`
      *,
      category:expense_categories (*)
    `)
    .single();

  if (error) throw error;
  return data;
}
