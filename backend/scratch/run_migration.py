import psycopg2

sql = """
BEGIN;

-- 1. Create goals table
CREATE TABLE IF NOT EXISTS public.goals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    target_amount NUMERIC(10, 2) NOT NULL,
    icon TEXT NOT NULL DEFAULT '🎯',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT unique_user_goal_name UNIQUE (user_id, name)
);

-- 2. Add goal_id to transactions table
ALTER TABLE public.transactions 
    ADD COLUMN IF NOT EXISTS goal_id UUID REFERENCES public.goals(id) ON DELETE SET NULL;

-- 3. Enable RLS on goals
ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;

-- 4. Setup RLS Policy
DROP POLICY IF EXISTS manage_goals ON public.goals;
CREATE POLICY manage_goals ON public.goals
    FOR ALL USING (user_id = auth.uid());

COMMIT;
"""

try:
    conn = psycopg2.connect(
        host="aws-1-ap-southeast-2.pooler.supabase.com",
        user="postgres.updldhzjuuxctkhehjjl",
        password="Madhu@101976",
        port=5432,
        database="postgres"
    )
    cur = conn.cursor()
    print("Connected to Supabase database. Running migration...")
    cur.execute(sql)
    conn.commit()
    print("Migration executed and committed successfully!")
    cur.close()
    conn.close()
except Exception as e:
    print("Failed to run migration:", e)
