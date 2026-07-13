import * as SQLite from 'expo-sqlite';
import type { WishlistItem } from './types';
import type { ExpenseCategory, Transaction } from './expensesApi';

// Open the database synchronously
const db = SQLite.openDatabaseSync('dreamlist.db');

/**
 * Initializes the SQLite database and creates the caching table if it doesn't exist.
 */
export function initDatabase() {
  try {
    db.execSync(`
      CREATE TABLE IF NOT EXISTS cached_wishlist_items (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        name TEXT,
        category TEXT,
        tier TEXT,
        status TEXT,
        done INTEGER,
        manual_notes TEXT,
        manual_link TEXT,
        created_at TEXT,
        prices_json TEXT,
        research_json TEXT
      );
    `);
    db.execSync(`
      CREATE TABLE IF NOT EXISTS cached_expense_categories (
        id TEXT PRIMARY KEY,
        name TEXT,
        icon TEXT,
        color TEXT,
        is_default INTEGER,
        type TEXT,
        user_id TEXT,
        created_at TEXT
      );
    `);
    db.execSync(`
      CREATE TABLE IF NOT EXISTS cached_transactions (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        amount REAL,
        category_id TEXT,
        note TEXT,
        occurred_at TEXT,
        source TEXT,
        linked_item_id TEXT,
        type TEXT,
        created_at TEXT,
        category_json TEXT
      );
    `);
  } catch (e) {
    console.error('Failed to initialize database:', e);
  }
}

/**
 * Retrieves all cached wishlist items from SQLite database.
 */
export function getCachedItems(): WishlistItem[] {
  try {
    const rows = db.getAllSync(
      'SELECT * FROM cached_wishlist_items ORDER BY datetime(created_at) DESC'
    ) as any[];
    
    return rows.map((row) => ({
      id: row.id,
      user_id: row.user_id,
      name: row.name,
      category: row.category,
      tier: row.tier,
      status: row.status,
      done: row.done === 1,
      manual_notes: row.manual_notes,
      manual_link: row.manual_link,
      created_at: row.created_at,
      prices: JSON.parse(row.prices_json || '[]'),
      research: JSON.parse(row.research_json || '[]'),
    }));
  } catch (e) {
    console.error('Failed to get cached items from SQLite:', e);
    return [];
  }
}

/**
 * Replaces the entire local SQLite cache with a new list of items.
 */
export function saveCachedItems(items: WishlistItem[]) {
  try {
    db.runSync('DELETE FROM cached_wishlist_items');
    for (const item of items) {
      db.runSync(
        `INSERT OR REPLACE INTO cached_wishlist_items (
          id, user_id, name, category, tier, status, done, manual_notes, manual_link, created_at, prices_json, research_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          item.id,
          item.user_id,
          item.name,
          item.category,
          item.tier,
          item.status,
          item.done ? 1 : 0,
          item.manual_notes,
          item.manual_link,
          item.created_at,
          JSON.stringify(item.prices || []),
          JSON.stringify(item.research || []),
        ]
      );
    }
  } catch (e) {
    console.error('Failed to save items to SQLite cache:', e);
  }
}

/**
 * Inserts or updates a single item in the SQLite cache.
 */
export function updateCachedItem(item: WishlistItem) {
  try {
    db.runSync(
      `INSERT OR REPLACE INTO cached_wishlist_items (
        id, user_id, name, category, tier, status, done, manual_notes, manual_link, created_at, prices_json, research_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        item.id,
        item.user_id,
        item.name,
        item.category,
        item.tier,
        item.status,
        item.done ? 1 : 0,
        item.manual_notes,
        item.manual_link,
        item.created_at,
        JSON.stringify(item.prices || []),
        JSON.stringify(item.research || []),
      ]
    );
  } catch (e) {
    console.error('Failed to update item in SQLite cache:', e);
  }
}

/**
 * Deletes a single item from the SQLite cache.
 */
export function deleteCachedItem(id: string) {
  try {
    db.runSync('DELETE FROM cached_wishlist_items WHERE id = ?', [id]);
  } catch (e) {
    console.error('Failed to delete item from SQLite cache:', e);
  }
}

/**
 * Reconciles the local items array with the fresh remote items array.
 * Preserves exact object references of unchanged items to optimize React re-rendering.
 */
export function reconcileItems(prev: WishlistItem[], next: WishlistItem[]): WishlistItem[] {
  const prevMap = new Map(prev.map((i) => [i.id, i]));
  return next.map((newItem) => {
    const prevItem = prevMap.get(newItem.id);
    if (!prevItem) return newItem;
    
    // Deep equality check for fields affecting rendering
    const changed =
      prevItem.name !== newItem.name ||
      prevItem.category !== newItem.category ||
      prevItem.tier !== newItem.tier ||
      prevItem.status !== newItem.status ||
      prevItem.done !== newItem.done ||
      prevItem.manual_notes !== newItem.manual_notes ||
      prevItem.manual_link !== newItem.manual_link ||
      JSON.stringify(prevItem.prices) !== JSON.stringify(newItem.prices) ||
      JSON.stringify(prevItem.research) !== JSON.stringify(newItem.research);
      
    return changed ? newItem : prevItem;
  });
}

/**
 * Retrieves all cached expense categories from SQLite database.
 */
export function getCachedExpenseCategories(): ExpenseCategory[] {
  try {
    const rows = db.getAllSync('SELECT * FROM cached_expense_categories') as any[];
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      icon: row.icon,
      color: row.color,
      is_default: row.is_default === 1,
      type: row.type,
      user_id: row.user_id,
      created_at: row.created_at,
    }));
  } catch (e) {
    console.error('Failed to get cached categories:', e);
    return [];
  }
}

