-- Test data seed for Declyne. Idempotent-ish: uses stable ids so re-running overwrites.
-- Anchored as if "today" is 2026-04-28 (Tuesday). Data runs Feb 13 → May 21 2026
-- so the recurring detector sees future-month payday + bill rows.
-- Scenario: Toronto, single, renting a 1-bed in Leslieville/Roncesvalles area.
--   Gross salary ~$82k at Northside Media Group.
--   Net biweekly after tax/CPP/EI: $2,700 (270,000 cents).
--   Carrying CC debt. Phase 2. 3 months of use. Finances are tight but improving.
-- WIRING NOTE: every CC payment from chequing has a matching positive receipt
-- row on the credit-card account. Every savings transfer is mirrored. Pay periods
-- and weekly period-closes are inserted directly so the Tank + reconciliation
-- history work without running /api/periods/detect after seeding.

-- Wipe transactional state so date-anchored data refreshes cleanly.
DELETE FROM period_allocations;
DELETE FROM cc_statement_snapshots;
DELETE FROM debt_payments;
DELETE FROM split_events;
DELETE FROM behaviour_snapshots;
DELETE FROM pay_periods;
DELETE FROM review_queue;
DELETE FROM journal_lines;
DELETE FROM journal_entries;
DELETE FROM period_close;
DELETE FROM transactions;
DELETE FROM debts;
-- Wipe counterparty GL accounts so backfill recreates them with current names.
-- Must null the FK first or D1 rejects the delete.
UPDATE counterparties SET account_id = NULL;
DELETE FROM gl_accounts WHERE id LIKE 'gla_cp_%';

-- Accounts
INSERT OR REPLACE INTO accounts (id, name, institution, type, currency, last_import_at, archived) VALUES
  ('acc_td_chq', 'TD Chequing', 'TD', 'chequing', 'CAD', '2026-05-14T22:00:00Z', 0),
  ('acc_td_sav', 'TD Savings', 'TD', 'savings', 'CAD', '2026-05-14T22:00:00Z', 0),
  ('acc_td_visa', 'TD Visa', 'TD', 'credit', 'CAD', '2026-05-14T22:00:00Z', 0),
  ('acc_capone', 'Capital One', 'Capital One', 'credit', 'CAD', '2026-05-14T22:00:00Z', 0);

-- Settings: realistic $82k Toronto profile, Phase 2
INSERT OR REPLACE INTO settings (key, value) VALUES
  ('paycheque_source_account_id', 'acc_td_chq'),
  ('paycheque_pattern', 'DIRECT DEP NORTHSIDE'),
  ('paycheque_min_cents', '150000'),
  ('paycheque_fallback_days', '14'),
  ('essentials_monthly_cents_manual', '230000'),
  ('current_phase', '2'),
  ('phase2_entry_non_mortgage_debt_cents', '420000'),
  ('last_reconciliation_at', '2026-04-26T10:30:00Z'),
  ('reconciliation_streak', '11'),
  ('vocabulary_level', '2'),
  ('user_display_name', 'Bowgull'),
  ('onboarding_completed', '1');

-- ===== Pay periods (biweekly, paycheque-anchored) =====
-- Period 6 (Apr 24 → May 7) is the CURRENT period as of today (Apr 28).
-- Period 7 (May 8 → May 21) is the next paycheque, surfaced in the queue.
INSERT OR REPLACE INTO pay_periods (id, start_date, end_date, paycheque_cents, source_account_id) VALUES
  ('pp_2026_02_13','2026-02-13','2026-02-26',270000,'acc_td_chq'),
  ('pp_2026_02_27','2026-02-27','2026-03-12',270000,'acc_td_chq'),
  ('pp_2026_03_13','2026-03-13','2026-03-26',270000,'acc_td_chq'),
  ('pp_2026_03_27','2026-03-27','2026-04-09',270000,'acc_td_chq'),
  ('pp_2026_04_10','2026-04-10','2026-04-23',270000,'acc_td_chq'),
  ('pp_2026_04_24','2026-04-24','2026-05-07',270000,'acc_td_chq'),
  ('pp_2026_05_08','2026-05-08','2026-05-21',270000,'acc_td_chq');

-- Merchants
INSERT OR REPLACE INTO merchants (id, display_name, normalized_key, category_default_id, verified) VALUES
  ('m_northside',   'Northside Media Group','northside media payroll', 'cat_paycheque',     1),
  ('m_landlord',    'Landlord',             'landlord rent',           'cat_rent',          1),
  ('m_nofrills',    'No Frills',            'no frills',               'cat_groceries',     1),
  ('m_metro',       'Metro',                'metro grocery',           'cat_groceries',     1),
  ('m_loblaws',     'Loblaws',              'loblaws',                 'cat_groceries',     1),
  ('m_shoppers',    'Shoppers Drug Mart',   'shoppers drug',           'cat_medical',       1),
  ('m_torontohydro','Toronto Hydro',        'toronto hydro',           'cat_utilities',     1),
  ('m_enbridge',    'Enbridge Gas',         'enbridge',                'cat_utilities',     1),
  ('m_bell',        'Bell Mobility',        'bell mobility',           'cat_phone',         1),
  ('m_rogers',      'Rogers',               'rogers internet',         'cat_internet',      1),
  ('m_intact',      'Intact Insurance',     'intact',                  'cat_insurance',     1),
  ('m_presto',      'PRESTO TTC',           'presto ttc',              'cat_transit',       1),
  ('m_goodlife',    'GoodLife Fitness',     'goodlife',                'cat_fitness',       1),
  ('m_netflix',     'Netflix',              'netflix',                 'cat_subscriptions', 1),
  ('m_spotify',     'Spotify',              'spotify',                 'cat_subscriptions', 1),
  ('m_apple',       'Apple iCloud',         'apple com bill',          'cat_subscriptions', 1),
  ('m_tim',         'Tim Hortons',          'tim hortons',             'cat_fastfood',      1),
  ('m_starbucks',   'Starbucks',            'starbucks',               'cat_fastfood',      1),
  ('m_mcd',         'McDonald''s',          'mcdonalds',               'cat_fastfood',      1),
  ('m_banhmi',      'Banh Mi Boys',         'banh mi boys',            'cat_dining',        1),
  ('m_goldenturtle','Golden Turtle',        'golden turtle',           'cat_dining',        1),
  ('m_pai',         'Pai Northern Thai',    'pai northern',            'cat_dining',        1),
  ('m_ladymarm',    'Lady Marmalade',       'lady marmalade',          'cat_dining',        1),
  ('m_barraval',    'Bar Raval',            'bar raval',               'cat_dining',        1),
  ('m_lcbo',        'LCBO',                 'lcbo',                    'cat_alcohol',       1),
  ('m_beer',        'The Beer Store',       'beer store',              'cat_alcohol',       1),
  ('m_tokyosmoke',  'Tokyo Smoke',          'tokyo smoke',             'cat_cannabis',      1),
  ('m_uber',        'Uber Eats',            'uber eats',               'cat_dining',        1),
  ('m_amazon',      'Amazon.ca',            'amazon',                  'cat_shopping',      1),
  ('m_valuev',      'Value Village',        'value village',           'cat_shopping',      1),
  ('m_td_visa',     'TD Visa Payment',      'td visa payment',         'cat_cc_payment',    1),
  ('m_capone',      'Capital One Payment',  'capone payment',          'cat_cc_payment',    1);

