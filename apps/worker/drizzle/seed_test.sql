-- Test data seed for Declyne. Idempotent-ish: uses stable ids so re-running overwrites.
-- Anchored as if "today" is mid-May 2026 (2026-05-15, Friday).
-- ~90 days of activity ending 2026-05-15. Toronto-realistic merchants and price points.

-- Wipe transactional state so date-anchored data refreshes cleanly.
-- Order matters: drop dependents first (FKs on transactions, splits).
DELETE FROM period_allocations;
DELETE FROM cc_statement_snapshots;
DELETE FROM debt_payments;
DELETE FROM split_events;
DELETE FROM behaviour_snapshots;
DELETE FROM pay_periods;
DELETE FROM review_queue;
DELETE FROM transactions;

-- Accounts
INSERT OR REPLACE INTO accounts (id, name, institution, type, currency, last_import_at, archived) VALUES
  ('acc_td_chq', 'TD Chequing', 'TD', 'chequing', 'CAD', '2026-05-14T22:00:00Z', 0),
  ('acc_td_sav', 'TD Savings', 'TD', 'savings', 'CAD', '2026-05-14T22:00:00Z', 0),
  ('acc_td_visa', 'TD Visa', 'TD', 'credit', 'CAD', '2026-05-14T22:00:00Z', 0),
  ('acc_capone', 'Capital One', 'Capital One', 'credit', 'CAD', '2026-05-14T22:00:00Z', 0);

-- Settings relevant to paycheque detection, essentials fallback, current phase
INSERT OR REPLACE INTO settings (key, value) VALUES
  ('paycheque_source_account_id', 'acc_td_chq'),
  ('paycheque_pattern', 'PAYROLL DEP ACME'),
  ('paycheque_min_cents', '150000'),
  ('paycheque_fallback_days', '14'),
  ('essentials_monthly_cents_manual', '380000'),
  ('current_phase', '4'),
  ('phase2_entry_non_mortgage_debt_cents', '580500');

-- Merchants
INSERT OR REPLACE INTO merchants (id, display_name, normalized_key, category_default_id, verified) VALUES
  ('m_acme',         'Acme Corp Payroll',   'acme payroll',         'cat_paycheque',     1),
  ('m_landlord',     'Landlord',            'landlord rent',        'cat_rent',          1),
  ('m_loblaws',      'Loblaws',             'loblaws',              'cat_groceries',     1),
  ('m_nofrills',     'No Frills',           'no frills',            'cat_groceries',     1),
  ('m_metro',        'Metro',               'metro grocery',        'cat_groceries',     1),
  ('m_costco',       'Costco',              'costco wholesale',     'cat_groceries',     1),
  ('m_shoppers',     'Shoppers Drug Mart',  'shoppers drug',        'cat_medical',       1),
  ('m_torontohydro', 'Toronto Hydro',       'toronto hydro',        'cat_utilities',     1),
  ('m_enbridge',     'Enbridge Gas',        'enbridge',             'cat_utilities',     1),
  ('m_bell',         'Bell Mobility',       'bell mobility',        'cat_phone',         1),
  ('m_rogers',       'Rogers',              'rogers internet',      'cat_internet',      1),
  ('m_intact',       'Intact Insurance',    'intact',               'cat_insurance',     1),
  ('m_presto',       'PRESTO TTC',          'presto ttc',           'cat_transit',       1),
  ('m_goodlife',     'GoodLife Fitness',    'goodlife',             'cat_fitness',       1),
  ('m_netflix',      'Netflix',             'netflix',              'cat_subscriptions', 1),
  ('m_spotify',      'Spotify',             'spotify',              'cat_subscriptions', 1),
  ('m_apple',        'Apple iCloud',        'apple com bill',       'cat_subscriptions', 1),
  ('m_tim',          'Tim Hortons',         'tim hortons',          'cat_fastfood',      1),
  ('m_starbucks',    'Starbucks',           'starbucks',            'cat_fastfood',      1),
  ('m_mcd',          'McDonald''s',         'mcdonalds',            'cat_fastfood',      1),
  ('m_pizzaiolo',    'Pizzaiolo',           'pizzaiolo',            'cat_fastfood',      1),
  ('m_banhmi',       'Banh Mi Boys',        'banh mi boys',         'cat_dining',        1),
  ('m_pai',          'Pai Northern Thai',   'pai northern',         'cat_dining',        1),
  ('m_ladymarm',     'Lady Marmalade',      'lady marmalade',       'cat_dining',        1),
  ('m_barraval',     'Bar Raval',           'bar raval',            'cat_dining',        1),
  ('m_goldenturtle', 'Golden Turtle',       'golden turtle',        'cat_dining',        1),
  ('m_lcbo',         'LCBO',                'lcbo',                 'cat_alcohol',       1),
  ('m_beer',         'The Beer Store',      'beer store',           'cat_alcohol',       1),
  ('m_tokyosmoke',   'Tokyo Smoke',         'tokyo smoke',          'cat_cannabis',      1),
  ('m_uber',         'Uber Eats',           'uber eats',            'cat_dining',        1),
  ('m_amazon',       'Amazon.ca',           'amazon',               'cat_shopping',      1),
  ('m_indigo',       'Indigo',              'indigo books',         'cat_shopping',      1),
  ('m_canadiantire', 'Canadian Tire',       'canadian tire',        'cat_shopping',      1),
  ('m_td_visa',      'TD Visa Payment',     'td visa payment',      'cat_cc_payment',    1),
  ('m_capone',       'Capital One Payment', 'capone payment',       'cat_cc_payment',    1);

