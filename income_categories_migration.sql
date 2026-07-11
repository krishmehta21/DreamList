-- ============================================================
-- DreamList — Income Categories Migration
-- Run this in the Supabase SQL Editor AFTER schema.sql
-- ============================================================

BEGIN;

-- 1. Add type column to expense_categories (defaults all existing to 'expense')
ALTER TABLE public.expense_categories
  ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'expense'
  CHECK (type IN ('expense', 'income'));

-- 2. Seed income categories (NULL user_id = global default)
INSERT INTO public.expense_categories (user_id, name, icon, color, is_default, type)
VALUES
  (NULL, 'Salary',       'Banknote',   '#22C55E', true, 'income'),
  (NULL, 'Freelance',    'Laptop',     '#10B981', true, 'income'),
  (NULL, 'Gift',         'Gift',       '#A78BFA', true, 'income'),
  (NULL, 'Refund',       'RotateCcw',  '#38BDF8', true, 'income'),
  (NULL, 'Other Income', 'PlusCircle', '#6B7280', true, 'income')
ON CONFLICT DO NOTHING;

-- 3. Fix historical Salary transaction (Mate migration put it under 'Other' expense category)
--    Reassign any income transactions whose note matches 'Salary' or 'Quick Income'
--    from the generic 'Other' expense category → the new Salary income category
UPDATE public.transactions
SET category_id = (
  SELECT id FROM public.expense_categories
  WHERE name = 'Salary' AND type = 'income' AND is_default = true
  LIMIT 1
)
WHERE type = 'income'
  AND note ILIKE '%salary%'
  AND category_id = (
    SELECT id FROM public.expense_categories
    WHERE name = 'Other' AND type = 'expense' AND is_default = true
    LIMIT 1
  );

COMMIT;