-- ===== Chequing: paycheques + bills + CC payments + savings transfers =====
-- Net biweekly $2,700 on ~$82k gross. Tight budget. Barely saving.
INSERT OR REPLACE INTO transactions (id, account_id, posted_at, amount_cents, description_raw, merchant_id, category_id, dedup_hash, source, created_at) VALUES

  -- Paycheques (biweekly Fri, $2,700 net after tax/CPP/EI on ~$82k gross)
  ('tx_pay_01','acc_td_chq','2026-02-13',270000,'DIRECT DEP NORTHSIDE MEDIA','m_northside','cat_paycheque','h_pay_01','csv','2026-02-13T10:00:00Z'),
  ('tx_pay_02','acc_td_chq','2026-02-27',270000,'DIRECT DEP NORTHSIDE MEDIA','m_northside','cat_paycheque','h_pay_02','csv','2026-02-27T10:00:00Z'),
  ('tx_pay_03','acc_td_chq','2026-03-13',270000,'DIRECT DEP NORTHSIDE MEDIA','m_northside','cat_paycheque','h_pay_03','csv','2026-03-13T10:00:00Z'),
  ('tx_pay_04','acc_td_chq','2026-03-27',270000,'DIRECT DEP NORTHSIDE MEDIA','m_northside','cat_paycheque','h_pay_04','csv','2026-03-27T10:00:00Z'),
  ('tx_pay_05','acc_td_chq','2026-04-10',270000,'DIRECT DEP NORTHSIDE MEDIA','m_northside','cat_paycheque','h_pay_05','csv','2026-04-10T10:00:00Z'),
  ('tx_pay_06','acc_td_chq','2026-04-24',270000,'DIRECT DEP NORTHSIDE MEDIA','m_northside','cat_paycheque','h_pay_06','csv','2026-04-24T10:00:00Z'),
  ('tx_pay_07','acc_td_chq','2026-05-08',270000,'DIRECT DEP NORTHSIDE MEDIA','m_northside','cat_paycheque','h_pay_07','csv','2026-05-08T10:00:00Z'),

  -- Rent: $1,650/mo 1-bed, Leslieville/Roncesvalles area (1st of month)
  ('tx_rent_03','acc_td_chq','2026-03-01',-165000,'LANDLORD EFT RENT','m_landlord','cat_rent','h_rent_03','csv','2026-03-01T09:00:00Z'),
  ('tx_rent_04','acc_td_chq','2026-04-01',-165000,'LANDLORD EFT RENT','m_landlord','cat_rent','h_rent_04','csv','2026-04-01T09:00:00Z'),
  ('tx_rent_05','acc_td_chq','2026-05-01',-165000,'LANDLORD EFT RENT','m_landlord','cat_rent','h_rent_05','csv','2026-05-01T09:00:00Z'),

  -- Toronto Hydro (electricity) 12th: smaller unit, Feb peak drops by May
  ('tx_hyd_02','acc_td_chq','2026-02-12',-10500,'TORONTO HYDRO','m_torontohydro','cat_utilities','h_hyd_02','csv','2026-02-12T09:00:00Z'),
  ('tx_hyd_03','acc_td_chq','2026-03-12', -9200,'TORONTO HYDRO','m_torontohydro','cat_utilities','h_hyd_03','csv','2026-03-12T09:00:00Z'),
  ('tx_hyd_04','acc_td_chq','2026-04-13', -7100,'TORONTO HYDRO','m_torontohydro','cat_utilities','h_hyd_04','csv','2026-04-13T09:00:00Z'),
  ('tx_hyd_05','acc_td_chq','2026-05-12', -5800,'TORONTO HYDRO','m_torontohydro','cat_utilities','h_hyd_05','csv','2026-05-12T09:00:00Z'),

  -- Enbridge (gas) 18th: heavy Feb, off by May (summer service charge only)
  ('tx_enb_02','acc_td_chq','2026-02-18',-11800,'ENBRIDGE GAS','m_enbridge','cat_utilities','h_enb_02','csv','2026-02-18T09:00:00Z'),
  ('tx_enb_03','acc_td_chq','2026-03-18', -8800,'ENBRIDGE GAS','m_enbridge','cat_utilities','h_enb_03','csv','2026-03-18T09:00:00Z'),
  ('tx_enb_04','acc_td_chq','2026-04-20', -4200,'ENBRIDGE GAS','m_enbridge','cat_utilities','h_enb_04','csv','2026-04-20T09:00:00Z'),
  ('tx_enb_05','acc_td_chq','2026-05-20', -2200,'ENBRIDGE GAS','m_enbridge','cat_utilities','h_enb_05','csv','2026-05-20T09:00:00Z'),

  -- Phone: Bell Mobility $65/mo (28th) — mid-tier plan
  ('tx_phone_02','acc_td_chq','2026-02-28',-6500,'BELL MOBILITY','m_bell','cat_phone','h_phone_02','csv','2026-02-28T09:00:00Z'),
  ('tx_phone_03','acc_td_chq','2026-03-28',-6500,'BELL MOBILITY','m_bell','cat_phone','h_phone_03','csv','2026-03-28T09:00:00Z'),
  ('tx_phone_04','acc_td_chq','2026-04-28',-6500,'BELL MOBILITY','m_bell','cat_phone','h_phone_04','csv','2026-04-28T09:00:00Z'),

  -- Internet: Rogers Ignite 150 $80/mo (20th)
  ('tx_net_02','acc_td_chq','2026-02-20',-8000,'ROGERS INTERNET','m_rogers','cat_internet','h_net_02','csv','2026-02-20T09:00:00Z'),
  ('tx_net_03','acc_td_chq','2026-03-20',-8000,'ROGERS INTERNET','m_rogers','cat_internet','h_net_03','csv','2026-03-20T09:00:00Z'),
  ('tx_net_04','acc_td_chq','2026-04-21',-8000,'ROGERS INTERNET','m_rogers','cat_internet','h_net_04','csv','2026-04-21T09:00:00Z'),

  -- Tenant insurance: Intact $32/mo (5th)
  ('tx_ins_02','acc_td_chq','2026-02-05',-3200,'INTACT INSURANCE','m_intact','cat_insurance','h_ins_02','csv','2026-02-05T09:00:00Z'),
  ('tx_ins_03','acc_td_chq','2026-03-05',-3200,'INTACT INSURANCE','m_intact','cat_insurance','h_ins_03','csv','2026-03-05T09:00:00Z'),
  ('tx_ins_04','acc_td_chq','2026-04-06',-3200,'INTACT INSURANCE','m_intact','cat_insurance','h_ins_04','csv','2026-04-06T09:00:00Z'),
  ('tx_ins_05','acc_td_chq','2026-05-05',-3200,'INTACT INSURANCE','m_intact','cat_insurance','h_ins_05','csv','2026-05-05T09:00:00Z'),

  -- TTC PRESTO monthly pass $156 (1st)
  ('tx_presto_03','acc_td_chq','2026-03-01',-15600,'PRESTO TTC PASS','m_presto','cat_transit','h_presto_03','csv','2026-03-01T07:00:00Z'),
  ('tx_presto_04','acc_td_chq','2026-04-01',-15600,'PRESTO TTC PASS','m_presto','cat_transit','h_presto_04','csv','2026-04-01T07:00:00Z'),
  ('tx_presto_05','acc_td_chq','2026-05-01',-15600,'PRESTO TTC PASS','m_presto','cat_transit','h_presto_05','csv','2026-05-01T07:00:00Z'),

  -- GoodLife Fitness $44.99/mo basic plan (7th)
  ('tx_gym_02','acc_td_chq','2026-02-07',-4499,'GOODLIFE FITNESS','m_goodlife','cat_fitness','h_gym_02','csv','2026-02-07T07:00:00Z'),
  ('tx_gym_03','acc_td_chq','2026-03-07',-4499,'GOODLIFE FITNESS','m_goodlife','cat_fitness','h_gym_03','csv','2026-03-07T07:00:00Z'),
  ('tx_gym_04','acc_td_chq','2026-04-07',-4499,'GOODLIFE FITNESS','m_goodlife','cat_fitness','h_gym_04','csv','2026-04-07T07:00:00Z'),
  ('tx_gym_05','acc_td_chq','2026-05-07',-4499,'GOODLIFE FITNESS','m_goodlife','cat_fitness','h_gym_05','csv','2026-05-07T07:00:00Z'),

  -- CC payments: TD Visa (22nd), Capital One (25th). Slightly above minimum. Not paying off.
  ('tx_ccp_v_02','acc_td_chq','2026-02-22',-12000,'TD VISA PAYMENT',    'm_td_visa','cat_cc_payment','h_ccp_v_02','csv','2026-02-22T09:00:00Z'),
  ('tx_ccp_v_03','acc_td_chq','2026-03-22',-12500,'TD VISA PAYMENT',    'm_td_visa','cat_cc_payment','h_ccp_v_03','csv','2026-03-22T09:00:00Z'),
  ('tx_ccp_v_04','acc_td_chq','2026-04-22',-13000,'TD VISA PAYMENT',    'm_td_visa','cat_cc_payment','h_ccp_v_04','csv','2026-04-22T09:00:00Z'),
  ('tx_ccp_v_05','acc_td_chq','2026-05-12',-11500,'TD VISA PAYMENT',    'm_td_visa','cat_cc_payment','h_ccp_v_05','csv','2026-05-12T09:00:00Z'),
  ('tx_ccp_c_02','acc_td_chq','2026-02-25', -6500,'CAPITAL ONE PAYMENT','m_capone', 'cat_cc_payment','h_ccp_c_02','csv','2026-02-25T09:00:00Z'),
  ('tx_ccp_c_03','acc_td_chq','2026-03-25', -7000,'CAPITAL ONE PAYMENT','m_capone', 'cat_cc_payment','h_ccp_c_03','csv','2026-03-25T09:00:00Z'),
  ('tx_ccp_c_04','acc_td_chq','2026-04-27', -7500,'CAPITAL ONE PAYMENT','m_capone', 'cat_cc_payment','h_ccp_c_04','csv','2026-04-27T09:00:00Z'),

  -- Savings transfers: small but consistent, building the habit
  -- Growing slowly each paycheque as they get more disciplined
  ('tx_sav_01','acc_td_chq','2026-02-13',-6500,'TFR TO SAVINGS',NULL,'cat_transfer','h_sav_01','csv','2026-02-13T10:30:00Z'),
  ('tx_sav_02','acc_td_chq','2026-02-27',-6500,'TFR TO SAVINGS',NULL,'cat_transfer','h_sav_02','csv','2026-02-27T10:30:00Z'),
  ('tx_sav_03','acc_td_chq','2026-03-13',-7500,'TFR TO SAVINGS',NULL,'cat_transfer','h_sav_03','csv','2026-03-13T10:30:00Z'),
  ('tx_sav_04','acc_td_chq','2026-03-27',-7500,'TFR TO SAVINGS',NULL,'cat_transfer','h_sav_04','csv','2026-03-27T10:30:00Z'),
  ('tx_sav_05','acc_td_chq','2026-04-10',-8000,'TFR TO SAVINGS',NULL,'cat_transfer','h_sav_05','csv','2026-04-10T10:30:00Z'),
  ('tx_sav_06','acc_td_chq','2026-04-24',-8000,'TFR TO SAVINGS',NULL,'cat_transfer','h_sav_06','csv','2026-04-24T10:30:00Z'),
  ('tx_sav_07','acc_td_chq','2026-05-08',-8500,'TFR TO SAVINGS',NULL,'cat_transfer','h_sav_07','csv','2026-05-08T10:30:00Z');