-- ===== Chequing: paycheques + bills + CC payments + savings transfers =====
INSERT OR REPLACE INTO transactions (id, account_id, posted_at, amount_cents, description_raw, merchant_id, category_id, dedup_hash, source, created_at) VALUES
  -- Paycheques (biweekly Fri, $2,400 net)
  ('tx_pay_01', 'acc_td_chq', '2026-02-13', 240000, 'PAYROLL DEP ACME CORP', 'm_acme', 'cat_paycheque', 'h_pay_01', 'csv', '2026-02-13T10:00:00Z'),
  ('tx_pay_02', 'acc_td_chq', '2026-02-27', 240000, 'PAYROLL DEP ACME CORP', 'm_acme', 'cat_paycheque', 'h_pay_02', 'csv', '2026-02-27T10:00:00Z'),
  ('tx_pay_03', 'acc_td_chq', '2026-03-13', 240000, 'PAYROLL DEP ACME CORP', 'm_acme', 'cat_paycheque', 'h_pay_03', 'csv', '2026-03-13T10:00:00Z'),
  ('tx_pay_04', 'acc_td_chq', '2026-03-27', 240000, 'PAYROLL DEP ACME CORP', 'm_acme', 'cat_paycheque', 'h_pay_04', 'csv', '2026-03-27T10:00:00Z'),
  ('tx_pay_05', 'acc_td_chq', '2026-04-10', 240000, 'PAYROLL DEP ACME CORP', 'm_acme', 'cat_paycheque', 'h_pay_05', 'csv', '2026-04-10T10:00:00Z'),
  ('tx_pay_06', 'acc_td_chq', '2026-04-24', 240000, 'PAYROLL DEP ACME CORP', 'm_acme', 'cat_paycheque', 'h_pay_06', 'csv', '2026-04-24T10:00:00Z'),
  ('tx_pay_07', 'acc_td_chq', '2026-05-08', 240000, 'PAYROLL DEP ACME CORP', 'm_acme', 'cat_paycheque', 'h_pay_07', 'csv', '2026-05-08T10:00:00Z'),

  -- Rent: $2,400/mo (Toronto 1-bed)
  ('tx_rent_03', 'acc_td_chq', '2026-03-01', -240000, 'LANDLORD EFT RENT', 'm_landlord', 'cat_rent', 'h_rent_03', 'csv', '2026-03-01T09:00:00Z'),
  ('tx_rent_04', 'acc_td_chq', '2026-04-01', -240000, 'LANDLORD EFT RENT', 'm_landlord', 'cat_rent', 'h_rent_04', 'csv', '2026-04-01T09:00:00Z'),
  ('tx_rent_05', 'acc_td_chq', '2026-05-01', -240000, 'LANDLORD EFT RENT', 'm_landlord', 'cat_rent', 'h_rent_05', 'csv', '2026-05-01T09:00:00Z'),

  -- Toronto Hydro (electricity) 12th: cooler weather peak in Feb/Mar
  ('tx_hyd_02', 'acc_td_chq', '2026-02-12', -11200, 'TORONTO HYDRO',  'm_torontohydro', 'cat_utilities', 'h_hyd_02', 'csv', '2026-02-12T09:00:00Z'),
  ('tx_hyd_03', 'acc_td_chq', '2026-03-12', -10400, 'TORONTO HYDRO',  'm_torontohydro', 'cat_utilities', 'h_hyd_03', 'csv', '2026-03-12T09:00:00Z'),
  ('tx_hyd_04', 'acc_td_chq', '2026-04-13',  -8900, 'TORONTO HYDRO',  'm_torontohydro', 'cat_utilities', 'h_hyd_04', 'csv', '2026-04-13T09:00:00Z'),
  ('tx_hyd_05', 'acc_td_chq', '2026-05-12',  -7800, 'TORONTO HYDRO',  'm_torontohydro', 'cat_utilities', 'h_hyd_05', 'csv', '2026-05-12T09:00:00Z'),

  -- Enbridge (gas) 18th: drops as furnace use ends
  ('tx_enb_02', 'acc_td_chq', '2026-02-18', -13400, 'ENBRIDGE GAS',   'm_enbridge', 'cat_utilities', 'h_enb_02', 'csv', '2026-02-18T09:00:00Z'),
  ('tx_enb_03', 'acc_td_chq', '2026-03-18', -10800, 'ENBRIDGE GAS',   'm_enbridge', 'cat_utilities', 'h_enb_03', 'csv', '2026-03-18T09:00:00Z'),
  ('tx_enb_04', 'acc_td_chq', '2026-04-20',  -6200, 'ENBRIDGE GAS',   'm_enbridge', 'cat_utilities', 'h_enb_04', 'csv', '2026-04-20T09:00:00Z'),

  -- Phone: Bell Mobility $85 (28th)
  ('tx_phone_02','acc_td_chq', '2026-02-28',  -8500, 'BELL MOBILITY', 'm_bell', 'cat_phone', 'h_phone_02', 'csv', '2026-02-28T09:00:00Z'),
  ('tx_phone_03','acc_td_chq', '2026-03-28',  -8500, 'BELL MOBILITY', 'm_bell', 'cat_phone', 'h_phone_03', 'csv', '2026-03-28T09:00:00Z'),
  ('tx_phone_04','acc_td_chq', '2026-04-28',  -8500, 'BELL MOBILITY', 'm_bell', 'cat_phone', 'h_phone_04', 'csv', '2026-04-28T09:00:00Z'),

  -- Internet: Rogers $95 (20th)
  ('tx_net_02', 'acc_td_chq', '2026-02-20',  -9500, 'ROGERS INTERNET', 'm_rogers', 'cat_internet', 'h_net_02', 'csv', '2026-02-20T09:00:00Z'),
  ('tx_net_03', 'acc_td_chq', '2026-03-20',  -9500, 'ROGERS INTERNET', 'm_rogers', 'cat_internet', 'h_net_03', 'csv', '2026-03-20T09:00:00Z'),
  ('tx_net_04', 'acc_td_chq', '2026-04-21',  -9500, 'ROGERS INTERNET', 'm_rogers', 'cat_internet', 'h_net_04', 'csv', '2026-04-21T09:00:00Z'),

  -- Tenant insurance: Intact $52/mo (5th)
  ('tx_ins_02', 'acc_td_chq', '2026-02-05',  -5200, 'INTACT INSURANCE', 'm_intact', 'cat_insurance', 'h_ins_02', 'csv', '2026-02-05T09:00:00Z'),
  ('tx_ins_03', 'acc_td_chq', '2026-03-05',  -5200, 'INTACT INSURANCE', 'm_intact', 'cat_insurance', 'h_ins_03', 'csv', '2026-03-05T09:00:00Z'),
  ('tx_ins_04', 'acc_td_chq', '2026-04-06',  -5200, 'INTACT INSURANCE', 'm_intact', 'cat_insurance', 'h_ins_04', 'csv', '2026-04-06T09:00:00Z'),
  ('tx_ins_05', 'acc_td_chq', '2026-05-05',  -5200, 'INTACT INSURANCE', 'm_intact', 'cat_insurance', 'h_ins_05', 'csv', '2026-05-05T09:00:00Z'),

  -- TTC PRESTO monthly pass $156 (1st)
  ('tx_presto_03','acc_td_chq', '2026-03-01', -15600, 'PRESTO TTC PASS', 'm_presto', 'cat_transit', 'h_presto_03', 'csv', '2026-03-01T07:00:00Z'),
  ('tx_presto_04','acc_td_chq', '2026-04-01', -15600, 'PRESTO TTC PASS', 'm_presto', 'cat_transit', 'h_presto_04', 'csv', '2026-04-01T07:00:00Z'),
  ('tx_presto_05','acc_td_chq', '2026-05-01', -15600, 'PRESTO TTC PASS', 'm_presto', 'cat_transit', 'h_presto_05', 'csv', '2026-05-01T07:00:00Z'),

  -- GoodLife $59.99 monthly (7th)
  ('tx_gym_02', 'acc_td_chq', '2026-02-07',  -5999, 'GOODLIFE FITNESS', 'm_goodlife', 'cat_fitness', 'h_gym_02', 'csv', '2026-02-07T07:00:00Z'),
  ('tx_gym_03', 'acc_td_chq', '2026-03-07',  -5999, 'GOODLIFE FITNESS', 'm_goodlife', 'cat_fitness', 'h_gym_03', 'csv', '2026-03-07T07:00:00Z'),
  ('tx_gym_04', 'acc_td_chq', '2026-04-07',  -5999, 'GOODLIFE FITNESS', 'm_goodlife', 'cat_fitness', 'h_gym_04', 'csv', '2026-04-07T07:00:00Z'),
  ('tx_gym_05', 'acc_td_chq', '2026-05-07',  -5999, 'GOODLIFE FITNESS', 'm_goodlife', 'cat_fitness', 'h_gym_05', 'csv', '2026-05-07T07:00:00Z'),

  -- CC payments from chequing (TD Visa 22nd, Capital One 25th)
  ('tx_ccp_v_02','acc_td_chq', '2026-02-22', -15000, 'TD VISA PAYMENT',     'm_td_visa','cat_cc_payment','h_ccp_v_02','csv','2026-02-22T09:00:00Z'),
  ('tx_ccp_v_03','acc_td_chq', '2026-03-22', -16000, 'TD VISA PAYMENT',     'm_td_visa','cat_cc_payment','h_ccp_v_03','csv','2026-03-22T09:00:00Z'),
  ('tx_ccp_v_04','acc_td_chq', '2026-04-22', -18000, 'TD VISA PAYMENT',     'm_td_visa','cat_cc_payment','h_ccp_v_04','csv','2026-04-22T09:00:00Z'),
  ('tx_ccp_v_05','acc_td_chq', '2026-05-12', -17500, 'TD VISA PAYMENT',     'm_td_visa','cat_cc_payment','h_ccp_v_05','csv','2026-05-12T09:00:00Z'),
  ('tx_ccp_c_02','acc_td_chq', '2026-02-25',  -7500, 'CAPITAL ONE PAYMENT', 'm_capone', 'cat_cc_payment','h_ccp_c_02','csv','2026-02-25T09:00:00Z'),
  ('tx_ccp_c_03','acc_td_chq', '2026-03-25',  -8000, 'CAPITAL ONE PAYMENT', 'm_capone', 'cat_cc_payment','h_ccp_c_03','csv','2026-03-25T09:00:00Z'),
  ('tx_ccp_c_04','acc_td_chq', '2026-04-27',  -9000, 'CAPITAL ONE PAYMENT', 'm_capone', 'cat_cc_payment','h_ccp_c_04','csv','2026-04-27T09:00:00Z'),

  -- Savings transfers each payday
  ('tx_sav_01', 'acc_td_chq', '2026-02-13', -20000, 'TFR TO SAVINGS', NULL, 'cat_transfer', 'h_sav_01', 'csv', '2026-02-13T10:30:00Z'),
  ('tx_sav_02', 'acc_td_chq', '2026-02-27', -20000, 'TFR TO SAVINGS', NULL, 'cat_transfer', 'h_sav_02', 'csv', '2026-02-27T10:30:00Z'),
  ('tx_sav_03', 'acc_td_chq', '2026-03-13', -25000, 'TFR TO SAVINGS', NULL, 'cat_transfer', 'h_sav_03', 'csv', '2026-03-13T10:30:00Z'),
  ('tx_sav_04', 'acc_td_chq', '2026-03-27', -25000, 'TFR TO SAVINGS', NULL, 'cat_transfer', 'h_sav_04', 'csv', '2026-03-27T10:30:00Z'),
  ('tx_sav_05', 'acc_td_chq', '2026-04-10', -30000, 'TFR TO SAVINGS', NULL, 'cat_transfer', 'h_sav_05', 'csv', '2026-04-10T10:30:00Z'),
  ('tx_sav_06', 'acc_td_chq', '2026-04-24', -30000, 'TFR TO SAVINGS', NULL, 'cat_transfer', 'h_sav_06', 'csv', '2026-04-24T10:30:00Z'),
  ('tx_sav_07', 'acc_td_chq', '2026-05-08', -35000, 'TFR TO SAVINGS', NULL, 'cat_transfer', 'h_sav_07', 'csv', '2026-05-08T10:30:00Z');

