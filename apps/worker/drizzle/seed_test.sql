-- Test data seed for Declyne. Idempotent-ish: uses stable ids so re-running overwrites.
-- Spans ~90 days ending 2026-04-24. Covers accounts, tx, debts, splits, credit, holdings, market.

-- Accounts
INSERT OR REPLACE INTO accounts (id, name, institution, type, currency, last_import_at, archived) VALUES
  ('acc_td_chq', 'TD Chequing', 'TD', 'chequing', 'CAD', '2026-04-24T12:00:00Z', 0),
  ('acc_td_sav', 'TD Savings', 'TD', 'savings', 'CAD', '2026-04-24T12:00:00Z', 0),
  ('acc_td_visa', 'TD Visa', 'TD', 'credit', 'CAD', '2026-04-24T12:00:00Z', 0),
  ('acc_capone', 'Capital One', 'Capital One', 'credit', 'CAD', '2026-04-24T12:00:00Z', 0);

-- Settings relevant to paycheque detection, essentials fallback, current phase
INSERT OR REPLACE INTO settings (key, value) VALUES
  ('paycheque_source_account_id', 'acc_td_chq'),
  ('paycheque_pattern', 'PAYROLL DEP ACME'),
  ('paycheque_min_cents', '150000'),
  ('paycheque_fallback_days', '14'),
  ('essentials_monthly_cents_manual', '260000'),
  ('current_phase', '4'),
  ('phase2_entry_non_mortgage_debt_cents', '580500');

-- Merchants (subset)
INSERT OR REPLACE INTO merchants (id, display_name, normalized_key, category_default_id, verified) VALUES
  ('m_acme',      'Acme Corp Payroll', 'acme payroll',    'cat_paycheque',     1),
  ('m_landlord',  'Landlord',          'landlord rent',   'cat_rent',          1),
  ('m_loblaws',   'Loblaws',           'loblaws',         'cat_groceries',     1),
  ('m_esso',      'Esso',              'esso',            'cat_transit',       1),
  ('m_bell',      'Bell',              'bell',            'cat_phone',         1),
  ('m_rogers',    'Rogers',            'rogers',          'cat_internet',      1),
  ('m_enbridge',  'Enbridge',          'enbridge',        'cat_utilities',     1),
  ('m_intact',    'Intact Insurance',  'intact',          'cat_insurance',     1),
  ('m_netflix',   'Netflix',           'netflix',         'cat_subscriptions', 1),
  ('m_spotify',   'Spotify',           'spotify',         'cat_subscriptions', 1),
  ('m_apple',     'Apple',             'apple com bill',  'cat_subscriptions', 1),
  ('m_tim',       'Tim Hortons',       'tim hortons',     'cat_fastfood',      1),
  ('m_mcd',       "McDonald's",         'mcdonalds',       'cat_fastfood',      1),
  ('m_lcbo',      'LCBO',              'lcbo',            'cat_alcohol',       1),
  ('m_beer',      'Beer Store',        'beer store',      'cat_alcohol',       1),
  ('m_uber',      'Uber Eats',         'uber eats',       'cat_dining',        1),
  ('m_amazon',    'Amazon',            'amazon',          'cat_shopping',      1),
  ('m_td_visa',   'TD Visa Payment',   'td visa payment', 'cat_cc_payment',    1),
  ('m_capone',    'Capital One Payment','capone payment', 'cat_cc_payment',    1);