-- ===== TD Visa: groceries, coffee, fast food, dining, indulgence, subscriptions, shopping =====
-- This is the primary card. Monthly charges ~$700-750. Balance slowly growing.
INSERT OR REPLACE INTO transactions (id, account_id, posted_at, amount_cents, description_raw, merchant_id, category_id, dedup_hash, source, created_at) VALUES

  -- Groceries: ~$280-330/month. Mostly No Frills + Metro, Loblaws occasionally.
  -- No Costco — hard to stock up when cash is tight. Buying just enough each week.
  ('tx_v_g01','acc_td_visa','2026-02-14', -5840,'NO FRILLS DUFFERIN',  'm_nofrills','cat_groceries','h_v_g01','csv','2026-02-14T13:00:00Z'),
  ('tx_v_g02','acc_td_visa','2026-02-21', -6920,'METRO COLLEGE ST',    'm_metro',   'cat_groceries','h_v_g02','csv','2026-02-21T14:00:00Z'),
  ('tx_v_g03','acc_td_visa','2026-02-28', -5340,'NO FRILLS DUFFERIN',  'm_nofrills','cat_groceries','h_v_g03','csv','2026-02-28T13:00:00Z'),
  ('tx_v_g04','acc_td_visa','2026-03-07', -7280,'METRO COLLEGE ST',    'm_metro',   'cat_groceries','h_v_g04','csv','2026-03-07T11:30:00Z'),
  ('tx_v_g05','acc_td_visa','2026-03-14', -6140,'NO FRILLS DUFFERIN',  'm_nofrills','cat_groceries','h_v_g05','csv','2026-03-14T13:00:00Z'),
  ('tx_v_g06','acc_td_visa','2026-03-21', -8620,'LOBLAWS QUEEN ST',    'm_loblaws', 'cat_groceries','h_v_g06','csv','2026-03-21T14:00:00Z'),
  ('tx_v_g07','acc_td_visa','2026-03-28', -5960,'NO FRILLS DUFFERIN',  'm_nofrills','cat_groceries','h_v_g07','csv','2026-03-28T13:00:00Z'),
  ('tx_v_g08','acc_td_visa','2026-04-04', -7480,'METRO COLLEGE ST',    'm_metro',   'cat_groceries','h_v_g08','csv','2026-04-04T11:30:00Z'),
  ('tx_v_g09','acc_td_visa','2026-04-11', -5780,'NO FRILLS DUFFERIN',  'm_nofrills','cat_groceries','h_v_g09','csv','2026-04-11T13:00:00Z'),
  ('tx_v_g10','acc_td_visa','2026-04-18', -6840,'METRO COLLEGE ST',    'm_metro',   'cat_groceries','h_v_g10','csv','2026-04-18T11:30:00Z'),
  ('tx_v_g11','acc_td_visa','2026-04-25', -7120,'LOBLAWS QUEEN ST',    'm_loblaws', 'cat_groceries','h_v_g11','csv','2026-04-25T14:00:00Z'),
  ('tx_v_g12','acc_td_visa','2026-05-02', -5640,'NO FRILLS DUFFERIN',  'm_nofrills','cat_groceries','h_v_g12','csv','2026-05-02T13:00:00Z'),
  ('tx_v_g13','acc_td_visa','2026-05-09', -6980,'METRO COLLEGE ST',    'm_metro',   'cat_groceries','h_v_g13','csv','2026-05-09T11:30:00Z'),
  ('tx_v_g14','acc_td_visa','2026-05-14', -5280,'NO FRILLS DUFFERIN',  'm_nofrills','cat_groceries','h_v_g14','csv','2026-05-14T13:00:00Z'),

  -- Coffee: mostly Tim Hortons (budget staple), occasional Starbucks as a treat
  ('tx_v_co01','acc_td_visa','2026-02-16', -319,'TIM HORTONS COLLEGE', 'm_tim',      'cat_fastfood','h_v_co01','csv','2026-02-16T08:30:00Z'),
  ('tx_v_co02','acc_td_visa','2026-02-18', -699,'STARBUCKS QUEEN W',   'm_starbucks','cat_fastfood','h_v_co02','csv','2026-02-18T08:45:00Z'),
  ('tx_v_co03','acc_td_visa','2026-02-23', -379,'TIM HORTONS COLLEGE', 'm_tim',      'cat_fastfood','h_v_co03','csv','2026-02-23T08:30:00Z'),
  ('tx_v_co04','acc_td_visa','2026-02-25', -349,'TIM HORTONS COLLEGE', 'm_tim',      'cat_fastfood','h_v_co04','csv','2026-02-25T08:20:00Z'),
  ('tx_v_co05','acc_td_visa','2026-03-02', -319,'TIM HORTONS COLLEGE', 'm_tim',      'cat_fastfood','h_v_co05','csv','2026-03-02T08:30:00Z'),
  ('tx_v_co06','acc_td_visa','2026-03-06', -739,'STARBUCKS QUEEN W',   'm_starbucks','cat_fastfood','h_v_co06','csv','2026-03-06T09:10:00Z'),
  ('tx_v_co07','acc_td_visa','2026-03-09', -379,'TIM HORTONS COLLEGE', 'm_tim',      'cat_fastfood','h_v_co07','csv','2026-03-09T08:30:00Z'),
  ('tx_v_co08','acc_td_visa','2026-03-16', -349,'TIM HORTONS COLLEGE', 'm_tim',      'cat_fastfood','h_v_co08','csv','2026-03-16T08:30:00Z'),
  ('tx_v_co09','acc_td_visa','2026-03-23', -319,'TIM HORTONS COLLEGE', 'm_tim',      'cat_fastfood','h_v_co09','csv','2026-03-23T08:30:00Z'),
  ('tx_v_co10','acc_td_visa','2026-03-30', -699,'STARBUCKS QUEEN W',   'm_starbucks','cat_fastfood','h_v_co10','csv','2026-03-30T09:00:00Z'),
  ('tx_v_co11','acc_td_visa','2026-04-03', -379,'TIM HORTONS COLLEGE', 'm_tim',      'cat_fastfood','h_v_co11','csv','2026-04-03T08:30:00Z'),
  ('tx_v_co12','acc_td_visa','2026-04-07', -349,'TIM HORTONS COLLEGE', 'm_tim',      'cat_fastfood','h_v_co12','csv','2026-04-07T08:15:00Z'),
  ('tx_v_co13','acc_td_visa','2026-04-14', -319,'TIM HORTONS COLLEGE', 'm_tim',      'cat_fastfood','h_v_co13','csv','2026-04-14T08:30:00Z'),
  ('tx_v_co14','acc_td_visa','2026-04-20', -739,'STARBUCKS QUEEN W',   'm_starbucks','cat_fastfood','h_v_co14','csv','2026-04-20T09:05:00Z'),
  ('tx_v_co15','acc_td_visa','2026-04-27', -349,'TIM HORTONS COLLEGE', 'm_tim',      'cat_fastfood','h_v_co15','csv','2026-04-27T08:30:00Z'),
  ('tx_v_co16','acc_td_visa','2026-05-04', -319,'TIM HORTONS COLLEGE', 'm_tim',      'cat_fastfood','h_v_co16','csv','2026-05-04T08:30:00Z'),
  ('tx_v_co17','acc_td_visa','2026-05-11', -379,'TIM HORTONS COLLEGE', 'm_tim',      'cat_fastfood','h_v_co17','csv','2026-05-11T08:30:00Z'),

  -- Fast food / takeout (indulgence): McDonald's mostly, one pizza night
  ('tx_v_ff01','acc_td_visa','2026-02-17', -1245,'MCDONALDS BLOOR',   'm_mcd','cat_fastfood','h_v_ff01','csv','2026-02-17T13:00:00Z'),
  ('tx_v_ff02','acc_td_visa','2026-02-27', -1580,'MCDONALDS BLOOR',   'm_mcd','cat_fastfood','h_v_ff02','csv','2026-02-27T13:30:00Z'),
  ('tx_v_ff03','acc_td_visa','2026-03-04', -1420,'MCDONALDS BLOOR',   'm_mcd','cat_fastfood','h_v_ff03','csv','2026-03-04T13:00:00Z'),
  ('tx_v_ff04','acc_td_visa','2026-03-18', -1680,'MCDONALDS BLOOR',   'm_mcd','cat_fastfood','h_v_ff04','csv','2026-03-18T13:00:00Z'),
  ('tx_v_ff05','acc_td_visa','2026-03-25', -1340,'MCDONALDS BLOOR',   'm_mcd','cat_fastfood','h_v_ff05','csv','2026-03-25T13:00:00Z'),
  ('tx_v_ff06','acc_td_visa','2026-04-01', -1490,'MCDONALDS BLOOR',   'm_mcd','cat_fastfood','h_v_ff06','csv','2026-04-01T13:00:00Z'),
  ('tx_v_ff07','acc_td_visa','2026-04-08', -1620,'MCDONALDS BLOOR',   'm_mcd','cat_fastfood','h_v_ff07','csv','2026-04-08T13:00:00Z'),
  ('tx_v_ff08','acc_td_visa','2026-04-22', -1380,'MCDONALDS BLOOR',   'm_mcd','cat_fastfood','h_v_ff08','csv','2026-04-22T13:00:00Z'),
  ('tx_v_ff09','acc_td_visa','2026-05-06', -1540,'MCDONALDS BLOOR',   'm_mcd','cat_fastfood','h_v_ff09','csv','2026-05-06T13:00:00Z'),
  ('tx_v_ff10','acc_td_visa','2026-05-13', -1290,'MCDONALDS BLOOR',   'm_mcd','cat_fastfood','h_v_ff10','csv','2026-05-13T13:00:00Z'),

  -- Dining out (lifestyle): affordable spots, occasional treat
  -- Banh Mi Boys is the go-to (~$14-18), Pai once as a birthday treat, one Lady Marmalade brunch
  ('tx_v_dn01','acc_td_visa','2026-02-20', -1620,'BANH MI BOYS QUEEN','m_banhmi',    'cat_dining','h_v_dn01','csv','2026-02-20T13:00:00Z'),
  ('tx_v_dn02','acc_td_visa','2026-03-08', -6240,'PAI NORTHERN THAI', 'm_pai',       'cat_dining','h_v_dn02','csv','2026-03-08T19:30:00Z'),
  ('tx_v_dn03','acc_td_visa','2026-03-22', -1840,'BANH MI BOYS QUEEN','m_banhmi',    'cat_dining','h_v_dn03','csv','2026-03-22T13:00:00Z'),
  ('tx_v_dn04','acc_td_visa','2026-04-05', -4280,'LADY MARMALADE',    'm_ladymarm',  'cat_dining','h_v_dn04','csv','2026-04-05T10:30:00Z'),
  ('tx_v_dn05','acc_td_visa','2026-04-19', -1760,'BANH MI BOYS QUEEN','m_banhmi',    'cat_dining','h_v_dn05','csv','2026-04-19T13:00:00Z'),
  ('tx_v_dn06','acc_td_visa','2026-05-03', -2840,'GOLDEN TURTLE',     'm_goldenturtle','cat_dining','h_v_dn06','csv','2026-05-03T19:00:00Z'),
  ('tx_v_dn07','acc_td_visa','2026-05-10', -1580,'BANH MI BOYS QUEEN','m_banhmi',    'cat_dining','h_v_dn07','csv','2026-05-10T13:00:00Z'),

  -- Uber Eats: 2x/month. Comfort spending, usually Friday night.
  ('tx_v_ue01','acc_td_visa','2026-02-21', -3240,'UBER EATS TORONTO','m_uber','cat_dining','h_v_ue01','csv','2026-02-21T20:00:00Z'),
  ('tx_v_ue02','acc_td_visa','2026-03-07', -2980,'UBER EATS TORONTO','m_uber','cat_dining','h_v_ue02','csv','2026-03-07T20:00:00Z'),
  ('tx_v_ue03','acc_td_visa','2026-03-20', -3420,'UBER EATS TORONTO','m_uber','cat_dining','h_v_ue03','csv','2026-03-20T20:00:00Z'),
  ('tx_v_ue04','acc_td_visa','2026-04-04', -2760,'UBER EATS TORONTO','m_uber','cat_dining','h_v_ue04','csv','2026-04-04T20:00:00Z'),
  ('tx_v_ue05','acc_td_visa','2026-04-18', -3180,'UBER EATS TORONTO','m_uber','cat_dining','h_v_ue05','csv','2026-04-18T20:00:00Z'),
  ('tx_v_ue06','acc_td_visa','2026-05-02', -2920,'UBER EATS TORONTO','m_uber','cat_dining','h_v_ue06','csv','2026-05-02T20:00:00Z'),
  ('tx_v_ue07','acc_td_visa','2026-05-09', -3360,'UBER EATS TORONTO','m_uber','cat_dining','h_v_ue07','csv','2026-05-09T20:00:00Z'),

  -- Alcohol (indulgence): ~$55-70/month. LCBO run every 2-3 weeks.
  ('tx_v_al01','acc_td_visa','2026-02-21', -3480,'LCBO QUEEN W',   'm_lcbo','cat_alcohol','h_v_al01','csv','2026-02-21T18:30:00Z'),
  ('tx_v_al02','acc_td_visa','2026-03-07', -2940,'LCBO QUEEN W',   'm_lcbo','cat_alcohol','h_v_al02','csv','2026-03-07T18:30:00Z'),
  ('tx_v_al03','acc_td_visa','2026-03-20', -3820,'LCBO QUEEN W',   'm_lcbo','cat_alcohol','h_v_al03','csv','2026-03-20T18:30:00Z'),
  ('tx_v_al04','acc_td_visa','2026-04-03', -2460,'THE BEER STORE', 'm_beer','cat_alcohol','h_v_al04','csv','2026-04-03T18:00:00Z'),
  ('tx_v_al05','acc_td_visa','2026-04-18', -3640,'LCBO QUEEN W',   'm_lcbo','cat_alcohol','h_v_al05','csv','2026-04-18T18:30:00Z'),
  ('tx_v_al06','acc_td_visa','2026-05-01', -2880,'LCBO QUEEN W',   'm_lcbo','cat_alcohol','h_v_al06','csv','2026-05-01T18:30:00Z'),
  ('tx_v_al07','acc_td_visa','2026-05-09', -3240,'THE BEER STORE', 'm_beer','cat_alcohol','h_v_al07','csv','2026-05-09T18:00:00Z'),

  -- Cannabis (indulgence): every 2-3 weeks, Tokyo Smoke. $35-50 each time.
  ('tx_v_cn01','acc_td_visa','2026-02-19', -3840,'TOKYO SMOKE QUEEN','m_tokyosmoke','cat_cannabis','h_v_cn01','csv','2026-02-19T19:00:00Z'),
  ('tx_v_cn02','acc_td_visa','2026-03-05', -4240,'TOKYO SMOKE QUEEN','m_tokyosmoke','cat_cannabis','h_v_cn02','csv','2026-03-05T19:00:00Z'),
  ('tx_v_cn03','acc_td_visa','2026-03-19', -3580,'TOKYO SMOKE QUEEN','m_tokyosmoke','cat_cannabis','h_v_cn03','csv','2026-03-19T19:00:00Z'),
  ('tx_v_cn04','acc_td_visa','2026-04-02', -4620,'TOKYO SMOKE QUEEN','m_tokyosmoke','cat_cannabis','h_v_cn04','csv','2026-04-02T19:00:00Z'),
  ('tx_v_cn05','acc_td_visa','2026-04-16', -3940,'TOKYO SMOKE QUEEN','m_tokyosmoke','cat_cannabis','h_v_cn05','csv','2026-04-16T19:00:00Z'),
  ('tx_v_cn06','acc_td_visa','2026-04-30', -4180,'TOKYO SMOKE QUEEN','m_tokyosmoke','cat_cannabis','h_v_cn06','csv','2026-04-30T19:00:00Z'),
  ('tx_v_cn07','acc_td_visa','2026-05-12', -3760,'TOKYO SMOKE QUEEN','m_tokyosmoke','cat_cannabis','h_v_cn07','csv','2026-05-12T19:00:00Z'),

  -- Subscriptions (lifestyle): Netflix, Spotify, Apple iCloud 200GB
  ('tx_v_nf02','acc_td_visa','2026-02-08',-1999,'NETFLIX.COM',    'm_netflix','cat_subscriptions','h_v_nf02','csv','2026-02-08T05:00:00Z'),
  ('tx_v_nf03','acc_td_visa','2026-03-08',-1999,'NETFLIX.COM',    'm_netflix','cat_subscriptions','h_v_nf03','csv','2026-03-08T05:00:00Z'),
  ('tx_v_nf04','acc_td_visa','2026-04-08',-1999,'NETFLIX.COM',    'm_netflix','cat_subscriptions','h_v_nf04','csv','2026-04-08T05:00:00Z'),
  ('tx_v_nf05','acc_td_visa','2026-05-08',-1999,'NETFLIX.COM',    'm_netflix','cat_subscriptions','h_v_nf05','csv','2026-05-08T05:00:00Z'),
  ('tx_v_sp02','acc_td_visa','2026-02-11',-1299,'SPOTIFY CANADA', 'm_spotify','cat_subscriptions','h_v_sp02','csv','2026-02-11T05:00:00Z'),
  ('tx_v_sp03','acc_td_visa','2026-03-11',-1299,'SPOTIFY CANADA', 'm_spotify','cat_subscriptions','h_v_sp03','csv','2026-03-11T05:00:00Z'),
  ('tx_v_sp04','acc_td_visa','2026-04-11',-1299,'SPOTIFY CANADA', 'm_spotify','cat_subscriptions','h_v_sp04','csv','2026-04-11T05:00:00Z'),
  ('tx_v_sp05','acc_td_visa','2026-05-11',-1299,'SPOTIFY CANADA', 'm_spotify','cat_subscriptions','h_v_sp05','csv','2026-05-11T05:00:00Z'),
  ('tx_v_ap02','acc_td_visa','2026-02-18', -399,'APPLE.COM/BILL', 'm_apple',  'cat_subscriptions','h_v_ap02','csv','2026-02-18T05:00:00Z'),
  ('tx_v_ap03','acc_td_visa','2026-03-18', -399,'APPLE.COM/BILL', 'm_apple',  'cat_subscriptions','h_v_ap03','csv','2026-03-18T05:00:00Z'),
  ('tx_v_ap04','acc_td_visa','2026-04-18', -399,'APPLE.COM/BILL', 'm_apple',  'cat_subscriptions','h_v_ap04','csv','2026-04-18T05:00:00Z'),
  ('tx_v_ap05','acc_td_visa','2026-05-13', -399,'APPLE.COM/BILL', 'm_apple',  'cat_subscriptions','h_v_ap05','csv','2026-05-13T05:00:00Z'),

  -- Shopping (lifestyle): Amazon for small stuff, Value Village for thrifting
  ('tx_v_sh01','acc_td_visa','2026-02-25', -2840,'AMAZON.CA',           'm_amazon', 'cat_shopping','h_v_sh01','csv','2026-02-25T14:00:00Z'),
  ('tx_v_sh02','acc_td_visa','2026-03-15', -1860,'VALUE VILLAGE BLOOR', 'm_valuev', 'cat_shopping','h_v_sh02','csv','2026-03-15T14:00:00Z'),
  ('tx_v_sh03','acc_td_visa','2026-03-28', -3420,'AMAZON.CA',           'm_amazon', 'cat_shopping','h_v_sh03','csv','2026-03-28T14:00:00Z'),
  ('tx_v_sh04','acc_td_visa','2026-04-12', -1480,'VALUE VILLAGE BLOOR', 'm_valuev', 'cat_shopping','h_v_sh04','csv','2026-04-12T14:00:00Z'),
  ('tx_v_sh05','acc_td_visa','2026-04-26', -2560,'AMAZON.CA',           'm_amazon', 'cat_shopping','h_v_sh05','csv','2026-04-26T14:00:00Z'),
  ('tx_v_sh06','acc_td_visa','2026-05-09', -3180,'AMAZON.CA',           'm_amazon', 'cat_shopping','h_v_sh06','csv','2026-05-09T14:00:00Z'),

  -- Amazon refund (returned something)
  ('tx_v_ref01','acc_td_visa','2026-04-14', 1840,'AMAZON.CA REFUND','m_amazon','cat_refund','h_v_ref01','csv','2026-04-14T10:00:00Z'),

  -- Shoppers Drug Mart: pharmacy + personal care ~$30-40/month
  ('tx_v_sd01','acc_td_visa','2026-02-27', -2640,'SHOPPERS DRUG MART','m_shoppers','cat_medical','h_v_sd01','csv','2026-02-27T16:00:00Z'),
  ('tx_v_sd02','acc_td_visa','2026-03-25', -3180,'SHOPPERS DRUG MART','m_shoppers','cat_medical','h_v_sd02','csv','2026-03-25T16:00:00Z'),
  ('tx_v_sd03','acc_td_visa','2026-04-24', -2940,'SHOPPERS DRUG MART','m_shoppers','cat_medical','h_v_sd03','csv','2026-04-24T16:00:00Z'),
  ('tx_v_sd04','acc_td_visa','2026-05-13', -2480,'SHOPPERS DRUG MART','m_shoppers','cat_medical','h_v_sd04','csv','2026-05-13T16:00:00Z'),

  -- TD Visa payment RECEIPTS: positive amounts mirror the chequing outflows.
  -- Without these, the credit-card account looks like charges-only and the books don't balance.
  ('tx_v_pmt_02','acc_td_visa','2026-02-22', 12000,'PAYMENT - THANK YOU','m_td_visa','cat_transfer','h_v_pmt_02','csv','2026-02-22T09:05:00Z'),
  ('tx_v_pmt_03','acc_td_visa','2026-03-22', 12500,'PAYMENT - THANK YOU','m_td_visa','cat_transfer','h_v_pmt_03','csv','2026-03-22T09:05:00Z'),
  ('tx_v_pmt_04','acc_td_visa','2026-04-22', 13000,'PAYMENT - THANK YOU','m_td_visa','cat_transfer','h_v_pmt_04','csv','2026-04-22T09:05:00Z'),
  ('tx_v_pmt_05','acc_td_visa','2026-05-12', 11500,'PAYMENT - THANK YOU','m_td_visa','cat_transfer','h_v_pmt_05','csv','2026-05-12T09:05:00Z');