-- ===== TD Visa: groceries, dining, indulgence, shopping =====
INSERT OR REPLACE INTO transactions (id, account_id, posted_at, amount_cents, description_raw, merchant_id, category_id, dedup_hash, source, created_at) VALUES
  -- Groceries (weekly mix of Loblaws, No Frills, Metro, Costco)
  ('tx_v_g01','acc_td_visa','2026-02-15',-11240,'LOBLAWS QUEEN ST',   'm_loblaws',  'cat_groceries','h_v_g01','csv','2026-02-15T13:00:00Z'),
  ('tx_v_g02','acc_td_visa','2026-02-22', -7820,'NO FRILLS DUFFERIN', 'm_nofrills', 'cat_groceries','h_v_g02','csv','2026-02-22T14:00:00Z'),
  ('tx_v_g03','acc_td_visa','2026-03-01', -9890,'METRO COLLEGE',      'm_metro',    'cat_groceries','h_v_g03','csv','2026-03-01T11:30:00Z'),
  ('tx_v_g04','acc_td_visa','2026-03-08',-12480,'LOBLAWS QUEEN ST',   'm_loblaws',  'cat_groceries','h_v_g04','csv','2026-03-08T13:00:00Z'),
  ('tx_v_g05','acc_td_visa','2026-03-14',-19840,'COSTCO ETOBICOKE',   'm_costco',   'cat_groceries','h_v_g05','csv','2026-03-14T15:00:00Z'),
  ('tx_v_g06','acc_td_visa','2026-03-22', -8420,'NO FRILLS DUFFERIN', 'm_nofrills', 'cat_groceries','h_v_g06','csv','2026-03-22T14:00:00Z'),
  ('tx_v_g07','acc_td_visa','2026-03-29',-10760,'METRO COLLEGE',      'm_metro',    'cat_groceries','h_v_g07','csv','2026-03-29T11:30:00Z'),
  ('tx_v_g08','acc_td_visa','2026-04-05',-13120,'LOBLAWS QUEEN ST',   'm_loblaws',  'cat_groceries','h_v_g08','csv','2026-04-05T13:00:00Z'),
  ('tx_v_g09','acc_td_visa','2026-04-12', -8980,'NO FRILLS DUFFERIN', 'm_nofrills', 'cat_groceries','h_v_g09','csv','2026-04-12T14:00:00Z'),
  ('tx_v_g10','acc_td_visa','2026-04-19',-11450,'METRO COLLEGE',      'm_metro',    'cat_groceries','h_v_g10','csv','2026-04-19T11:30:00Z'),
  ('tx_v_g11','acc_td_visa','2026-04-26',-21560,'COSTCO ETOBICOKE',   'm_costco',   'cat_groceries','h_v_g11','csv','2026-04-26T15:00:00Z'),
  ('tx_v_g12','acc_td_visa','2026-05-03',-12380,'LOBLAWS QUEEN ST',   'm_loblaws',  'cat_groceries','h_v_g12','csv','2026-05-03T13:00:00Z'),
  ('tx_v_g13','acc_td_visa','2026-05-10', -9420,'NO FRILLS DUFFERIN', 'm_nofrills', 'cat_groceries','h_v_g13','csv','2026-05-10T14:00:00Z'),
  ('tx_v_g14','acc_td_visa','2026-05-14',-10840,'METRO COLLEGE',      'm_metro',    'cat_groceries','h_v_g14','csv','2026-05-14T11:30:00Z'),

  -- Coffee (Tim Hortons + Starbucks; multiple per week)
  ('tx_v_co01','acc_td_visa','2026-02-16',  -680,'TIM HORTONS COLLEGE', 'm_tim',      'cat_fastfood','h_v_co01','csv','2026-02-16T08:30:00Z'),
  ('tx_v_co02','acc_td_visa','2026-02-19',  -845,'STARBUCKS BAY',       'm_starbucks','cat_fastfood','h_v_co02','csv','2026-02-19T09:00:00Z'),
  ('tx_v_co03','acc_td_visa','2026-02-23',  -625,'TIM HORTONS COLLEGE', 'm_tim',      'cat_fastfood','h_v_co03','csv','2026-02-23T08:30:00Z'),
  ('tx_v_co04','acc_td_visa','2026-02-26',  -895,'STARBUCKS BAY',       'm_starbucks','cat_fastfood','h_v_co04','csv','2026-02-26T09:00:00Z'),
  ('tx_v_co05','acc_td_visa','2026-03-02',  -680,'TIM HORTONS COLLEGE', 'm_tim',      'cat_fastfood','h_v_co05','csv','2026-03-02T08:30:00Z'),
  ('tx_v_co06','acc_td_visa','2026-03-05',  -780,'STARBUCKS BAY',       'm_starbucks','cat_fastfood','h_v_co06','csv','2026-03-05T09:00:00Z'),
  ('tx_v_co07','acc_td_visa','2026-03-09',  -650,'TIM HORTONS COLLEGE', 'm_tim',      'cat_fastfood','h_v_co07','csv','2026-03-09T08:30:00Z'),
  ('tx_v_co08','acc_td_visa','2026-03-13',  -845,'STARBUCKS BAY',       'm_starbucks','cat_fastfood','h_v_co08','csv','2026-03-13T09:00:00Z'),
  ('tx_v_co09','acc_td_visa','2026-03-16',  -625,'TIM HORTONS COLLEGE', 'm_tim',      'cat_fastfood','h_v_co09','csv','2026-03-16T08:30:00Z'),
  ('tx_v_co10','acc_td_visa','2026-03-23',  -780,'STARBUCKS BAY',       'm_starbucks','cat_fastfood','h_v_co10','csv','2026-03-23T09:00:00Z'),
  ('tx_v_co11','acc_td_visa','2026-03-30',  -680,'TIM HORTONS COLLEGE', 'm_tim',      'cat_fastfood','h_v_co11','csv','2026-03-30T08:30:00Z'),
  ('tx_v_co12','acc_td_visa','2026-04-03',  -895,'STARBUCKS BAY',       'm_starbucks','cat_fastfood','h_v_co12','csv','2026-04-03T09:00:00Z'),
  ('tx_v_co13','acc_td_visa','2026-04-06',  -650,'TIM HORTONS COLLEGE', 'm_tim',      'cat_fastfood','h_v_co13','csv','2026-04-06T08:30:00Z'),
  ('tx_v_co14','acc_td_visa','2026-04-13',  -845,'STARBUCKS BAY',       'm_starbucks','cat_fastfood','h_v_co14','csv','2026-04-13T09:00:00Z'),
  ('tx_v_co15','acc_td_visa','2026-04-20',  -680,'TIM HORTONS COLLEGE', 'm_tim',      'cat_fastfood','h_v_co15','csv','2026-04-20T08:30:00Z'),
  ('tx_v_co16','acc_td_visa','2026-04-27',  -895,'STARBUCKS BAY',       'm_starbucks','cat_fastfood','h_v_co16','csv','2026-04-27T09:00:00Z'),
  ('tx_v_co17','acc_td_visa','2026-05-04',  -680,'TIM HORTONS COLLEGE', 'm_tim',      'cat_fastfood','h_v_co17','csv','2026-05-04T08:30:00Z'),
  ('tx_v_co18','acc_td_visa','2026-05-08',  -845,'STARBUCKS BAY',       'm_starbucks','cat_fastfood','h_v_co18','csv','2026-05-08T09:00:00Z'),
  ('tx_v_co19','acc_td_visa','2026-05-12',  -625,'TIM HORTONS COLLEGE', 'm_tim',      'cat_fastfood','h_v_co19','csv','2026-05-12T08:30:00Z'),

  -- Fast food / takeout
  ('tx_v_ff01','acc_td_visa','2026-02-17', -1395,'MCDONALDS BLOOR',    'm_mcd',       'cat_fastfood','h_v_ff01','csv','2026-02-17T13:00:00Z'),
  ('tx_v_ff02','acc_td_visa','2026-02-24', -2480,'PIZZAIOLO COLLEGE',  'm_pizzaiolo', 'cat_fastfood','h_v_ff02','csv','2026-02-24T20:00:00Z'),
  ('tx_v_ff03','acc_td_visa','2026-03-03', -1620,'MCDONALDS BLOOR',    'm_mcd',       'cat_fastfood','h_v_ff03','csv','2026-03-03T13:00:00Z'),
  ('tx_v_ff04','acc_td_visa','2026-03-10', -2890,'PIZZAIOLO COLLEGE',  'm_pizzaiolo', 'cat_fastfood','h_v_ff04','csv','2026-03-10T20:00:00Z'),
  ('tx_v_ff05','acc_td_visa','2026-03-17', -1450,'MCDONALDS BLOOR',    'm_mcd',       'cat_fastfood','h_v_ff05','csv','2026-03-17T13:00:00Z'),
  ('tx_v_ff06','acc_td_visa','2026-03-24', -2640,'PIZZAIOLO COLLEGE',  'm_pizzaiolo', 'cat_fastfood','h_v_ff06','csv','2026-03-24T20:00:00Z'),
  ('tx_v_ff07','acc_td_visa','2026-04-01', -1820,'MCDONALDS BLOOR',    'm_mcd',       'cat_fastfood','h_v_ff07','csv','2026-04-01T13:00:00Z'),
  ('tx_v_ff08','acc_td_visa','2026-04-08', -2950,'PIZZAIOLO COLLEGE',  'm_pizzaiolo', 'cat_fastfood','h_v_ff08','csv','2026-04-08T20:00:00Z'),
  ('tx_v_ff09','acc_td_visa','2026-04-14', -1390,'MCDONALDS BLOOR',    'm_mcd',       'cat_fastfood','h_v_ff09','csv','2026-04-14T13:00:00Z'),
  ('tx_v_ff10','acc_td_visa','2026-04-22', -2780,'PIZZAIOLO COLLEGE',  'm_pizzaiolo', 'cat_fastfood','h_v_ff10','csv','2026-04-22T20:00:00Z'),
  ('tx_v_ff11','acc_td_visa','2026-04-29', -1545,'MCDONALDS BLOOR',    'm_mcd',       'cat_fastfood','h_v_ff11','csv','2026-04-29T13:00:00Z'),
  ('tx_v_ff12','acc_td_visa','2026-05-06', -2920,'PIZZAIOLO COLLEGE',  'm_pizzaiolo', 'cat_fastfood','h_v_ff12','csv','2026-05-06T20:00:00Z'),
  ('tx_v_ff13','acc_td_visa','2026-05-13', -1680,'MCDONALDS BLOOR',    'm_mcd',       'cat_fastfood','h_v_ff13','csv','2026-05-13T13:00:00Z'),

  -- Dining out (lifestyle)
  ('tx_v_dn01','acc_td_visa','2026-02-20', -2680,'BANH MI BOYS QUEEN', 'm_banhmi',     'cat_dining','h_v_dn01','csv','2026-02-20T19:30:00Z'),
  ('tx_v_dn02','acc_td_visa','2026-03-06', -7240,'PAI NORTHERN THAI',  'm_pai',        'cat_dining','h_v_dn02','csv','2026-03-06T20:00:00Z'),
  ('tx_v_dn03','acc_td_visa','2026-03-21', -4680,'LADY MARMALADE',     'm_ladymarm',   'cat_dining','h_v_dn03','csv','2026-03-21T11:30:00Z'),
  ('tx_v_dn04','acc_td_visa','2026-04-04', -8420,'BAR RAVAL',          'm_barraval',   'cat_dining','h_v_dn04','csv','2026-04-04T21:00:00Z'),
  ('tx_v_dn05','acc_td_visa','2026-04-18', -3120,'BANH MI BOYS QUEEN', 'm_banhmi',     'cat_dining','h_v_dn05','csv','2026-04-18T19:30:00Z'),
  ('tx_v_dn06','acc_td_visa','2026-05-02', -6840,'PAI NORTHERN THAI',  'm_pai',        'cat_dining','h_v_dn06','csv','2026-05-02T20:00:00Z'),
  ('tx_v_dn07','acc_td_visa','2026-05-09', -5240,'GOLDEN TURTLE',      'm_goldenturtle','cat_dining','h_v_dn07','csv','2026-05-09T19:00:00Z'),

  -- Uber Eats (dining)
  ('tx_v_ue01','acc_td_visa','2026-02-21', -3850,'UBER EATS TORONTO', 'm_uber','cat_dining','h_v_ue01','csv','2026-02-21T20:00:00Z'),
  ('tx_v_ue02','acc_td_visa','2026-03-07', -4220,'UBER EATS TORONTO', 'm_uber','cat_dining','h_v_ue02','csv','2026-03-07T20:00:00Z'),
  ('tx_v_ue03','acc_td_visa','2026-03-19', -3680,'UBER EATS TORONTO', 'm_uber','cat_dining','h_v_ue03','csv','2026-03-19T20:00:00Z'),
  ('tx_v_ue04','acc_td_visa','2026-04-02', -4540,'UBER EATS TORONTO', 'm_uber','cat_dining','h_v_ue04','csv','2026-04-02T20:00:00Z'),
  ('tx_v_ue05','acc_td_visa','2026-04-15', -3920,'UBER EATS TORONTO', 'm_uber','cat_dining','h_v_ue05','csv','2026-04-15T20:00:00Z'),
  ('tx_v_ue06','acc_td_visa','2026-04-30', -4180,'UBER EATS TORONTO', 'm_uber','cat_dining','h_v_ue06','csv','2026-04-30T20:00:00Z'),
  ('tx_v_ue07','acc_td_visa','2026-05-11', -3760,'UBER EATS TORONTO', 'm_uber','cat_dining','h_v_ue07','csv','2026-05-11T20:00:00Z'),

  -- Alcohol (indulgence)
  ('tx_v_al01','acc_td_visa','2026-02-21', -5240,'LCBO QUEEN W',       'm_lcbo','cat_alcohol','h_v_al01','csv','2026-02-21T19:00:00Z'),
  ('tx_v_al02','acc_td_visa','2026-02-28', -6120,'THE BEER STORE',     'm_beer','cat_alcohol','h_v_al02','csv','2026-02-28T19:00:00Z'),
  ('tx_v_al03','acc_td_visa','2026-03-07', -4860,'LCBO QUEEN W',       'm_lcbo','cat_alcohol','h_v_al03','csv','2026-03-07T19:00:00Z'),
  ('tx_v_al04','acc_td_visa','2026-03-14', -7240,'LCBO QUEEN W',       'm_lcbo','cat_alcohol','h_v_al04','csv','2026-03-14T19:00:00Z'),
  ('tx_v_al05','acc_td_visa','2026-03-21', -5640,'THE BEER STORE',     'm_beer','cat_alcohol','h_v_al05','csv','2026-03-21T19:00:00Z'),
  ('tx_v_al06','acc_td_visa','2026-03-28', -6820,'LCBO QUEEN W',       'm_lcbo','cat_alcohol','h_v_al06','csv','2026-03-28T19:00:00Z'),
  ('tx_v_al07','acc_td_visa','2026-04-04', -5240,'LCBO QUEEN W',       'm_lcbo','cat_alcohol','h_v_al07','csv','2026-04-04T19:00:00Z'),
  ('tx_v_al08','acc_td_visa','2026-04-11', -7480,'LCBO QUEEN W',       'm_lcbo','cat_alcohol','h_v_al08','csv','2026-04-11T19:00:00Z'),
  ('tx_v_al09','acc_td_visa','2026-04-18', -5860,'THE BEER STORE',     'm_beer','cat_alcohol','h_v_al09','csv','2026-04-18T19:00:00Z'),
  ('tx_v_al10','acc_td_visa','2026-04-25', -6420,'LCBO QUEEN W',       'm_lcbo','cat_alcohol','h_v_al10','csv','2026-04-25T19:00:00Z'),
  ('tx_v_al11','acc_td_visa','2026-05-02', -5680,'LCBO QUEEN W',       'm_lcbo','cat_alcohol','h_v_al11','csv','2026-05-02T19:00:00Z'),
  ('tx_v_al12','acc_td_visa','2026-05-09', -7240,'LCBO QUEEN W',       'm_lcbo','cat_alcohol','h_v_al12','csv','2026-05-09T19:00:00Z'),

  -- Cannabis (indulgence) — Tokyo Smoke weekly-ish
  ('tx_v_cn01','acc_td_visa','2026-02-19', -5440,'TOKYO SMOKE QUEEN',  'm_tokyosmoke','cat_cannabis','h_v_cn01','csv','2026-02-19T20:30:00Z'),
  ('tx_v_cn02','acc_td_visa','2026-02-26', -4820,'TOKYO SMOKE QUEEN',  'm_tokyosmoke','cat_cannabis','h_v_cn02','csv','2026-02-26T20:30:00Z'),
  ('tx_v_cn03','acc_td_visa','2026-03-05', -6240,'TOKYO SMOKE QUEEN',  'm_tokyosmoke','cat_cannabis','h_v_cn03','csv','2026-03-05T20:30:00Z'),
  ('tx_v_cn04','acc_td_visa','2026-03-12', -5180,'TOKYO SMOKE QUEEN',  'm_tokyosmoke','cat_cannabis','h_v_cn04','csv','2026-03-12T20:30:00Z'),
  ('tx_v_cn05','acc_td_visa','2026-03-19', -4640,'TOKYO SMOKE QUEEN',  'm_tokyosmoke','cat_cannabis','h_v_cn05','csv','2026-03-19T20:30:00Z'),
  ('tx_v_cn06','acc_td_visa','2026-03-26', -5860,'TOKYO SMOKE QUEEN',  'm_tokyosmoke','cat_cannabis','h_v_cn06','csv','2026-03-26T20:30:00Z'),
  ('tx_v_cn07','acc_td_visa','2026-04-02', -5240,'TOKYO SMOKE QUEEN',  'm_tokyosmoke','cat_cannabis','h_v_cn07','csv','2026-04-02T20:30:00Z'),
  ('tx_v_cn08','acc_td_visa','2026-04-09', -4480,'TOKYO SMOKE QUEEN',  'm_tokyosmoke','cat_cannabis','h_v_cn08','csv','2026-04-09T20:30:00Z'),
  ('tx_v_cn09','acc_td_visa','2026-04-16', -5680,'TOKYO SMOKE QUEEN',  'm_tokyosmoke','cat_cannabis','h_v_cn09','csv','2026-04-16T20:30:00Z'),
  ('tx_v_cn10','acc_td_visa','2026-04-23', -6240,'TOKYO SMOKE QUEEN',  'm_tokyosmoke','cat_cannabis','h_v_cn10','csv','2026-04-23T20:30:00Z'),
  ('tx_v_cn11','acc_td_visa','2026-04-30', -4860,'TOKYO SMOKE QUEEN',  'm_tokyosmoke','cat_cannabis','h_v_cn11','csv','2026-04-30T20:30:00Z'),
  ('tx_v_cn12','acc_td_visa','2026-05-07', -5340,'TOKYO SMOKE QUEEN',  'm_tokyosmoke','cat_cannabis','h_v_cn12','csv','2026-05-07T20:30:00Z'),
  ('tx_v_cn13','acc_td_visa','2026-05-14', -5980,'TOKYO SMOKE QUEEN',  'm_tokyosmoke','cat_cannabis','h_v_cn13','csv','2026-05-14T20:30:00Z'),

  -- Subscriptions
  ('tx_v_nf02','acc_td_visa','2026-02-08', -1999,'NETFLIX.COM',     'm_netflix','cat_subscriptions','h_v_nf02','csv','2026-02-08T05:00:00Z'),
  ('tx_v_nf03','acc_td_visa','2026-03-08', -1999,'NETFLIX.COM',     'm_netflix','cat_subscriptions','h_v_nf03','csv','2026-03-08T05:00:00Z'),
  ('tx_v_nf04','acc_td_visa','2026-04-08', -1999,'NETFLIX.COM',     'm_netflix','cat_subscriptions','h_v_nf04','csv','2026-04-08T05:00:00Z'),
  ('tx_v_nf05','acc_td_visa','2026-05-08', -1999,'NETFLIX.COM',     'm_netflix','cat_subscriptions','h_v_nf05','csv','2026-05-08T05:00:00Z'),
  ('tx_v_sp02','acc_td_visa','2026-02-11', -1299,'SPOTIFY CANADA',  'm_spotify','cat_subscriptions','h_v_sp02','csv','2026-02-11T05:00:00Z'),
  ('tx_v_sp03','acc_td_visa','2026-03-11', -1299,'SPOTIFY CANADA',  'm_spotify','cat_subscriptions','h_v_sp03','csv','2026-03-11T05:00:00Z'),
  ('tx_v_sp04','acc_td_visa','2026-04-11', -1299,'SPOTIFY CANADA',  'm_spotify','cat_subscriptions','h_v_sp04','csv','2026-04-11T05:00:00Z'),
  ('tx_v_sp05','acc_td_visa','2026-05-11', -1299,'SPOTIFY CANADA',  'm_spotify','cat_subscriptions','h_v_sp05','csv','2026-05-11T05:00:00Z'),
  ('tx_v_ap02','acc_td_visa','2026-02-18',  -599,'APPLE.COM/BILL',  'm_apple',  'cat_subscriptions','h_v_ap02','csv','2026-02-18T05:00:00Z'),
  ('tx_v_ap03','acc_td_visa','2026-03-18',  -599,'APPLE.COM/BILL',  'm_apple',  'cat_subscriptions','h_v_ap03','csv','2026-03-18T05:00:00Z'),
  ('tx_v_ap04','acc_td_visa','2026-04-18',  -599,'APPLE.COM/BILL',  'm_apple',  'cat_subscriptions','h_v_ap04','csv','2026-04-18T05:00:00Z'),
  ('tx_v_ap05','acc_td_visa','2026-05-13', -1299,'APPLE.COM/BILL',  'm_apple',  'cat_subscriptions','h_v_ap05','csv','2026-05-13T05:00:00Z'),

  -- Shopping (lifestyle)
  ('tx_v_sh01','acc_td_visa','2026-02-25', -4280,'AMAZON.CA',          'm_amazon',      'cat_shopping','h_v_sh01','csv','2026-02-25T14:00:00Z'),
  ('tx_v_sh02','acc_td_visa','2026-03-15', -3680,'INDIGO YORKDALE',    'm_indigo',      'cat_shopping','h_v_sh02','csv','2026-03-15T17:00:00Z'),
  ('tx_v_sh03','acc_td_visa','2026-03-29', -8920,'AMAZON.CA',          'm_amazon',      'cat_shopping','h_v_sh03','csv','2026-03-29T14:00:00Z'),
  ('tx_v_sh04','acc_td_visa','2026-04-12', -6450,'CANADIAN TIRE LESLIEVILLE','m_canadiantire','cat_shopping','h_v_sh04','csv','2026-04-12T15:00:00Z'),
  ('tx_v_sh05','acc_td_visa','2026-04-25', -5180,'AMAZON.CA',          'm_amazon',      'cat_shopping','h_v_sh05','csv','2026-04-25T14:00:00Z'),
  ('tx_v_sh06','acc_td_visa','2026-05-09', -4220,'INDIGO YORKDALE',    'm_indigo',      'cat_shopping','h_v_sh06','csv','2026-05-09T17:00:00Z'),

  -- Shoppers Drug Mart (medical / essentials)
  ('tx_v_sd01','acc_td_visa','2026-02-27', -2840,'SHOPPERS DRUG MART', 'm_shoppers','cat_medical','h_v_sd01','csv','2026-02-27T16:00:00Z'),
  ('tx_v_sd02','acc_td_visa','2026-03-25', -3260,'SHOPPERS DRUG MART', 'm_shoppers','cat_medical','h_v_sd02','csv','2026-03-25T16:00:00Z'),
  ('tx_v_sd03','acc_td_visa','2026-04-24', -4180,'SHOPPERS DRUG MART', 'm_shoppers','cat_medical','h_v_sd03','csv','2026-04-24T16:00:00Z'),
  ('tx_v_sd04','acc_td_visa','2026-05-13', -2940,'SHOPPERS DRUG MART', 'm_shoppers','cat_medical','h_v_sd04','csv','2026-05-13T16:00:00Z');

