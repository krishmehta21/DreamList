-- ============================================================
-- DreamList â€” Mate Historical Backfill Migration
-- Generated automatically from mate_backup_2026-07-10_18-14.json
-- Date window (IST): 2026-06-25 â†’ 2026-07-11
-- Transactions: 38 expense, 3 income
-- Total: â‚¹33,126.00 expenses + â‚¹33,421.00 income
-- New categories: Mom, Drinks, Tea Shop
--
-- BEFORE RUNNING:
--   1. Find and replace all occurrences of (SELECT id FROM auth.users WHERE email = '21mehtak@gmail.com' LIMIT 1)
--      with your actual Supabase auth.uid() (a UUID string).
--      Account: 21mehtak@gmail.com
--      Find it: Supabase Dashboard â†’ Authentication â†’ Users
--   2. Run the schema migration (schema.sql) FIRST if not done.
--   3. Run this script in the Supabase SQL Editor.
-- ============================================================

BEGIN;

-- â”€â”€ Step 1: Add 'type' column to transactions (not in original schema) â”€â”€
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'expense'
  CHECK (type IN ('expense', 'income'));

-- â”€â”€ Step 2: Create 3 new custom categories â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

-- Mom (UUID: 75a68161-b7fa-44f1-8f56-4ed745469109)
INSERT INTO public.expense_categories (id, user_id, name, icon, color, is_default)
  VALUES ('75a68161-b7fa-44f1-8f56-4ed745469109', (SELECT id FROM auth.users WHERE email = '21mehtak@gmail.com' LIMIT 1), 'Mom', 'Heart', '#FF6B9D', false)
  ON CONFLICT (id) DO NOTHING;

-- Drinks (UUID: d85dd86f-4914-475b-8a3c-0c7ecf2727cc)
INSERT INTO public.expense_categories (id, user_id, name, icon, color, is_default)
  VALUES ('d85dd86f-4914-475b-8a3c-0c7ecf2727cc', (SELECT id FROM auth.users WHERE email = '21mehtak@gmail.com' LIMIT 1), 'Drinks', 'Wine', '#C084FC', false)
  ON CONFLICT (id) DO NOTHING;

-- Tea Shop (UUID: 57247192-8ceb-43ba-aece-68f86b869f87)
INSERT INTO public.expense_categories (id, user_id, name, icon, color, is_default)
  VALUES ('57247192-8ceb-43ba-aece-68f86b869f87', (SELECT id FROM auth.users WHERE email = '21mehtak@gmail.com' LIMIT 1), 'Tea Shop', 'Coffee', '#D97706', false)
  ON CONFLICT (id) DO NOTHING;

-- â”€â”€ Step 3: Insert transactions â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

-- Mate id: 1783686607505_pgbli7zru | EXPENSE | 2026-07-10 | â‚¹75 | Zepto
INSERT INTO public.transactions
  (user_id, amount, category_id, note, occurred_at, source, linked_item_id, type)
VALUES
  ((SELECT id FROM auth.users WHERE email = '21mehtak@gmail.com' LIMIT 1), 75.00, (SELECT id FROM public.expense_categories WHERE name = 'Food' AND is_default = true LIMIT 1),
   'Zepto', '2026-07-10', 'manual', NULL, 'expense');

-- Mate id: 1783686585270_zs3xb788w | EXPENSE | 2026-07-10 | â‚¹65 | Milk etc
INSERT INTO public.transactions
  (user_id, amount, category_id, note, occurred_at, source, linked_item_id, type)
VALUES
  ((SELECT id FROM auth.users WHERE email = '21mehtak@gmail.com' LIMIT 1), 65.00, (SELECT id FROM public.expense_categories WHERE name = 'Food' AND is_default = true LIMIT 1),
   'Milk etc', '2026-07-10', 'manual', NULL, 'expense');

-- Mate id: 1783686573056_ds5lh7vju | EXPENSE | 2026-07-10 | â‚¹220 | Zepto
INSERT INTO public.transactions
  (user_id, amount, category_id, note, occurred_at, source, linked_item_id, type)
VALUES
  ((SELECT id FROM auth.users WHERE email = '21mehtak@gmail.com' LIMIT 1), 220.00, (SELECT id FROM public.expense_categories WHERE name = 'Food' AND is_default = true LIMIT 1),
   'Zepto', '2026-07-10', 'manual', NULL, 'expense');