-- ===== Capital One: secondary card, smaller mix of indulgence + dining =====
-- Used when over the mental spending limit on TD Visa. Slower to pay down.
INSERT OR REPLACE INTO transactions (id, account_id, posted_at, amount_cents, description_raw, merchant_id, category_id, dedup_hash, source, created_at) VALUES
  ('tx_c_al01','acc_capone','2026-02-22', -2980,'LCBO YONGE',          'm_lcbo',      'cat_alcohol', 'h_c_al01','csv','2026-02-22T19:00:00Z'),
  ('tx_c_al02','acc_capone','2026-03-15', -3240,'LCBO YONGE',          'm_lcbo',      'cat_alcohol', 'h_c_al02','csv','2026-03-15T19:00:00Z'),
  ('tx_c_al03','acc_capone','2026-04-12', -2640,'LCBO YONGE',          'm_lcbo',      'cat_alcohol', 'h_c_al03','csv','2026-04-12T19:00:00Z'),
  ('tx_c_al04','acc_capone','2026-05-04', -3180,'LCBO YONGE',          'm_lcbo',      'cat_alcohol', 'h_c_al04','csv','2026-05-04T19:00:00Z'),
  ('tx_c_cn01','acc_capone','2026-03-08', -3840,'TOKYO SMOKE BLOOR',   'm_tokyosmoke','cat_cannabis','h_c_cn01','csv','2026-03-08T19:30:00Z'),
  ('tx_c_cn02','acc_capone','2026-04-23', -4120,'TOKYO SMOKE BLOOR',   'm_tokyosmoke','cat_cannabis','h_c_cn02','csv','2026-04-23T19:30:00Z'),
  ('tx_c_dn01','acc_capone','2026-03-21', -3640,'BAR RAVAL',           'm_barraval',  'cat_dining',  'h_c_dn01','csv','2026-03-21T21:00:00Z'),
  ('tx_c_dn02','acc_capone','2026-04-11', -1680,'BANH MI BOYS QUEEN',  'm_banhmi',    'cat_dining',  'h_c_dn02','csv','2026-04-11T13:00:00Z'),
  ('tx_c_dn03','acc_capone','2026-05-09', -1920,'BANH MI BOYS QUEEN',  'm_banhmi',    'cat_dining',  'h_c_dn03','csv','2026-05-09T13:00:00Z'),
  -- Two uncategorized / unrecognized rows for review queue
  ('tx_c_mys01','acc_capone','2026-05-07', -2840,'SQ *MYSTERY CAFE',   NULL,          NULL,          'h_c_mys01','csv','2026-05-07T14:00:00Z'),
  ('tx_c_mys02','acc_capone','2026-04-29', -1640,'AMZN MKTP CA*AB124', NULL,          NULL,          'h_c_mys02','csv','2026-04-29T11:00:00Z'),
  -- Capital One payment RECEIPTS mirror the chequing outflows
  ('tx_c_pmt_02','acc_capone','2026-02-25', 6500,'PAYMENT - THANK YOU','m_capone','cat_transfer','h_c_pmt_02','csv','2026-02-25T09:05:00Z'),
  ('tx_c_pmt_03','acc_capone','2026-03-25', 7000,'PAYMENT - THANK YOU','m_capone','cat_transfer','h_c_pmt_03','csv','2026-03-25T09:05:00Z'),
  ('tx_c_pmt_04','acc_capone','2026-04-27', 7500,'PAYMENT - THANK YOU','m_capone','cat_transfer','h_c_pmt_04','csv','2026-04-27T09:05:00Z');

