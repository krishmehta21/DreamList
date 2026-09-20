-- DreamList — Database Performance Optimization Indexes
-- Created for query pattern optimization while maintaining strict RLS & data isolation

BEGIN;

-- 1. Index for user-scoped queries on wishlist_items and status filtering
CREATE INDEX IF NOT EXISTS idx_wishlist_items_user_id ON public.wishlist_items(user_id);
CREATE INDEX IF NOT EXISTS idx_wishlist_items_user_status ON public.wishlist_items(user_id, status);

-- 2. Indexes on foreign keys for fast joins during item list & detail queries
CREATE INDEX IF NOT EXISTS idx_item_prices_item_id ON public.item_prices(item_id);
CREATE INDEX IF NOT EXISTS idx_item_research_item_id ON public.item_research(item_id);
CREATE INDEX IF NOT EXISTS idx_item_attachments_item_id ON public.item_attachments(item_id);

-- 3. Indexes for transaction category filtering & envelope spend aggregations
CREATE INDEX IF NOT EXISTS idx_transactions_user_category ON public.transactions(user_id, category_id);

-- 4. Index for user-scoped category queries
CREATE INDEX IF NOT EXISTS idx_expense_categories_user_id ON public.expense_categories(user_id);

COMMIT;