-- Mate id: 1783422986591_kanxlsd5e | EXPENSE | 2026-07-07 | â‚¹15 | Expense
INSERT INTO public.transactions
  (user_id, amount, category_id, note, occurred_at, source, linked_item_id, type)
VALUES
  ((SELECT id FROM auth.users WHERE email = '21mehtak@gmail.com' LIMIT 1), 15.00, (SELECT id FROM public.expense_categories WHERE name = 'Shopping' AND is_default = true LIMIT 1),
   'Expense', '2026-07-07', 'manual', NULL, 'expense');

-- Mate id: 1783422972175_yj45ymxid | EXPENSE | 2026-07-07 | â‚¹146 | Expense
INSERT INTO public.transactions
  (user_id, amount, category_id, note, occurred_at, source, linked_item_id, type)
VALUES
  ((SELECT id FROM auth.users WHERE email = '21mehtak@gmail.com' LIMIT 1), 146.00, (SELECT id FROM public.expense_categories WHERE name = 'Health' AND is_default = true LIMIT 1),
   'Expense', '2026-07-07', 'manual', NULL, 'expense');

-- Mate id: 1783422949902_wuhpad297 | EXPENSE | 2026-07-07 | â‚¹307 | Zepto
INSERT INTO public.transactions
  (user_id, amount, category_id, note, occurred_at, source, linked_item_id, type)
VALUES
  ((SELECT id FROM auth.users WHERE email = '21mehtak@gmail.com' LIMIT 1), 307.00, (SELECT id FROM public.expense_categories WHERE name = 'Food' AND is_default = true LIMIT 1),
   'Zepto', '2026-07-07', 'manual', NULL, 'expense');

-- Mate id: 1783281282824_6k006illd | EXPENSE | 2026-07-06 | â‚¹321 | Ice cream
INSERT INTO public.transactions
  (user_id, amount, category_id, note, occurred_at, source, linked_item_id, type)
VALUES
  ((SELECT id FROM auth.users WHERE email = '21mehtak@gmail.com' LIMIT 1), 321.00, (SELECT id FROM public.expense_categories WHERE name = 'Food' AND is_default = true LIMIT 1),
   'Ice cream', '2026-07-06', 'manual', NULL, 'expense');

-- Mate id: 1783281267095_tjjm2fzjf | EXPENSE | 2026-07-06 | â‚¹200 | Glasses
INSERT INTO public.transactions
  (user_id, amount, category_id, note, occurred_at, source, linked_item_id, type)
VALUES
  ((SELECT id FROM auth.users WHERE email = '21mehtak@gmail.com' LIMIT 1), 200.00, (SELECT id FROM public.expense_categories WHERE name = 'Shopping' AND is_default = true LIMIT 1),
   'Glasses', '2026-07-06', 'manual', NULL, 'expense');

-- Mate id: 1783281247000_ewho8t5gw | EXPENSE | 2026-07-06 | â‚¹462 | Tibet
INSERT INTO public.transactions
  (user_id, amount, category_id, note, occurred_at, source, linked_item_id, type)
VALUES
  ((SELECT id FROM auth.users WHERE email = '21mehtak@gmail.com' LIMIT 1), 462.00, (SELECT id FROM public.expense_categories WHERE name = 'Food' AND is_default = true LIMIT 1),
   'Tibet', '2026-07-06', 'manual', NULL, 'expense');

-- Mate id: 1783250718924_ssygzkhu0 | EXPENSE | 2026-07-05 | â‚¹33 | Auto
INSERT INTO public.transactions
  (user_id, amount, category_id, note, occurred_at, source, linked_item_id, type)
VALUES
  ((SELECT id FROM auth.users WHERE email = '21mehtak@gmail.com' LIMIT 1), 33.00, (SELECT id FROM public.expense_categories WHERE name = 'Transport' AND is_default = true LIMIT 1),
   'Auto', '2026-07-05', 'manual', NULL, 'expense');

-- Mate id: 1783250678755_y268gm1fo | EXPENSE | 2026-07-05 | â‚¹80 | Auto
INSERT INTO public.transactions
  (user_id, amount, category_id, note, occurred_at, source, linked_item_id, type)