-- ===== Capital One: smaller indulgence + dining mix =====
INSERT OR REPLACE INTO transactions (id, account_id, posted_at, amount_cents, description_raw, merchant_id, category_id, dedup_hash, source, created_at) VALUES
  ('tx_c_al01','acc_capone','2026-02-22', -4280,'LCBO YONGE',          'm_lcbo',      'cat_alcohol','h_c_al01','csv','2026-02-22T19:00:00Z'),
  ('tx_c_al02','acc_capone','2026-03-15', -3940,'LCBO YONGE',          'm_lcbo',      'cat_alcohol','h_c_al02','csv','2026-03-15T19:00:00Z'),
  ('tx_c_al03','acc_capone','2026-04-12', -4620,'LCBO YONGE',          'm_lcbo',      'cat_alcohol','h_c_al03','csv','2026-04-12T19:00:00Z'),
  ('tx_c_al04','acc_capone','2026-05-04', -4180,'LCBO YONGE',          'm_lcbo',      'cat_alcohol','h_c_al04','csv','2026-05-04T19:00:00Z'),
  ('tx_c_cn01','acc_capone','2026-03-08', -4860,'TOKYO SMOKE BLOOR',   'm_tokyosmoke','cat_cannabis','h_c_cn01','csv','2026-03-08T20:30:00Z'),
  ('tx_c_cn02','acc_capone','2026-04-19', -5240,'TOKYO SMOKE BLOOR',   'm_tokyosmoke','cat_cannabis','h_c_cn02','csv','2026-04-19T20:30:00Z'),
  ('tx_c_cn03','acc_capone','2026-05-10', -4980,'TOKYO SMOKE BLOOR',   'm_tokyosmoke','cat_cannabis','h_c_cn03','csv','2026-05-10T20:30:00Z'),
  ('tx_c_dn01','acc_capone','2026-03-21', -3680,'BANH MI BOYS QUEEN',  'm_banhmi',    'cat_dining',  'h_c_dn01','csv','2026-03-21T19:30:00Z'),
  ('tx_c_dn02','acc_capone','2026-04-11', -2840,'BANH MI BOYS QUEEN',  'm_banhmi',    'cat_dining',  'h_c_dn02','csv','2026-04-11T19:30:00Z'),
  ('tx_c_dn03','acc_capone','2026-05-09', -3120,'BANH MI BOYS QUEEN',  'm_banhmi',    'cat_dining',  'h_c_dn03','csv','2026-05-09T19:30:00Z'),
  -- Unresolved row (review queue test)
  ('tx_c_mys01','acc_capone','2026-05-07', -3240,'SQ *MYSTERY CAFE',   NULL,          NULL,          'h_c_mys01','csv','2026-05-07T14:00:00Z');