-- ===== Savings account: credits mirror chequing transfers =====
INSERT OR REPLACE INTO transactions (id, account_id, posted_at, amount_cents, description_raw, merchant_id, category_id, dedup_hash, source, created_at) VALUES
  ('tx_sv_01','acc_td_sav','2026-02-13', 6500,'TFR FROM CHEQUING',NULL,'cat_transfer','h_sv_01','csv','2026-02-13T10:30:00Z'),
  ('tx_sv_02','acc_td_sav','2026-02-27', 6500,'TFR FROM CHEQUING',NULL,'cat_transfer','h_sv_02','csv','2026-02-27T10:30:00Z'),
  ('tx_sv_03','acc_td_sav','2026-03-13', 7500,'TFR FROM CHEQUING',NULL,'cat_transfer','h_sv_03','csv','2026-03-13T10:30:00Z'),
  ('tx_sv_04','acc_td_sav','2026-03-27', 7500,'TFR FROM CHEQUING',NULL,'cat_transfer','h_sv_04','csv','2026-03-27T10:30:00Z'),
  ('tx_sv_05','acc_td_sav','2026-04-10', 8000,'TFR FROM CHEQUING',NULL,'cat_transfer','h_sv_05','csv','2026-04-10T10:30:00Z'),
  ('tx_sv_06','acc_td_sav','2026-04-24', 8000,'TFR FROM CHEQUING',NULL,'cat_transfer','h_sv_06','csv','2026-04-24T10:30:00Z'),
  ('tx_sv_07','acc_td_sav','2026-05-08', 8500,'TFR FROM CHEQUING',NULL,'cat_transfer','h_sv_07','csv','2026-05-08T10:30:00Z');