VALUES
  ((SELECT id FROM auth.users WHERE email = '21mehtak@gmail.com' LIMIT 1), 80.00, (SELECT id FROM public.expense_categories WHERE name = 'Transport' AND is_default = true LIMIT 1),
   'Auto', '2026-07-05', 'manual', NULL, 'expense');

-- Mate id: 1783250666287_nzqqrt1tb | EXPENSE | 2026-07-05 | â‚¹120 | Auto
INSERT INTO public.transactions
  (user_id, amount, category_id, note, occurred_at, source, linked_item_id, type)
VALUES
  ((SELECT id FROM auth.users WHERE email = '21mehtak@gmail.com' LIMIT 1), 120.00, (SELECT id FROM public.expense_categories WHERE name = 'Transport' AND is_default = true LIMIT 1),
   'Auto', '2026-07-05', 'manual', NULL, 'expense');

-- Mate id: 1783250507318_6bt2j21db | EXPENSE | 2026-07-05 | â‚¹90 | Tea and samosa
INSERT INTO public.transactions
  (user_id, amount, category_id, note, occurred_at, source, linked_item_id, type)
VALUES
  ((SELECT id FROM auth.users WHERE email = '21mehtak@gmail.com' LIMIT 1), 90.00, '57247192-8ceb-43ba-aece-68f86b869f87',
   'Tea and samosa', '2026-07-05', 'manual', NULL, 'expense');

-- Mate id: 1783250488349_4g3cnqs8b | EXPENSE | 2026-07-05 | â‚¹290 | Daaru
INSERT INTO public.transactions
  (user_id, amount, category_id, note, occurred_at, source, linked_item_id, type)
VALUES
  ((SELECT id FROM auth.users WHERE email = '21mehtak@gmail.com' LIMIT 1), 290.00, 'd85dd86f-4914-475b-8a3c-0c7ecf2727cc',
   'Daaru', '2026-07-05', 'manual', NULL, 'expense');

-- Mate id: 1783250405555_ysycqalnn | EXPENSE | 2026-07-05 | â‚¹275 | Beer
INSERT INTO public.transactions
  (user_id, amount, category_id, note, occurred_at, source, linked_item_id, type)
VALUES
  ((SELECT id FROM auth.users WHERE email = '21mehtak@gmail.com' LIMIT 1), 275.00, 'd85dd86f-4914-475b-8a3c-0c7ecf2727cc',
   'Beer', '2026-07-05', 'manual', NULL, 'expense');

-- Mate id: 1783250329146_bxxm94u7g | EXPENSE | 2026-07-05 | â‚¹25 | Milk
INSERT INTO public.transactions
  (user_id, amount, category_id, note, occurred_at, source, linked_item_id, type)
VALUES
  ((SELECT id FROM auth.users WHERE email = '21mehtak@gmail.com' LIMIT 1), 25.00, (SELECT id FROM public.expense_categories WHERE name = 'Food' AND is_default = true LIMIT 1),
   'Milk', '2026-07-05', 'manual', NULL, 'expense');

-- Mate id: 1783250300776_4sbxdkv6z | INCOME | 2026-07-05 | â‚¹211 | Income
INSERT INTO public.transactions
  (user_id, amount, category_id, note, occurred_at, source, linked_item_id, type)
VALUES
  ((SELECT id FROM auth.users WHERE email = '21mehtak@gmail.com' LIMIT 1), 211.00, (SELECT id FROM public.expense_categories WHERE name = 'Other' AND is_default = true LIMIT 1),
   'Income', '2026-07-05', 'manual', NULL, 'income');

-- Mate id: 1783250240375_fv9jm6ozp | INCOME | 2026-07-05 | â‚¹1210 | Get Back for groceries
INSERT INTO public.transactions
  (user_id, amount, category_id, note, occurred_at, source, linked_item_id, type)
VALUES
  ((SELECT id FROM auth.users WHERE email = '21mehtak@gmail.com' LIMIT 1), 1210.00, (SELECT id FROM public.expense_categories WHERE name = 'Other' AND is_default = true LIMIT 1),
   'Get Back for groceries', '2026-07-05', 'manual', NULL, 'income');

-- Mate id: 1783075899886_e2b4to4an | EXPENSE | 2026-07-03 | â‚¹284 | Eggs milk and coffee
INSERT INTO public.transactions
  (user_id, amount, category_id, note, occurred_at, source, linked_item_id, type)
