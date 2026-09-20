-- DreamList — Budget Engine Schema Migration
-- Creates core tables: budget_month, category_limit, recovery_plan
-- Extends transactions table with is_ghost and regret columns

BEGIN;

-- 1. Create custom types if they do not exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'regret_level') THEN
        CREATE TYPE public.regret_level AS ENUM ('unrated', 'love', 'okay', 'regret');
    END IF;
END$$;

-- 2. Create budget_month table
CREATE TABLE IF NOT EXISTS public.budget_month (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    calendar_month DATE NOT NULL, -- Stored as YYYY-MM-01
    salary_received NUMERIC(10, 2) NOT NULL,
    savings_target NUMERIC(10, 2) NOT NULL, -- e.g. 10000.00
    spendable_allowance NUMERIC(10, 2) NOT NULL, -- e.g. 45000.00
    bills_reserved_amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    status TEXT NOT NULL CHECK (status IN ('active', 'completed', 'archived')) DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT unique_user_month UNIQUE (user_id, calendar_month)
);

-- 3. Create category_limit table (links category limits to specific budget month)
CREATE TABLE IF NOT EXISTS public.category_limit (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    budget_month_id UUID NOT NULL REFERENCES public.budget_month(id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES public.expense_categories(id) ON DELETE CASCADE,
    limit_amount NUMERIC(10, 2) NOT NULL,
    CONSTRAINT unique_month_category UNIQUE (budget_month_id, category_id)
);

-- 4. Create recovery_plan table
CREATE TABLE IF NOT EXISTS public.recovery_plan (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    budget_month_id UUID NOT NULL REFERENCES public.budget_month(id) ON DELETE CASCADE,
    original_overspend NUMERIC(10, 2) NOT NULL,
    adjusted_daily_limit NUMERIC(10, 2) NOT NULL,
    duration_days INTEGER NOT NULL,
    remaining_days INTEGER NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 5. Extend public.transactions table with columns for the budget engine
ALTER TABLE public.transactions 
    ADD COLUMN IF NOT EXISTS is_ghost BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS regret public.regret_level NOT NULL DEFAULT 'unrated';

-- 6. Enable Row Level Security (RLS)
ALTER TABLE public.budget_month ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.category_limit ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recovery_plan ENABLE ROW LEVEL SECURITY;

-- 7. Setup RLS Policies (Ensure users can only read/write their own budgets/limits)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'budget_month' AND policyname = 'manage_budget_month'
    ) THEN
        CREATE POLICY manage_budget_month ON public.budget_month
            FOR ALL USING (user_id = auth.uid());
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'category_limit' AND policyname = 'manage_category_limit'
    ) THEN
        CREATE POLICY manage_category_limit ON public.category_limit
            FOR ALL USING (
                EXISTS (
                    SELECT 1 FROM public.budget_month
                    WHERE budget_month.id = category_limit.budget_month_id
                    AND budget_month.user_id = auth.uid()
                )
            );
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'recovery_plan' AND policyname = 'manage_recovery_plan'
    ) THEN
        CREATE POLICY manage_recovery_plan ON public.recovery_plan
            FOR ALL USING (
                EXISTS (
                    SELECT 1 FROM public.budget_month
                    WHERE budget_month.id = recovery_plan.budget_month_id
                    AND budget_month.user_id = auth.uid()
                )
            );
    END IF;
END$$;

COMMIT;
