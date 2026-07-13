import type { WishlistItem } from './types';
import type { ExpenseCategory, Transaction } from './expensesApi';

export function initDatabase() {
  console.log('[Web Database] initDatabase mock (no-op)');
}

export function getCachedItems(): WishlistItem[] {
  try {
    if (typeof window === 'undefined') return [];
    const data = localStorage.getItem('dl_cached_wishlist_items');
    return data ? JSON.parse(data) : [];
  } catch (e) {
    console.error('[Web Database] Failed to get cached items:', e);
    return [];
  }
}

export function saveCachedItems(items: WishlistItem[]) {
  try {
    if (typeof window === 'undefined') return;
    localStorage.setItem('dl_cached_wishlist_items', JSON.stringify(items));
  } catch (e) {
    console.error('[Web Database] Failed to save cached items:', e);
  }
}

export function updateCachedItem(item: WishlistItem) {
  try {
    const items = getCachedItems();
    const updated = items.map((i) => (i.id === item.id ? item : i));
    saveCachedItems(updated);
  } catch (e) {
    console.error('[Web Database] Failed to update cached item:', e);
  }
}

export function deleteCachedItem(id: string) {
  try {
    const items = getCachedItems();
    const filtered = items.filter((i) => i.id !== id);
    saveCachedItems(filtered);
  } catch (e) {
    console.error('[Web Database] Failed to delete cached item:', e);
  }
}

export function reconcileItems(prev: WishlistItem[], next: WishlistItem[]): WishlistItem[] {
  const prevMap = new Map(prev.map((i) => [i.id, i]));
  return next.map((newI) => {
    const prevI = prevMap.get(newI.id);
    if (!prevI) return newI;
    
    const changed =
      prevI.name !== newI.name ||
      prevI.category !== newI.category ||
      prevI.tier !== newI.tier ||
      prevI.status !== newI.status ||
      prevI.done !== newI.done ||
      prevI.manual_notes !== newI.manual_notes ||
      prevI.manual_link !== newI.manual_link ||
      JSON.stringify(prevI.prices) !== JSON.stringify(newI.prices) ||
      JSON.stringify(prevI.research) !== JSON.stringify(newI.research);
      
    return changed ? newI : prevI;
  });
}

export function getCachedExpenseCategories(): ExpenseCategory[] {
  try {
    if (typeof window === 'undefined') return [];
    const data = localStorage.getItem('dl_cached_expense_categories');
    return data ? JSON.parse(data) : [];
  } catch (e) {
    console.error('[Web Database] Failed to get cached categories:', e);
    return [];
  }
}

export function saveCachedExpenseCategories(cats: ExpenseCategory[]) {
  try {
    if (typeof window === 'undefined') return;
    localStorage.setItem('dl_cached_expense_categories', JSON.stringify(cats));
  } catch (e) {
    console.error('[Web Database] Failed to save cached categories:', e);
  }
}

export function getCachedTransactions(): Transaction[] {
  try {
    if (typeof window === 'undefined') return [];
    const data = localStorage.getItem('dl_cached_transactions');
    return data ? JSON.parse(data) : [];
  } catch (e) {
    console.error('[Web Database] Failed to get cached transactions:', e);
    return [];
  }
}

export function saveCachedTransactions(txs: Transaction[]) {
  try {
    if (typeof window === 'undefined') return;
    localStorage.setItem('dl_cached_transactions', JSON.stringify(txs));
  } catch (e) {
    console.error('[Web Database] Failed to save cached transactions:', e);
  }
}

export function reconcileTransactions(prev: Transaction[], next: Transaction[]): Transaction[] {
  const prevMap = new Map(prev.map((t) => [t.id, t]));
  return next.map((newTx) => {
    const prevTx = prevMap.get(newTx.id);
    if (!prevTx) return newTx;
    
    const changed =
      prevTx.amount !== newTx.amount ||
      prevTx.category_id !== newTx.category_id ||
      prevTx.note !== newTx.note ||
      prevTx.occurred_at !== newTx.occurred_at ||
      prevTx.type !== newTx.type ||
      JSON.stringify(prevTx.category) !== JSON.stringify(newTx.category);
      
    return changed ? newTx : prevTx;
  });
}

export function cleanOrphanedTempItems() {
  try {
    const items = getCachedItems();
    const now = new Date();
    const filtered = items.filter((item) => {
      if (item.id.startsWith('temp-')) {
        const createdAt = new Date(item.created_at);
        const diffSeconds = Math.abs(now.getTime() - createdAt.getTime()) / 1000;
        return diffSeconds <= 120;
      }
      return true;
    });
    if (filtered.length !== items.length) {
      saveCachedItems(filtered);
      console.log('[Web Database] Cleaned up orphaned temporary items');
    }
  } catch (e) {
    console.error('[Web Database] Failed to clean temp items:', e);
  }
}