-- Review queue: 2 uncategorized transactions
DELETE FROM review_queue;
INSERT OR REPLACE INTO review_queue (id, transaction_id, reason, resolved_at) VALUES
  ('rq_mys01','tx_c_mys01','uncategorized',NULL),
  ('rq_mys02','tx_c_mys02','uncategorized',NULL);

-- Debts: two credit cards. No personal loan debt here — handled as a counterparty split.
-- TD Visa $2,850 at 19.99% APR. Paying $120-130/month. Balance slowly growing.
-- Capital One $1,350 at 24.99% APR. Paying $65-75/month. Also slowly growing.
INSERT OR REPLACE INTO debts (id, name, principal_cents, interest_rate_bps, min_payment_type, min_payment_value, statement_date, payment_due_date, account_id_linked, archived) VALUES
  ('debt_td_visa','TD Visa',     285000, 1999, 'percent', 300, 10,  3, 'acc_td_visa', 0),
  ('debt_capone', 'Capital One', 135000, 2499, 'fixed',  5000, 18, 11, 'acc_capone',  0);

-- Debt payments mirror of CC payments
DELETE FROM debt_payments;
INSERT OR REPLACE INTO debt_payments (id, debt_id, transaction_id, amount_cents, posted_at) VALUES
  ('dp_v_02','debt_td_visa','tx_ccp_v_02',12000,'2026-02-22'),
  ('dp_v_03','debt_td_visa','tx_ccp_v_03',12500,'2026-03-22'),
  ('dp_v_04','debt_td_visa','tx_ccp_v_04',13000,'2026-04-22'),
  ('dp_v_05','debt_td_visa','tx_ccp_v_05',11500,'2026-05-12'),
  ('dp_c_02','debt_capone', 'tx_ccp_c_02', 6500,'2026-02-25'),
  ('dp_c_03','debt_capone', 'tx_ccp_c_03', 7000,'2026-03-25'),
  ('dp_c_04','debt_capone', 'tx_ccp_c_04', 7500,'2026-04-27');