-- ===== Savings credits (mirror of chequing transfers) =====
INSERT OR REPLACE INTO transactions (id, account_id, posted_at, amount_cents, description_raw, merchant_id, category_id, dedup_hash, source, created_at) VALUES
  ('tx_sv_01','acc_td_sav','2026-02-13', 20000,'TFR FROM CHEQUING',NULL,'cat_transfer','h_sv_01','csv','2026-02-13T10:30:00Z'),
  ('tx_sv_02','acc_td_sav','2026-02-27', 20000,'TFR FROM CHEQUING',NULL,'cat_transfer','h_sv_02','csv','2026-02-27T10:30:00Z'),
  ('tx_sv_03','acc_td_sav','2026-03-13', 25000,'TFR FROM CHEQUING',NULL,'cat_transfer','h_sv_03','csv','2026-03-13T10:30:00Z'),
  ('tx_sv_04','acc_td_sav','2026-03-27', 25000,'TFR FROM CHEQUING',NULL,'cat_transfer','h_sv_04','csv','2026-03-27T10:30:00Z'),
  ('tx_sv_05','acc_td_sav','2026-04-10', 30000,'TFR FROM CHEQUING',NULL,'cat_transfer','h_sv_05','csv','2026-04-10T10:30:00Z'),
  ('tx_sv_06','acc_td_sav','2026-04-24', 30000,'TFR FROM CHEQUING',NULL,'cat_transfer','h_sv_06','csv','2026-04-24T10:30:00Z'),
  ('tx_sv_07','acc_td_sav','2026-05-08', 35000,'TFR FROM CHEQUING',NULL,'cat_transfer','h_sv_07','csv','2026-05-08T10:30:00Z');