/**
 * Replaces the local categories SQLite cache.
 */
export function saveCachedExpenseCategories(cats: ExpenseCategory[]) {
  try {
    db.runSync('DELETE FROM cached_expense_categories');
    for (const cat of cats) {
      db.runSync(
        `INSERT OR REPLACE INTO cached_expense_categories (
          id, name, icon, color, is_default, type, user_id, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          cat.id,
          cat.name,
          cat.icon,
          cat.color,
          cat.is_default ? 1 : 0,
          cat.type,
          cat.user_id,
          cat.created_at,
        ]
      );
    }
  } catch (e) {
    console.error('Failed to save cached categories:', e);
  }
}

/**
 * Retrieves all cached transactions from SQLite database.
 */
export function getCachedTransactions(): Transaction[] {
  try {
    const rows = db.getAllSync(
      'SELECT * FROM cached_transactions ORDER BY datetime(occurred_at) DESC, datetime(created_at) DESC'
    ) as any[];
    
    return rows.map((row) => ({
      id: row.id,
      user_id: row.user_id,
      amount: row.amount,
      category_id: row.category_id,
      note: row.note,
      occurred_at: row.occurred_at,
      source: row.source,
      linked_item_id: row.linked_item_id,
      type: row.type,
      created_at: row.created_at,
      category: row.category_json ? JSON.parse(row.category_json) : null,
    }));
  } catch (e) {
    console.error('Failed to get cached transactions:', e);
    return [];
  }
}

/**
 * Replaces the local transactions SQLite cache.
 */
export function saveCachedTransactions(txs: Transaction[]) {
  try {
    db.runSync('DELETE FROM cached_transactions');
    for (const tx of txs) {
      db.runSync(
        `INSERT OR REPLACE INTO cached_transactions (
          id, user_id, amount, category_id, note, occurred_at, source, linked_item_id, type, created_at, category_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          tx.id,
          tx.user_id,
          Number(tx.amount),
          tx.category_id,
          tx.note,
          tx.occurred_at,
          tx.source,
          tx.linked_item_id,
          tx.type,
          tx.created_at,
          tx.category ? JSON.stringify(tx.category) : null,
        ]
      );
    }
  } catch (e) {
    console.error('Failed to save cached transactions:', e);
  }
}

/**
 * Reconciles transactions state to prevent unnecessary re-renders.
 */
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

/**
 * Deletes any cached items with a 'temp-' ID that are older than 2 minutes,
 * as they represent orphaned optimistic writes from failed/hung server creations.
 */
export function cleanOrphanedTempItems() {
  try {
    const now = new Date();
    const rows = db.getAllSync(
      "SELECT id, created_at FROM cached_wishlist_items WHERE id LIKE 'temp-%'"
    ) as any[];

    for (const row of rows) {
      try {
        const createdAt = new Date(row.created_at);
        const diffTime = Math.abs(now.getTime() - createdAt.getTime());
        const diffSeconds = diffTime / 1000;
        if (diffSeconds > 120) {
          db.runSync('DELETE FROM cached_wishlist_items WHERE id = ?', [row.id]);
          console.log(`Cleaned up orphaned temporary item: ${row.id}`);
        }
      } catch (innerErr) {
        console.error(`Failed to clean single temp item ${row.id}:`, innerErr);
      }
    }
  } catch (e) {
    console.error('Failed to clean orphaned temp items:', e);
  }
}