-- Counterparties
INSERT OR REPLACE INTO counterparties (id, name, default_settlement_method, archived_at, created_at) VALUES
  ('cp_bowgull','Bowgull',      'etransfer', NULL, '2025-11-01T12:00:00Z'),
  ('cp_marcus', 'Marcus Chen',  'etransfer', NULL, '2026-05-09T12:00:00Z'),
  ('cp_priya',  'Priya Shah',   'etransfer', NULL, '2026-04-27T12:00:00Z'),
  ('cp_diego',  'Diego Alvarez','etransfer', NULL, '2026-05-11T12:00:00Z');

-- Bowgull split: they spotted me $400 for a dental emergency (not covered by insurance).
-- Paying back $100/month. $100 remaining after 3 payments.
DELETE FROM split_events WHERE split_id = 'split_bowgull_mexico';
DELETE FROM splits WHERE id = 'split_bowgull_mexico';
INSERT OR REPLACE INTO splits (id, counterparty_id, direction, original_cents, remaining_cents, reason, created_at, closed_at) VALUES
  ('split_bowgull_mexico','cp_bowgull','i_owe',40000,10000,'dental emergency front','2026-01-15T12:00:00Z',NULL);
INSERT OR REPLACE INTO split_events (id, split_id, delta_cents, transaction_id, note, created_at) VALUES
  ('se_bg_01','split_bowgull_mexico',-10000,NULL,'etransfer to Bowgull Feb','2026-02-20T12:00:00Z'),
  ('se_bg_02','split_bowgull_mexico',-10000,NULL,'etransfer to Bowgull Mar','2026-03-19T12:00:00Z'),
  ('se_bg_03','split_bowgull_mexico',-10000,NULL,'etransfer to Bowgull Apr','2026-04-21T12:00:00Z');