-- Review queue
DELETE FROM review_queue;
INSERT OR REPLACE INTO review_queue (id, transaction_id, reason, resolved_at) VALUES
  ('rq_mys01', 'tx_c_mys01', 'uncategorized', NULL);

-- Debts
INSERT OR REPLACE INTO debts (id, name, principal_cents, interest_rate_bps, min_payment_type, min_payment_value, statement_date, payment_due_date, account_id_linked, archived) VALUES
  ('debt_td_visa', 'TD Visa',          298000, 1999, 'percent', 300, 10, 3,  'acc_td_visa', 0),
  ('debt_capone',  'Capital One',      136500, 2499, 'fixed',  5000, 18, 11, 'acc_capone',  0),
  ('debt_bowgull', 'Bowgull (Mexico)', 110000, 0,    'fixed', 10000, 1,  1,  NULL,          0);

-- Debt payments mirror of CC payments
DELETE FROM debt_payments;
INSERT OR REPLACE INTO debt_payments (id, debt_id, transaction_id, amount_cents, posted_at) VALUES
  ('dp_v_02','debt_td_visa','tx_ccp_v_02',15000,'2026-02-22'),
  ('dp_v_03','debt_td_visa','tx_ccp_v_03',16000,'2026-03-22'),
  ('dp_v_04','debt_td_visa','tx_ccp_v_04',18000,'2026-04-22'),
  ('dp_v_05','debt_td_visa','tx_ccp_v_05',17500,'2026-05-12'),
  ('dp_c_02','debt_capone', 'tx_ccp_c_02', 7500,'2026-02-25'),
  ('dp_c_03','debt_capone', 'tx_ccp_c_03', 8000,'2026-03-25'),
  ('dp_c_04','debt_capone', 'tx_ccp_c_04', 9000,'2026-04-27');

