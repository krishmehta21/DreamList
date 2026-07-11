-- ============================================================
-- DreamList — Mate Migration Income Fix
-- Corrects 3 transactions that were migrated as 'expense' but
-- should be 'income', cross-referenced against the original
-- mate_backup_2026-07-10_18-14.json
-- ============================================================
-- Run AFTER: schema.sql, mate_migration.sql, income_categories_migration.sql
-- ============================================================
--
-- SOURCE JSON — all "type":"income" entries in Jun 25 – Jul 11 2026 window:
--
--  #1  id: 1782828145232_or4vy5pvv
--      note: "Quick Income"  amount: 32000  date: 1782828145216 (Jun 30 IST)
--      mate_category: static_cat_quick_income → DreamList: Other Income
--
--  #2  id: 1783250240375_fv9jm6ozp
--      note: "Get Back for groceries"  amount: 1210  date: 1783250198414 (Jul 5 IST)
--      mate_category: Other Income → DreamList: Refund
--
--  #3  id: 1783250300776_4sbxdkv6z
--      note: "Income"  amount: 211  date: 1783250265724 (Jul 5 IST)
--      mate_category: Other Income → DreamList: Other Income
--
-- No other income transactions exist in the date range.
-- The Salary transaction (id 1772395015003, Apr 2026) is OUTSIDE the range
-- and was not migrated — it is not in DreamList's transactions table.
--
-- MATCH STRATEGY: note + amount + occurred_at (unique triple for each row)
-- Low ambiguity risk: ₹32,000 + "Quick Income" + Jun 30 is unique;
-- ₹1,210 + "Get Back for groceries" + Jul 5 is unique;
-- ₹211 + "Income" + Jul 5 is unique (only one ₹211 row on that date).
-- ============================================================

-- STEP 0: Preview — see exactly what rows will be updated BEFORE committing
-- Run this SELECT first to verify the match:
SELECT
  id,
  note,
  amount,
  occurred_at,
  type,
  category_id,
  (SELECT name FROM public.expense_categories WHERE id = t.category_id) AS category_name
FROM public.transactions t
WHERE
  (note = 'Quick Income'           AND amount = 32000 AND occurred_at = '2026-06-30') OR
  (note = 'Get Back for groceries' AND amount = 1210  AND occurred_at = '2026-07-05') OR
  (note = 'Income'                 AND amount = 211   AND occurred_at = '2026-07-05')
ORDER BY occurred_at;

-- ============================================================
-- If the SELECT above returns exactly 3 rows with the expected values,
-- run the block below:
-- ============================================================

BEGIN;

-- Fix #1: "Quick Income" ₹32,000 Jun 30
--   type: expense → income
--   category: whatever it was → Other Income
UPDATE public.transactions
SET
  type        = 'income',
  category_id = (
    SELECT id FROM public.expense_categories
    WHERE name = 'Other Income' AND type = 'income' AND is_default = true
    LIMIT 1
  )
WHERE
  note        = 'Quick Income'
  AND amount  = 32000
  AND occurred_at = '2026-06-30';

-- Fix #2: "Get Back for groceries" ₹1,210 Jul 5
--   type: expense → income
--   category: → Refund (it's a grocery reimbursement, semantically a refund)
UPDATE public.transactions
SET
  type        = 'income',
  category_id = (
    SELECT id FROM public.expense_categories
    WHERE name = 'Refund' AND type = 'income' AND is_default = true
    LIMIT 1
  )
WHERE
  note        = 'Get Back for groceries'
  AND amount  = 1210
  AND occurred_at = '2026-07-05';

-- Fix #3: "Income" ₹211 Jul 5
--   type: expense → income
--   category: → Other Income
UPDATE public.transactions
SET
  type        = 'income',
  category_id = (
    SELECT id FROM public.expense_categories
    WHERE name = 'Other Income' AND type = 'income' AND is_default = true
    LIMIT 1
  )
WHERE
  note        = 'Income'
  AND amount  = 211
  AND occurred_at = '2026-07-05';

COMMIT;

-- ============================================================
-- STEP 2: Verify — run after commit to confirm corrections
-- ============================================================
SELECT
  id,
  note,
  amount,
  occurred_at,
  type,
  (SELECT name FROM public.expense_categories WHERE id = t.category_id) AS category_name
FROM public.transactions t
WHERE
  (note = 'Quick Income'           AND amount = 32000 AND occurred_at = '2026-06-30') OR
  (note = 'Get Back for groceries' AND amount = 1210  AND occurred_at = '2026-07-05') OR
  (note = 'Income'                 AND amount = 211   AND occurred_at = '2026-07-05')
ORDER BY occurred_at;
-- Expected: all 3 rows show type='income' with correct category names