-- Open tabs: small real-life amounts
DELETE FROM splits WHERE id IN ('split_marcus_brunch','split_priya_drinks','split_diego_lunch');
INSERT OR REPLACE INTO splits (id, counterparty_id, direction, original_cents, remaining_cents, reason, created_at, closed_at) VALUES
  ('split_marcus_brunch','cp_marcus','they_owe',3500,3500,'Lady Marmalade brunch — you covered','2026-05-09T12:30:00Z',NULL),
  ('split_priya_drinks',  'cp_priya', 'i_owe',   5500,5500,'Bar Raval — she covered first round', '2026-04-27T22:00:00Z',NULL),
  ('split_diego_lunch',   'cp_diego', 'they_owe',2800,2800,'Golden Turtle lunch split',            '2026-05-11T13:00:00Z',NULL);

-- Credit snapshots: starting at 612 (poor), improving as CC utilization drops.
-- $4,200 combined CC limit (TD $3,000 / Capital One $1,200).
-- Utilization improving: was carrying heavy balances before using the app.
DELETE FROM credit_snapshots;
INSERT OR REPLACE INTO credit_snapshots (id, as_of, score, utilization_bps, on_time_streak_days, source) VALUES
  ('cs_2026_02','2026-02-12',612, 7240, 10,'manual'),
  ('cs_2026_03','2026-03-12',621, 6810, 38,'manual'),
  ('cs_2026_04','2026-04-12',634, 6380, 66,'manual'),
  ('cs_2026_05','2026-05-10',648, 5920, 94,'manual');

-- Holdings: small TFSA, bought XIU.TO a couple years ago and left it.
-- 10 units at avg cost $28.50. Current price $37.42. Small but real.
INSERT OR REPLACE INTO holdings (id, symbol, account_wrapper, units, avg_cost_cents, updated_at) VALUES
  ('hold_xiu','XIU.TO','tfsa',100000,2850,'2026-05-14T22:00:00Z');

-- Prices (latest close)
INSERT OR REPLACE INTO prices (symbol, date, close_cents, source) VALUES
  ('XIU.TO','2026-05-14',3742,'seed');

-- Market snapshot
INSERT OR REPLACE INTO market_snapshots (id, as_of, boc_overnight_bps, cad_usd, tsx_close, sp500_close) VALUES
  ('ms_2026_05_14','2026-05-14',275,7320,2658000,528400);

-- Phase log: bootstrapped in Feb, hit Phase 2 in early April
-- (first CC streak started + essentials covered for 2 consecutive periods)
DELETE FROM phase_log;
INSERT INTO phase_log (id, phase, entered_at, trigger_rule, metrics_json) VALUES
  ('pl_2026_02_13',1,'2026-02-13T08:00:00Z','bootstrap',                              '{}'),
  ('pl_2026_04_05',2,'2026-04-05T08:00:00Z','p1_to_p2:essentials_2p_and_cc_streak_1p','{}');

-- Goals: early stage, small progress
-- Emergency fund = 1 month rent ($1,650). Barely started.
-- Summer camping trip. Just beginning to save.
INSERT OR REPLACE INTO goals (id, name, target_cents, target_date, linked_account_id, progress_cents, archived) VALUES
  ('goal_emerg',   'Emergency fund (1 month rent)',  165000,'2026-12-01','acc_td_sav', 38000, 0),
  ('goal_camping', 'Summer camping trip',             80000,'2026-08-01','acc_td_sav', 12000, 0);

-- Period closes are inserted by scripts/db-reseed.sh AFTER gl-backfill runs.
-- postJournalEntry rejects writes into locked periods, so backfill must complete
-- before period_close rows exist.