VALUES
  ((SELECT id FROM auth.users WHERE email = '21mehtak@gmail.com' LIMIT 1), 284.00, (SELECT id FROM public.expense_categories WHERE name = 'Food' AND is_default = true LIMIT 1),
   'Eggs milk and coffee', '2026-07-03', 'manual', NULL, 'expense');

-- Mate id: 1783075878430_j30daj0cz | EXPENSE | 2026-07-03 | â‚¹25 | Milk
INSERT INTO public.transactions
  (user_id, amount, category_id, note, occurred_at, source, linked_item_id, type)
VALUES
  ((SELECT id FROM auth.users WHERE email = '21mehtak@gmail.com' LIMIT 1), 25.00, (SELECT id FROM public.expense_categories WHERE name = 'Food' AND is_default = true LIMIT 1),
   'Milk', '2026-07-03', 'manual', NULL, 'expense');

-- Mate id: 1783008951647_ty6hllevj | EXPENSE | 2026-07-02 | â‚¹1350 | Groceries zepto
INSERT INTO public.transactions
  (user_id, amount, category_id, note, occurred_at, source, linked_item_id, type)
VALUES
  ((SELECT id FROM auth.users WHERE email = '21mehtak@gmail.com' LIMIT 1), 1350.00, (SELECT id FROM public.expense_categories WHERE name = 'Food' AND is_default = true LIMIT 1),
   'Groceries zepto', '2026-07-02', 'manual', NULL, 'expense');

-- Mate id: 1782997636480_wt1bg64ra | EXPENSE | 2026-07-02 | â‚¹1070 | Dmart
INSERT INTO public.transactions
  (user_id, amount, category_id, note, occurred_at, source, linked_item_id, type)
VALUES
  ((SELECT id FROM auth.users WHERE email = '21mehtak@gmail.com' LIMIT 1), 1070.00, (SELECT id FROM public.expense_categories WHERE name = 'Food' AND is_default = true LIMIT 1),
   'Dmart', '2026-07-02', 'manual', NULL, 'expense');

-- Mate id: 1782997618061_nemuu4kxe | EXPENSE | 2026-07-02 | â‚¹567 | Lunch. Naan butter chicken
INSERT INTO public.transactions
  (user_id, amount, category_id, note, occurred_at, source, linked_item_id, type)
VALUES
  ((SELECT id FROM auth.users WHERE email = '21mehtak@gmail.com' LIMIT 1), 567.00, (SELECT id FROM public.expense_categories WHERE name = 'Food' AND is_default = true LIMIT 1),
   'Lunch. Naan butter chicken', '2026-07-02', 'manual', NULL, 'expense');

-- Mate id: 1782997600770_tr8ilkcax | EXPENSE | 2026-07-02 | â‚¹40 | Chai
INSERT INTO public.transactions
  (user_id, amount, category_id, note, occurred_at, source, linked_item_id, type)
VALUES
  ((SELECT id FROM auth.users WHERE email = '21mehtak@gmail.com' LIMIT 1), 40.00, '57247192-8ceb-43ba-aece-68f86b869f87',
   'Chai', '2026-07-02', 'manual', NULL, 'expense');

-- Mate id: 1782997587077_9pccufklq | EXPENSE | 2026-07-02 | â‚¹444 | Petrol
INSERT INTO public.transactions
  (user_id, amount, category_id, note, occurred_at, source, linked_item_id, type)
VALUES
  ((SELECT id FROM auth.users WHERE email = '21mehtak@gmail.com' LIMIT 1), 444.00, (SELECT id FROM public.expense_categories WHERE name = 'Transport' AND is_default = true LIMIT 1),
   'Petrol', '2026-07-02', 'manual', NULL, 'expense');

-- Mate id: 1782979837036_1vcig67a0 | EXPENSE | 2026-07-02 | â‚¹238 | Cab Home from Indra
INSERT INTO public.transactions
  (user_id, amount, category_id, note, occurred_at, source, linked_item_id, type)
VALUES
  ((SELECT id FROM auth.users WHERE email = '21mehtak@gmail.com' LIMIT 1), 238.00, (SELECT id FROM public.expense_categories WHERE name = 'Transport' AND is_default = true LIMIT 1),
   'Cab Home from Indra', '2026-07-02', 'manual', NULL, 'expense');