-- Counterparties (open tabs with people). Toronto fictional folks + Bowgull.
INSERT OR REPLACE INTO counterparties (id, name, default_settlement_method, archived_at, created_at) VALUES
  ('cp_bowgull',  'Bowgull',       'etransfer', NULL, '2026-01-15T12:00:00Z'),
  ('cp_marcus',   'Marcus Chen',   'etransfer', NULL, '2026-05-09T12:00:00Z'),
  ('cp_priya',    'Priya Shah',    'etransfer', NULL, '2026-05-05T12:00:00Z'),
  ('cp_diego',    'Diego Alvarez', 'etransfer', NULL, '2026-05-11T12:00:00Z');

-- Bowgull (Mexico) split: original $1500, $400 settled, $1100 remaining
UPDATE splits SET original_cents = 150000, remaining_cents = 110000, counterparty_id = 'cp_bowgull'
WHERE id = 'split_bowgull_mexico';
DELETE FROM split_events WHERE split_id = 'split_bowgull_mexico';
INSERT OR REPLACE INTO split_events (id, split_id, delta_cents, transaction_id, note, created_at) VALUES
  ('se_bg_01','split_bowgull_mexico',-20000,NULL,'etransfer to Bowgull Feb','2026-02-20T12:00:00Z'),
  ('se_bg_02','split_bowgull_mexico',-10000,NULL,'etransfer to Bowgull Mar','2026-03-19T12:00:00Z'),
  ('se_bg_03','split_bowgull_mexico',-10000,NULL,'etransfer to Bowgull Apr','2026-04-21T12:00:00Z');