-- Transactions. dedup_hash just needs to be unique; use a readable composite.
-- Cheq: paycheques (biweekly Fri), rent 1st, utilities 15th, phone 28th, internet 20th, insurance 5th, CC payments, savings transfer.
INSERT OR REPLACE INTO transactions (id, account_id, posted_at, amount_cents, description_raw, merchant_id, category_id, dedup_hash, source, created_at) VALUES
  ('tx_pay_01', 'acc_td_chq', '2026-01-30', 240000, 'PAYROLL DEP ACME CORP',        'm_acme',     'cat_paycheque', 'h_pay_01', 'csv', '2026-01-30T10:00:00Z'),
  ('tx_pay_02', 'acc_td_chq', '2026-02-13', 240000, 'PAYROLL DEP ACME CORP',        'm_acme',     'cat_paycheque', 'h_pay_02', 'csv', '2026-02-13T10:00:00Z'),
  ('tx_pay_03', 'acc_td_chq', '2026-02-27', 240000, 'PAYROLL DEP ACME CORP',        'm_acme',     'cat_paycheque', 'h_pay_03', 'csv', '2026-02-27T10:00:00Z'),
  ('tx_pay_04', 'acc_td_chq', '2026-03-13', 240000, 'PAYROLL DEP ACME CORP',        'm_acme',     'cat_paycheque', 'h_pay_04', 'csv', '2026-03-13T10:00:00Z'),
  ('tx_pay_05', 'acc_td_chq', '2026-03-27', 240000, 'PAYROLL DEP ACME CORP',        'm_acme',     'cat_paycheque', 'h_pay_05', 'csv', '2026-03-27T10:00:00Z'),
  ('tx_pay_06', 'acc_td_chq', '2026-04-10', 240000, 'PAYROLL DEP ACME CORP',        'm_acme',     'cat_paycheque', 'h_pay_06', 'csv', '2026-04-10T10:00:00Z'),
  ('tx_pay_07', 'acc_td_chq', '2026-04-24', 240000, 'PAYROLL DEP ACME CORP',        'm_acme',     'cat_paycheque', 'h_pay_07', 'csv', '2026-04-24T10:00:00Z'),

  ('tx_rent_02', 'acc_td_chq', '2026-02-01', -180000, 'LANDLORD EFT RENT',           'm_landlord', 'cat_rent', 'h_rent_02', 'csv', '2026-02-01T09:00:00Z'),
  ('tx_rent_03', 'acc_td_chq', '2026-03-01', -180000, 'LANDLORD EFT RENT',           'm_landlord', 'cat_rent', 'h_rent_03', 'csv', '2026-03-01T09:00:00Z'),
  ('tx_rent_04', 'acc_td_chq', '2026-04-01', -180000, 'LANDLORD EFT RENT',           'm_landlord', 'cat_rent', 'h_rent_04', 'csv', '2026-04-01T09:00:00Z'),

  ('tx_util_02', 'acc_td_chq', '2026-02-15', -11800, 'ENBRIDGE GAS',                 'm_enbridge', 'cat_utilities', 'h_util_02', 'csv', '2026-02-15T09:00:00Z'),
  ('tx_util_03', 'acc_td_chq', '2026-03-15', -10400, 'ENBRIDGE GAS',                 'm_enbridge', 'cat_utilities', 'h_util_03', 'csv', '2026-03-15T09:00:00Z'),
  ('tx_util_04', 'acc_td_chq', '2026-04-15',  -8600, 'ENBRIDGE GAS',                 'm_enbridge', 'cat_utilities', 'h_util_04', 'csv', '2026-04-15T09:00:00Z'),

  ('tx_phone_02','acc_td_chq', '2026-02-28',  -8500, 'BELL MOBILITY',                'm_bell',     'cat_phone', 'h_phone_02', 'csv', '2026-02-28T09:00:00Z'),
  ('tx_phone_03','acc_td_chq', '2026-03-28',  -8500, 'BELL MOBILITY',                'm_bell',     'cat_phone', 'h_phone_03', 'csv', '2026-03-28T09:00:00Z'),

  ('tx_net_02',  'acc_td_chq', '2026-02-20',  -9500, 'ROGERS INTERNET',              'm_rogers',   'cat_internet', 'h_net_02', 'csv', '2026-02-20T09:00:00Z'),
  ('tx_net_03',  'acc_td_chq', '2026-03-20',  -9500, 'ROGERS INTERNET',              'm_rogers',   'cat_internet', 'h_net_03', 'csv', '2026-03-20T09:00:00Z'),
  ('tx_net_04',  'acc_td_chq', '2026-04-20',  -9500, 'ROGERS INTERNET',              'm_rogers',   'cat_internet', 'h_net_04', 'csv', '2026-04-20T09:00:00Z'),

  ('tx_ins_02',  'acc_td_chq', '2026-02-05', -15200, 'INTACT INSURANCE',             'm_intact',   'cat_insurance', 'h_ins_02', 'csv', '2026-02-05T09:00:00Z'),
  ('tx_ins_03',  'acc_td_chq', '2026-03-05', -15200, 'INTACT INSURANCE',             'm_intact',   'cat_insurance', 'h_ins_03', 'csv', '2026-03-05T09:00:00Z'),
  ('tx_ins_04',  'acc_td_chq', '2026-04-05', -15200, 'INTACT INSURANCE',             'm_intact',   'cat_insurance', 'h_ins_04', 'csv', '2026-04-05T09:00:00Z'),

  -- CC payments (from chequing)
  ('tx_ccp_v_02','acc_td_chq', '2026-02-22', -12000, 'TD VISA PAYMENT',              'm_td_visa',  'cat_cc_payment', 'h_ccp_v_02', 'csv', '2026-02-22T09:00:00Z'),
  ('tx_ccp_v_03','acc_td_chq', '2026-03-22', -12000, 'TD VISA PAYMENT',              'm_td_visa',  'cat_cc_payment', 'h_ccp_v_03', 'csv', '2026-03-22T09:00:00Z'),
  ('tx_ccp_v_04','acc_td_chq', '2026-04-22', -12000, 'TD VISA PAYMENT',              'm_td_visa',  'cat_cc_payment', 'h_ccp_v_04', 'csv', '2026-04-22T09:00:00Z'),
  ('tx_ccp_c_02','acc_td_chq', '2026-02-25',  -6000, 'CAPITAL ONE PAYMENT',          'm_capone',   'cat_cc_payment', 'h_ccp_c_02', 'csv', '2026-02-25T09:00:00Z'),
  ('tx_ccp_c_03','acc_td_chq', '2026-03-25',  -6000, 'CAPITAL ONE PAYMENT',          'm_capone',   'cat_cc_payment', 'h_ccp_c_03', 'csv', '2026-03-25T09:00:00Z'),
  ('tx_ccp_c_04','acc_td_chq', '2026-04-25',  -6000, 'CAPITAL ONE PAYMENT',          'm_capone',   'cat_cc_payment', 'h_ccp_c_04', 'csv', '2026-04-25T09:00:00Z'),

  -- Savings transfer
  ('tx_sav_02', 'acc_td_chq', '2026-02-14', -20000, 'TFR TO SAVINGS',                 NULL,         'cat_transfer', 'h_sav_02', 'csv', '2026-02-14T09:00:00Z'),
  ('tx_sav_03', 'acc_td_chq', '2026-03-14', -25000, 'TFR TO SAVINGS',                 NULL,         'cat_transfer', 'h_sav_03', 'csv', '2026-03-14T09:00:00Z'),
  ('tx_sav_04', 'acc_td_chq', '2026-04-11', -30000, 'TFR TO SAVINGS',                 NULL,         'cat_transfer', 'h_sav_04', 'csv', '2026-04-11T09:00:00Z');

