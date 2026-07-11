-- ============================================================
-- DreamList — Shift June 30 transactions to July 1
-- Moves ALL rows dated 2026-06-30 to 2026-07-01 so they
-- count under the July month view.
-- ============================================================

-- STEP 0: Preview — see exactly which rows will move
SELECT
  id,
  note,
  amount,
  type,
  occurred_at,
  (SELECT name FROM public.expense_categories WHERE id = t.category_id) AS category_name
FROM public.transactions t
WHERE occurred_at = '2026-06-30'
ORDER BY type, amount DESC;

-- ============================================================
-- If the preview looks correct, run the block below:
-- ============================================================

BEGIN;

UPDATE public.transactions
SET occurred_at = '2026-07-01'
WHERE occurred_at = '2026-06-30';

COMMIT;

-- STEP 2: Verify — confirm no rows remain on Jun 30 and they appear on Jul 1
SELECT
  note,
  amount,
  type,
  occurred_at,
  (SELECT name FROM public.expense_categories WHERE id = t.category_id) AS category_name
FROM public.transactions t
WHERE occurred_at IN ('2026-06-30', '2026-07-01')
ORDER BY occurred_at, type, amount DESC;