-- Mate id: 1782979821977_8cl0qucqt | EXPENSE | 2026-07-02 | â‚¹2319 | Chin Lungs Dinner
INSERT INTO public.transactions
  (user_id, amount, category_id, note, occurred_at, source, linked_item_id, type)
VALUES
  ((SELECT id FROM auth.users WHERE email = '21mehtak@gmail.com' LIMIT 1), 2319.00, (SELECT id FROM public.expense_categories WHERE name = 'Food' AND is_default = true LIMIT 1),
   'Chin Lungs Dinner', '2026-07-02', 'manual', NULL, 'expense');

-- Mate id: 1782979800381_g704tp3p2 | EXPENSE | 2026-07-02 | â‚¹200 | Cab to Indra
INSERT INTO public.transactions
  (user_id, amount, category_id, note, occurred_at, source, linked_item_id, type)
VALUES
  ((SELECT id FROM auth.users WHERE email = '21mehtak@gmail.com' LIMIT 1), 200.00, (SELECT id FROM public.expense_categories WHERE name = 'Transport' AND is_default = true LIMIT 1),
   'Cab to Indra', '2026-07-02', 'manual', NULL, 'expense');

-- Mate id: 1782979779698_bf1iqh5nx | EXPENSE | 2026-07-02 | â‚¹180 | Zepto
INSERT INTO public.transactions
  (user_id, amount, category_id, note, occurred_at, source, linked_item_id, type)
VALUES
  ((SELECT id FROM auth.users WHERE email = '21mehtak@gmail.com' LIMIT 1), 180.00, (SELECT id FROM public.expense_categories WHERE name = 'Food' AND is_default = true LIMIT 1),
   'Zepto', '2026-07-02', 'manual', NULL, 'expense');

-- Mate id: 1782979759063_agm9dc8z7 | EXPENSE | 2026-07-02 | â‚¹160 | Expense
INSERT INTO public.transactions
  (user_id, amount, category_id, note, occurred_at, source, linked_item_id, type)
VALUES
  ((SELECT id FROM auth.users WHERE email = '21mehtak@gmail.com' LIMIT 1), 160.00, 'd85dd86f-4914-475b-8a3c-0c7ecf2727cc',
   'Expense', '2026-07-02', 'manual', NULL, 'expense');

-- Mate id: 1782979742961_w282msm6n | EXPENSE | 2026-07-02 | â‚¹190 | Scooty Maintenance and Cleaning
INSERT INTO public.transactions
  (user_id, amount, category_id, note, occurred_at, source, linked_item_id, type)
VALUES
  ((SELECT id FROM auth.users WHERE email = '21mehtak@gmail.com' LIMIT 1), 190.00, (SELECT id FROM public.expense_categories WHERE name = 'Transport' AND is_default = true LIMIT 1),
   'Scooty Maintenance and Cleaning', '2026-07-02', 'manual', NULL, 'expense');

-- Mate id: 1782979699325_xti9ilvbj | EXPENSE | 2026-07-02 | â‚¹250 | Udupi Lunch
INSERT INTO public.transactions
  (user_id, amount, category_id, note, occurred_at, source, linked_item_id, type)
VALUES
  ((SELECT id FROM auth.users WHERE email = '21mehtak@gmail.com' LIMIT 1), 250.00, (SELECT id FROM public.expense_categories WHERE name = 'Food' AND is_default = true LIMIT 1),
   'Udupi Lunch', '2026-07-02', 'manual', NULL, 'expense');

-- Mate id: 1782841043365_9i43gpd90 | EXPENSE | 2026-06-30 | â‚¹1331 | Rentomojo
INSERT INTO public.transactions
  (user_id, amount, category_id, note, occurred_at, source, linked_item_id, type)
VALUES
  ((SELECT id FROM auth.users WHERE email = '21mehtak@gmail.com' LIMIT 1), 1331.00, (SELECT id FROM public.expense_categories WHERE name = 'Bills' AND is_default = true LIMIT 1),
   'Rentomojo', '2026-06-30', 'manual', NULL, 'expense');

-- Mate id: 1782840899917_lb02cg5gl | EXPENSE | 2026-06-30 | â‚¹3200 | Mom
INSERT INTO public.transactions
  (user_id, amount, category_id, note, occurred_at, source, linked_item_id, type)