-- Visa: dining, shopping, fast food, alcohol, gas, groceries (variable)
INSERT OR REPLACE INTO transactions (id, account_id, posted_at, amount_cents, description_raw, merchant_id, category_id, dedup_hash, source, created_at) VALUES
  ('tx_v_g01', 'acc_td_visa', '2026-02-02', -12400, 'LOBLAWS #123',      'm_loblaws', 'cat_groceries', 'h_v_g01', 'csv', '2026-02-02T12:00:00Z'),
  ('tx_v_g02', 'acc_td_visa', '2026-02-09', -10800, 'LOBLAWS #123',      'm_loblaws', 'cat_groceries', 'h_v_g02', 'csv', '2026-02-09T12:00:00Z'),
  ('tx_v_g03', 'acc_td_visa', '2026-02-16', -13200, 'LOBLAWS #123',      'm_loblaws', 'cat_groceries', 'h_v_g03', 'csv', '2026-02-16T12:00:00Z'),
  ('tx_v_g04', 'acc_td_visa', '2026-02-23',  -9700, 'LOBLAWS #123',      'm_loblaws', 'cat_groceries', 'h_v_g04', 'csv', '2026-02-23T12:00:00Z'),
  ('tx_v_g05', 'acc_td_visa', '2026-03-02', -11100, 'LOBLAWS #123',      'm_loblaws', 'cat_groceries', 'h_v_g05', 'csv', '2026-03-02T12:00:00Z'),
  ('tx_v_g06', 'acc_td_visa', '2026-03-09', -12800, 'LOBLAWS #123',      'm_loblaws', 'cat_groceries', 'h_v_g06', 'csv', '2026-03-09T12:00:00Z'),
  ('tx_v_g07', 'acc_td_visa', '2026-03-16', -10500, 'LOBLAWS #123',      'm_loblaws', 'cat_groceries', 'h_v_g07', 'csv', '2026-03-16T12:00:00Z'),
  ('tx_v_g08', 'acc_td_visa', '2026-03-23', -12000, 'LOBLAWS #123',      'm_loblaws', 'cat_groceries', 'h_v_g08', 'csv', '2026-03-23T12:00:00Z'),
  ('tx_v_g09', 'acc_td_visa', '2026-03-30', -11600, 'LOBLAWS #123',      'm_loblaws', 'cat_groceries', 'h_v_g09', 'csv', '2026-03-30T12:00:00Z'),
  ('tx_v_g10', 'acc_td_visa', '2026-04-06', -13400, 'LOBLAWS #123',      'm_loblaws', 'cat_groceries', 'h_v_g10', 'csv', '2026-04-06T12:00:00Z'),
  ('tx_v_g11', 'acc_td_visa', '2026-04-13', -10900, 'LOBLAWS #123',      'm_loblaws', 'cat_groceries', 'h_v_g11', 'csv', '2026-04-13T12:00:00Z'),
  ('tx_v_g12', 'acc_td_visa', '2026-04-20', -12200, 'LOBLAWS #123',      'm_loblaws', 'cat_groceries', 'h_v_g12', 'csv', '2026-04-20T12:00:00Z'),

  ('tx_v_gas01','acc_td_visa','2026-02-03', -8200, 'ESSO SELF SERVE',    'm_esso',    'cat_transit', 'h_v_gas01', 'csv', '2026-02-03T18:00:00Z'),
  ('tx_v_gas02','acc_td_visa','2026-02-11', -7800, 'ESSO SELF SERVE',    'm_esso',    'cat_transit', 'h_v_gas02', 'csv', '2026-02-11T18:00:00Z'),
  ('tx_v_gas03','acc_td_visa','2026-02-19', -8900, 'ESSO SELF SERVE',    'm_esso',    'cat_transit', 'h_v_gas03', 'csv', '2026-02-19T18:00:00Z'),
  ('tx_v_gas04','acc_td_visa','2026-02-27', -8100, 'ESSO SELF SERVE',    'm_esso',    'cat_transit', 'h_v_gas04', 'csv', '2026-02-27T18:00:00Z'),
  ('tx_v_gas05','acc_td_visa','2026-03-06', -8600, 'ESSO SELF SERVE',    'm_esso',    'cat_transit', 'h_v_gas05', 'csv', '2026-03-06T18:00:00Z'),
  ('tx_v_gas06','acc_td_visa','2026-03-14', -9100, 'ESSO SELF SERVE',    'm_esso',    'cat_transit', 'h_v_gas06', 'csv', '2026-03-14T18:00:00Z'),
  ('tx_v_gas07','acc_td_visa','2026-03-22', -7700, 'ESSO SELF SERVE',    'm_esso',    'cat_transit', 'h_v_gas07', 'csv', '2026-03-22T18:00:00Z'),
  ('tx_v_gas08','acc_td_visa','2026-03-30', -8400, 'ESSO SELF SERVE',    'm_esso',    'cat_transit', 'h_v_gas08', 'csv', '2026-03-30T18:00:00Z'),
  ('tx_v_gas09','acc_td_visa','2026-04-07', -8800, 'ESSO SELF SERVE',    'm_esso',    'cat_transit', 'h_v_gas09', 'csv', '2026-04-07T18:00:00Z'),
  ('tx_v_gas10','acc_td_visa','2026-04-15', -9200, 'ESSO SELF SERVE',    'm_esso',    'cat_transit', 'h_v_gas10', 'csv', '2026-04-15T18:00:00Z'),
  ('tx_v_gas11','acc_td_visa','2026-04-22', -8500, 'ESSO SELF SERVE',    'm_esso',    'cat_transit', 'h_v_gas11', 'csv', '2026-04-22T18:00:00Z'),

  -- Takeout (indulgence)
  ('tx_v_ff01','acc_td_visa','2026-02-04',  -1450, 'TIM HORTONS #88',    'm_tim',     'cat_fastfood', 'h_v_ff01', 'csv', '2026-02-04T08:00:00Z'),
  ('tx_v_ff02','acc_td_visa','2026-02-06',  -1695, 'MCDONALDS #44',      'm_mcd',     'cat_fastfood', 'h_v_ff02', 'csv', '2026-02-06T13:00:00Z'),
  ('tx_v_ff03','acc_td_visa','2026-02-10',  -1280, 'TIM HORTONS #88',    'm_tim',     'cat_fastfood', 'h_v_ff03', 'csv', '2026-02-10T08:00:00Z'),
  ('tx_v_ff04','acc_td_visa','2026-02-13',  -1820, 'MCDONALDS #44',      'm_mcd',     'cat_fastfood', 'h_v_ff04', 'csv', '2026-02-13T13:00:00Z'),
  ('tx_v_ff05','acc_td_visa','2026-02-17',  -1395, 'TIM HORTONS #88',    'm_tim',     'cat_fastfood', 'h_v_ff05', 'csv', '2026-02-17T08:00:00Z'),
  ('tx_v_ff06','acc_td_visa','2026-02-21',  -1950, 'MCDONALDS #44',      'm_mcd',     'cat_fastfood', 'h_v_ff06', 'csv', '2026-02-21T13:00:00Z'),
  ('tx_v_ff07','acc_td_visa','2026-02-24',  -1250, 'TIM HORTONS #88',    'm_tim',     'cat_fastfood', 'h_v_ff07', 'csv', '2026-02-24T08:00:00Z'),
  ('tx_v_ff08','acc_td_visa','2026-03-01',  -2100, 'MCDONALDS #44',      'm_mcd',     'cat_fastfood', 'h_v_ff08', 'csv', '2026-03-01T13:00:00Z'),
  ('tx_v_ff09','acc_td_visa','2026-03-05',  -1380, 'TIM HORTONS #88',    'm_tim',     'cat_fastfood', 'h_v_ff09', 'csv', '2026-03-05T08:00:00Z'),
  ('tx_v_ff10','acc_td_visa','2026-03-07',  -1875, 'MCDONALDS #44',      'm_mcd',     'cat_fastfood', 'h_v_ff10', 'csv', '2026-03-07T13:00:00Z'),
  ('tx_v_ff11','acc_td_visa','2026-03-12',  -1420, 'TIM HORTONS #88',    'm_tim',     'cat_fastfood', 'h_v_ff11', 'csv', '2026-03-12T08:00:00Z'),
  ('tx_v_ff12','acc_td_visa','2026-03-15',  -2150, 'MCDONALDS #44',      'm_mcd',     'cat_fastfood', 'h_v_ff12', 'csv', '2026-03-15T13:00:00Z'),
  ('tx_v_ff13','acc_td_visa','2026-03-19',  -1340, 'TIM HORTONS #88',    'm_tim',     'cat_fastfood', 'h_v_ff13', 'csv', '2026-03-19T08:00:00Z'),
  ('tx_v_ff14','acc_td_visa','2026-03-22',  -1995, 'MCDONALDS #44',      'm_mcd',     'cat_fastfood', 'h_v_ff14', 'csv', '2026-03-22T13:00:00Z'),
  ('tx_v_ff15','acc_td_visa','2026-03-26',  -1295, 'TIM HORTONS #88',    'm_tim',     'cat_fastfood', 'h_v_ff15', 'csv', '2026-03-26T08:00:00Z'),
  ('tx_v_ff16','acc_td_visa','2026-03-29',  -2240, 'MCDONALDS #44',      'm_mcd',     'cat_fastfood', 'h_v_ff16', 'csv', '2026-03-29T13:00:00Z'),
  ('tx_v_ff17','acc_td_visa','2026-04-02',  -1450, 'TIM HORTONS #88',    'm_tim',     'cat_fastfood', 'h_v_ff17', 'csv', '2026-04-02T08:00:00Z'),
  ('tx_v_ff18','acc_td_visa','2026-04-05',  -1820, 'MCDONALDS #44',      'm_mcd',     'cat_fastfood', 'h_v_ff18', 'csv', '2026-04-05T13:00:00Z'),
  ('tx_v_ff19','acc_td_visa','2026-04-09',  -1380, 'TIM HORTONS #88',    'm_tim',     'cat_fastfood', 'h_v_ff19', 'csv', '2026-04-09T08:00:00Z'),
  ('tx_v_ff20','acc_td_visa','2026-04-12',  -2090, 'MCDONALDS #44',      'm_mcd',     'cat_fastfood', 'h_v_ff20', 'csv', '2026-04-12T13:00:00Z'),
  ('tx_v_ff21','acc_td_visa','2026-04-16',  -1420, 'TIM HORTONS #88',    'm_tim',     'cat_fastfood', 'h_v_ff21', 'csv', '2026-04-16T08:00:00Z'),
  ('tx_v_ff22','acc_td_visa','2026-04-19',  -1950, 'MCDONALDS #44',      'm_mcd',     'cat_fastfood', 'h_v_ff22', 'csv', '2026-04-19T13:00:00Z'),
  ('tx_v_ff23','acc_td_visa','2026-04-23',  -1540, 'TIM HORTONS #88',    'm_tim',     'cat_fastfood', 'h_v_ff23', 'csv', '2026-04-23T08:00:00Z'),

  -- Alcohol (indulgence)
  ('tx_v_al01','acc_td_visa','2026-02-07',  -5400, 'LCBO #150',          'm_lcbo',    'cat_alcohol', 'h_v_al01', 'csv', '2026-02-07T19:00:00Z'),
  ('tx_v_al02','acc_td_visa','2026-02-14',  -6200, 'THE BEER STORE',     'm_beer',    'cat_alcohol', 'h_v_al02', 'csv', '2026-02-14T19:00:00Z'),
  ('tx_v_al03','acc_td_visa','2026-02-21',  -4800, 'LCBO #150',          'm_lcbo',    'cat_alcohol', 'h_v_al03', 'csv', '2026-02-21T19:00:00Z'),
  ('tx_v_al04','acc_td_visa','2026-02-28',  -7200, 'LCBO #150',          'm_lcbo',    'cat_alcohol', 'h_v_al04', 'csv', '2026-02-28T19:00:00Z'),
  ('tx_v_al05','acc_td_visa','2026-03-07',  -5900, 'THE BEER STORE',     'm_beer',    'cat_alcohol', 'h_v_al05', 'csv', '2026-03-07T19:00:00Z'),
  ('tx_v_al06','acc_td_visa','2026-03-14',  -6800, 'LCBO #150',          'm_lcbo',    'cat_alcohol', 'h_v_al06', 'csv', '2026-03-14T19:00:00Z'),
  ('tx_v_al07','acc_td_visa','2026-03-21',  -5200, 'LCBO #150',          'm_lcbo',    'cat_alcohol', 'h_v_al07', 'csv', '2026-03-21T19:00:00Z'),
  ('tx_v_al08','acc_td_visa','2026-03-28',  -7400, 'THE BEER STORE',     'm_beer',    'cat_alcohol', 'h_v_al08', 'csv', '2026-03-28T19:00:00Z'),
  ('tx_v_al09','acc_td_visa','2026-04-04',  -5800, 'LCBO #150',          'm_lcbo',    'cat_alcohol', 'h_v_al09', 'csv', '2026-04-04T19:00:00Z'),
  ('tx_v_al10','acc_td_visa','2026-04-11',  -6400, 'THE BEER STORE',     'm_beer',    'cat_alcohol', 'h_v_al10', 'csv', '2026-04-11T19:00:00Z'),
  ('tx_v_al11','acc_td_visa','2026-04-18',  -5500, 'LCBO #150',          'm_lcbo',    'cat_alcohol', 'h_v_al11', 'csv', '2026-04-18T19:00:00Z'),

  -- Uber eats (dining)
  ('tx_v_ue01','acc_td_visa','2026-02-12',  -3400, 'UBER EATS TORONTO',  'm_uber',    'cat_dining', 'h_v_ue01', 'csv', '2026-02-12T20:00:00Z'),
  ('tx_v_ue02','acc_td_visa','2026-02-22',  -4100, 'UBER EATS TORONTO',  'm_uber',    'cat_dining', 'h_v_ue02', 'csv', '2026-02-22T20:00:00Z'),
  ('tx_v_ue03','acc_td_visa','2026-03-04',  -3750, 'UBER EATS TORONTO',  'm_uber',    'cat_dining', 'h_v_ue03', 'csv', '2026-03-04T20:00:00Z'),
  ('tx_v_ue04','acc_td_visa','2026-03-18',  -4250, 'UBER EATS TORONTO',  'm_uber',    'cat_dining', 'h_v_ue04', 'csv', '2026-03-18T20:00:00Z'),
  ('tx_v_ue05','acc_td_visa','2026-04-01',  -3900, 'UBER EATS TORONTO',  'm_uber',    'cat_dining', 'h_v_ue05', 'csv', '2026-04-01T20:00:00Z'),
  ('tx_v_ue06','acc_td_visa','2026-04-15',  -4500, 'UBER EATS TORONTO',  'm_uber',    'cat_dining', 'h_v_ue06', 'csv', '2026-04-15T20:00:00Z'),

  -- Subscriptions
  ('tx_v_nf02','acc_td_visa','2026-02-08',  -1999, 'NETFLIX.COM',        'm_netflix', 'cat_subscriptions', 'h_v_nf02', 'csv', '2026-02-08T05:00:00Z'),
  ('tx_v_nf03','acc_td_visa','2026-03-08',  -1999, 'NETFLIX.COM',        'm_netflix', 'cat_subscriptions', 'h_v_nf03', 'csv', '2026-03-08T05:00:00Z'),
  ('tx_v_nf04','acc_td_visa','2026-04-08',  -1999, 'NETFLIX.COM',        'm_netflix', 'cat_subscriptions', 'h_v_nf04', 'csv', '2026-04-08T05:00:00Z'),
  ('tx_v_sp02','acc_td_visa','2026-02-11',  -1299, 'SPOTIFY CANADA',     'm_spotify', 'cat_subscriptions', 'h_v_sp02', 'csv', '2026-02-11T05:00:00Z'),
  ('tx_v_sp03','acc_td_visa','2026-03-11',  -1299, 'SPOTIFY CANADA',     'm_spotify', 'cat_subscriptions', 'h_v_sp03', 'csv', '2026-03-11T05:00:00Z'),
  ('tx_v_sp04','acc_td_visa','2026-04-11',  -1299, 'SPOTIFY CANADA',     'm_spotify', 'cat_subscriptions', 'h_v_sp04', 'csv', '2026-04-11T05:00:00Z'),
  ('tx_v_ap02','acc_td_visa','2026-02-18',   -599, 'APPLE.COM/BILL',     'm_apple',   'cat_subscriptions', 'h_v_ap02', 'csv', '2026-02-18T05:00:00Z'),
  ('tx_v_ap03','acc_td_visa','2026-03-18',   -599, 'APPLE.COM/BILL',     'm_apple',   'cat_subscriptions', 'h_v_ap03', 'csv', '2026-03-18T05:00:00Z'),
  ('tx_v_ap04','acc_td_visa','2026-04-18',  -1299, 'APPLE.COM/BILL',     'm_apple',   'cat_subscriptions', 'h_v_ap04', 'csv', '2026-04-18T05:00:00Z'),

  -- Amazon shopping (lifestyle)
  ('tx_v_am01','acc_td_visa','2026-02-18',  -4800, 'AMAZON.CA',          'm_amazon',  'cat_shopping', 'h_v_am01', 'csv', '2026-02-18T14:00:00Z'),
  ('tx_v_am02','acc_td_visa','2026-03-10',  -6200, 'AMAZON.CA',          'm_amazon',  'cat_shopping', 'h_v_am02', 'csv', '2026-03-10T14:00:00Z'),
  ('tx_v_am03','acc_td_visa','2026-04-03', -11900, 'AMAZON.CA',          'm_amazon',  'cat_shopping', 'h_v_am03', 'csv', '2026-04-03T14:00:00Z'),

  -- Capital One: smaller indulgence mix
  ('tx_c_al01','acc_capone','2026-02-05',   -4200, 'LCBO #88',           'm_lcbo',    'cat_alcohol', 'h_c_al01', 'csv', '2026-02-05T19:00:00Z'),
  ('tx_c_al02','acc_capone','2026-03-03',   -3800, 'LCBO #88',           'm_lcbo',    'cat_alcohol', 'h_c_al02', 'csv', '2026-03-03T19:00:00Z'),
  ('tx_c_al03','acc_capone','2026-04-02',   -4600, 'LCBO #88',           'm_lcbo',    'cat_alcohol', 'h_c_al03', 'csv', '2026-04-02T19:00:00Z'),
  ('tx_c_ff01','acc_capone','2026-02-09',   -2400, 'SKIP THE DISHES',    NULL,        'cat_fastfood', 'h_c_ff01', 'csv', '2026-02-09T20:00:00Z'),
  ('tx_c_ff02','acc_capone','2026-03-02',   -2850, 'SKIP THE DISHES',    NULL,        'cat_fastfood', 'h_c_ff02', 'csv', '2026-03-02T20:00:00Z'),
  ('tx_c_ff03','acc_capone','2026-04-04',   -3100, 'SKIP THE DISHES',    NULL,        'cat_fastfood', 'h_c_ff03', 'csv', '2026-04-04T20:00:00Z'),
  -- Unresolved row (for review queue test)
  ('tx_c_mys01','acc_capone','2026-04-17',  -2900, 'SQ *MYSTERY CAFE',   NULL,        NULL,          'h_c_mys01','csv', '2026-04-17T14:00:00Z'),

  -- Savings account credits
  ('tx_sv_02','acc_td_sav','2026-02-14',    20000, 'TFR FROM CHEQUING',  NULL,        'cat_transfer', 'h_sv_02', 'csv', '2026-02-14T09:00:00Z'),
  ('tx_sv_03','acc_td_sav','2026-03-14',    25000, 'TFR FROM CHEQUING',  NULL,        'cat_transfer', 'h_sv_03', 'csv', '2026-03-14T09:00:00Z'),
  ('tx_sv_04','acc_td_sav','2026-04-11',    30000, 'TFR FROM CHEQUING',  NULL,        'cat_transfer', 'h_sv_04', 'csv', '2026-04-11T09:00:00Z');

