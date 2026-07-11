-- DreamList — Expense Tracking Module Database Schema

-- 1. Create expense_categories table
CREATE TABLE IF NOT EXISTS public.expense_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    icon TEXT NOT NULL, -- Lucide icon name
    color TEXT NOT NULL, -- Hex code
    is_default BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 2. Create transactions table with numeric precision (10, 2)
CREATE TABLE IF NOT EXISTS public.transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    amount NUMERIC(10, 2) NOT NULL,
    category_id UUID NOT NULL REFERENCES public.expense_categories(id) ON DELETE CASCADE,
    note TEXT,
    occurred_at DATE NOT NULL DEFAULT CURRENT_DATE,
    source TEXT NOT NULL CHECK (source IN ('manual', 'wishlist_link')),
    linked_item_id UUID REFERENCES public.wishlist_items(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 3. Create indexes for performance optimization
CREATE INDEX IF NOT EXISTS idx_transactions_user_occurred ON public.transactions(user_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_category ON public.transactions(category_id);

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.expense_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- 5. Set RLS Policies
CREATE POLICY select_categories ON public.expense_categories 
    FOR SELECT USING (user_id = auth.uid() OR is_default = true);

CREATE POLICY insert_categories ON public.expense_categories 
    FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY update_delete_categories ON public.expense_categories 
    FOR ALL USING (user_id = auth.uid() AND is_default = false);

CREATE POLICY select_transactions ON public.transactions 
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY insert_transactions ON public.transactions 
    FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY update_delete_transactions ON public.transactions 
    FOR ALL USING (user_id = auth.uid());

-- 6. Seed default categories
INSERT INTO public.expense_categories (name, icon, color, is_default) VALUES
    ('Food', 'Utensils', '#F59E0B', true),
    ('Transport', 'Car', '#3B82F6', true),
    ('Shopping', 'ShoppingBag', '#EC4899', true),
    ('Bills', 'CreditCard', '#EF4444', true),
    ('Entertainment', 'Tv', '#8B5CF6', true),
    ('Health', 'Heart', '#10B981', true),
    ('Other', 'Coins', '#6B7280', true);