-- Open tabs (mid-May): Marcus owes you brunch, you owe Priya tapas, Diego owes you pho.
DELETE FROM splits WHERE id IN ('split_marcus_brunch','split_priya_tapas','split_diego_pho');
INSERT OR REPLACE INTO splits (id, counterparty_id, direction, original_cents, remaining_cents, reason, created_at, closed_at) VALUES
  ('split_marcus_brunch','cp_marcus','they_owe',4750,4750,'Lady Marmalade brunch','2026-05-09T15:30:00Z',NULL),
  ('split_priya_tapas',  'cp_priya', 'i_owe',   8200,8200,'Bar Raval tapas',      '2026-05-05T22:10:00Z',NULL),
  ('split_diego_pho',    'cp_diego', 'they_owe',3600,3600,'Golden Turtle dinner', '2026-05-11T20:45:00Z',NULL);

-- Credit snapshots (monthly trail, latest 2026-05-12)
DELETE FROM credit_snapshots;
INSERT OR REPLACE INTO credit_snapshots (id, as_of, score, utilization_bps, on_time_streak_days, source) VALUES
  ('cs_2026_05', '2026-05-12', 698, 4180, 89, 'manual'),
  ('cs_2026_04', '2026-04-12', 685, 4720, 58, 'manual'),
  ('cs_2026_03', '2026-03-12', 672, 5240, 27, 'manual');

-- Holdings (XIU + SPY in TFSA)
INSERT OR REPLACE INTO holdings (id, symbol, account_wrapper, units, avg_cost_cents, updated_at) VALUES
  ('hold_xiu', 'XIU.TO', 'tfsa', 500000, 3420, '2026-05-14T22:00:00Z'),
  ('hold_spy', 'SPY',    'tfsa', 80000,  52000,'2026-05-14T22:00:00Z');

-- Prices (latest close)
INSERT OR REPLACE INTO prices (symbol, date, close_cents, source) VALUES
  ('XIU.TO', '2026-05-14', 3742, 'seed'),
  ('SPY',    '2026-05-14', 59180,'seed');

-- Market snapshot
INSERT OR REPLACE INTO market_snapshots (id, as_of, boc_overnight_bps, cad_usd, tsx_close, sp500_close) VALUES
  ('ms_2026_05_14', '2026-05-14', 275, 7320, 2658000, 528400);

-- Phase log
DELETE FROM phase_log;
INSERT INTO phase_log (id, phase, entered_at, trigger_rule, metrics_json) VALUES
  ('pl_2026_02_15', 2, '2026-02-15T08:00:00Z', 'p1_to_p2:essentials_2p_and_cc_streak_1p',     '{}'),
  ('pl_2026_03_22', 3, '2026-03-22T08:00:00Z', 'p2_to_p3:debt_down_20pct_no_miss_60d',        '{}'),
  ('pl_2026_05_06', 4, '2026-05-06T23:00:00Z', 'p3_to_p4:util_under_30_x3_and_ontime_90d',    '{}');

-- Goals
INSERT OR REPLACE INTO goals (id, name, target_cents, target_date, linked_account_id, progress_cents, archived) VALUES
  ('goal_buffer',   'Cash buffer (1 month essentials)', 380000,  '2026-10-01', 'acc_td_sav', 165000, 0),
  ('goal_vacation', 'Vacation fund',                    150000,  '2026-12-15', 'acc_td_sav',  25000, 0);