-- Review queue row for the mystery tx
INSERT OR REPLACE INTO review_queue (id, transaction_id, reason, resolved_at) VALUES
  ('rq_mys01', 'tx_c_mys01', 'uncategorized', NULL);

-- Debts
INSERT OR REPLACE INTO debts (id, name, principal_cents, interest_rate_bps, min_payment_type, min_payment_value, statement_date, payment_due_date, account_id_linked, archived) VALUES
  ('debt_td_visa', 'TD Visa',     312000, 1999, 'percent', 300, 10, 3,  'acc_td_visa', 0),
  ('debt_capone',  'Capital One', 148500, 2499, 'fixed',  5000, 18, 11, 'acc_capone',  0),
  ('debt_bowgull', 'Bowgull (Mexico)', 120000, 0, 'fixed', 10000, 1, 1, NULL, 0);

-- Debt payments mirror of CC payments
INSERT OR REPLACE INTO debt_payments (id, debt_id, transaction_id, amount_cents, posted_at) VALUES
  ('dp_v_02','debt_td_visa','tx_ccp_v_02',12000,'2026-02-22'),
  ('dp_v_03','debt_td_visa','tx_ccp_v_03',12000,'2026-03-22'),
  ('dp_v_04','debt_td_visa','tx_ccp_v_04',12000,'2026-04-22'),
  ('dp_c_02','debt_capone','tx_ccp_c_02',6000,'2026-02-25'),
  ('dp_c_03','debt_capone','tx_ccp_c_03',6000,'2026-03-25'),
  ('dp_c_04','debt_capone','tx_ccp_c_04',6000,'2026-04-25');