VALUES
  ((SELECT id FROM auth.users WHERE email = '21mehtak@gmail.com' LIMIT 1), 3200.00, '75a68161-b7fa-44f1-8f56-4ed745469109',
   'Mom', '2026-06-30', 'manual', NULL, 'expense');

-- Mate id: 1782840888116_emk8ctnow | EXPENSE | 2026-06-30 | â‚¹590 | Wifi
INSERT INTO public.transactions
  (user_id, amount, category_id, note, occurred_at, source, linked_item_id, type)
VALUES
  ((SELECT id FROM auth.users WHERE email = '21mehtak@gmail.com' LIMIT 1), 590.00, (SELECT id FROM public.expense_categories WHERE name = 'Bills' AND is_default = true LIMIT 1),
   'Wifi', '2026-06-30', 'manual', NULL, 'expense');

-- Mate id: 1782840782154_gtyfbx0h0 | EXPENSE | 2026-06-30 | â‚¹15000 | Rent
INSERT INTO public.transactions
  (user_id, amount, category_id, note, occurred_at, source, linked_item_id, type)
VALUES
  ((SELECT id FROM auth.users WHERE email = '21mehtak@gmail.com' LIMIT 1), 15000.00, (SELECT id FROM public.expense_categories WHERE name = 'Bills' AND is_default = true LIMIT 1),
   'Rent', '2026-06-30', 'manual', NULL, 'expense');

-- Mate id: 1782840761595_cymg5v9fn | EXPENSE | 2026-06-30 | â‚¹1500 | Maid
INSERT INTO public.transactions
  (user_id, amount, category_id, note, occurred_at, source, linked_item_id, type)
VALUES
  ((SELECT id FROM auth.users WHERE email = '21mehtak@gmail.com' LIMIT 1), 1500.00, (SELECT id FROM public.expense_categories WHERE name = 'Bills' AND is_default = true LIMIT 1),
   'Maid', '2026-06-30', 'manual', NULL, 'expense');

-- Mate id: 1782838085176_if143bzh3 | EXPENSE | 2026-06-30 | â‚¹280 | Biryani
INSERT INTO public.transactions
  (user_id, amount, category_id, note, occurred_at, source, linked_item_id, type)
VALUES
  ((SELECT id FROM auth.users WHERE email = '21mehtak@gmail.com' LIMIT 1), 280.00, (SELECT id FROM public.expense_categories WHERE name = 'Food' AND is_default = true LIMIT 1),
   'Biryani', '2026-06-30', 'manual', NULL, 'expense');

-- Mate id: 1782830653008_qol3d6lpf | EXPENSE | 2026-06-30 | â‚¹60 | Gol gappe
INSERT INTO public.transactions
  (user_id, amount, category_id, note, occurred_at, source, linked_item_id, type)
VALUES
  ((SELECT id FROM auth.users WHERE email = '21mehtak@gmail.com' LIMIT 1), 60.00, (SELECT id FROM public.expense_categories WHERE name = 'Food' AND is_default = true LIMIT 1),
   'Gol gappe', '2026-06-30', 'manual', NULL, 'expense');

-- Mate id: 1782828145232_or4vy5pvv | INCOME | 2026-06-30 | â‚¹32000 | Quick Income
INSERT INTO public.transactions
  (user_id, amount, category_id, note, occurred_at, source, linked_item_id, type)
VALUES
  ((SELECT id FROM auth.users WHERE email = '21mehtak@gmail.com' LIMIT 1), 32000.00, (SELECT id FROM public.expense_categories WHERE name = 'Other' AND is_default = true LIMIT 1),
   'Quick Income', '2026-06-30', 'manual', NULL, 'income');

-- Mate id: 1782828204800_0jihu33qd | EXPENSE | 2026-06-30 | â‚¹1124 | Wapis
INSERT INTO public.transactions
  (user_id, amount, category_id, note, occurred_at, source, linked_item_id, type)
VALUES
  ((SELECT id FROM auth.users WHERE email = '21mehtak@gmail.com' LIMIT 1), 1124.00, (SELECT id FROM public.expense_categories WHERE name = 'Bills' AND is_default = true LIMIT 1),
   'Wapis', '2026-06-30', 'manual', NULL, 'expense');


COMMIT;

-- End of migration â€” 41 rows total