-- Bowgull split (update the bootstrap row with real amounts)
UPDATE splits SET original_cents = 150000, remaining_cents = 120000 WHERE id = 'split_bowgull_mexico';
INSERT OR REPLACE INTO split_events (id, split_id, delta_cents, transaction_id, note, created_at) VALUES
  ('se_bg_01','split_bowgull_mexico',-20000,NULL,'etransfer to Bowgull Feb','2026-02-20T12:00:00Z'),
  ('se_bg_02','split_bowgull_mexico',-10000,NULL,'etransfer to Bowgull Mar','2026-03-19T12:00:00Z');

-- Credit snapshot
INSERT OR REPLACE INTO credit_snapshots (id, as_of, score, utilization_bps, on_time_streak_days, source) VALUES
  ('cs_2026_04', '2026-04-20', 682, 4450, 68, 'manual'),
  ('cs_2026_03', '2026-03-20', 671, 5120, 37, 'manual'),
  ('cs_2026_02', '2026-02-20', 664, 5380, 10, 'manual');

-- Holdings (tiny portfolio, mostly to wire Grow tab)
INSERT OR REPLACE INTO holdings (id, symbol, account_wrapper, units, avg_cost_cents, updated_at) VALUES
  ('hold_xiu', 'XIU.TO', 'tfsa', 500000, 3420, '2026-04-24T00:00:00Z'),
  ('hold_spy', 'SPY',    'tfsa', 80000,  52000,'2026-04-24T00:00:00Z');

-- Prices (one latest close each so portfolio values render without live fetch)
INSERT OR REPLACE INTO prices (symbol, date, close_cents, source) VALUES
  ('XIU.TO', '2026-04-23', 3680, 'seed'),
  ('SPY',    '2026-04-23', 58200,'seed');

-- Market snapshot
INSERT OR REPLACE INTO market_snapshots (id, as_of, boc_overnight_bps, cad_usd, tsx_close, sp500_close) VALUES
  ('ms_2026_04_23', '2026-04-23', 275, 7280, 2625000, 520800);

-- Phase log (illustrative trail to phase 4). Wipe prior runs so latest=phase 4.
DELETE FROM phase_log;
INSERT INTO phase_log (id, phase, entered_at, trigger_rule, metrics_json) VALUES
  ('pl_2026_02_01', 2, '2026-02-01T08:00:00Z', 'p1_to_p2:essentials_2p_and_cc_streak_1p', '{}'),
  ('pl_2026_03_01', 3, '2026-03-01T08:00:00Z', 'p2_to_p3:debt_down_20pct_no_miss_60d', '{}'),
  ('pl_2026_04_24', 4, '2026-04-24T23:00:00Z', 'p3_to_p4:util_under_30_x3_and_ontime_90d', '{}');

-- Goals
INSERT OR REPLACE INTO goals (id, name, target_cents, target_date, linked_account_id, progress_cents, archived) VALUES
  ('goal_buffer', 'Cash buffer (1 month essentials)', 260000, '2026-09-01', 'acc_td_sav', 75000, 0);
