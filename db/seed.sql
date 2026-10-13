-- A-Group Financial Dashboard: demo seed data.
-- Creates 12 months of subscriptions, payments and expenses that end today,
-- so every period (this week, last week, this month, ...) has data.
-- Safe to re-run: it deletes the previous demo rows (ids starting "demo-")
-- and creates them again relative to the current date.
-- Run it AFTER schema.sql.

BEGIN;

DELETE FROM payments      WHERE id LIKE 'demo-%';
DELETE FROM subscriptions WHERE id LIKE 'demo-%';
DELETE FROM expenses      WHERE id LIKE 'demo-%';
DELETE FROM payables      WHERE id LIKE 'demo-%';
DELETE FROM companies     WHERE id LIKE 'demo-%';
DELETE FROM plans         WHERE id LIKE 'demo-%';

-- Companies (fictional) -----------------------------------------------------
INSERT INTO companies (id, name, contact_name, email, phone) VALUES
  ('demo-co-01', 'Al-Madar Logistics',       'Ahmed Salem',    'ahmed@almadar.example',     '+218 91 000 0101'),
  ('demo-co-02', 'Benghazi Tech Hub',        'Sara Fathi',     'sara@bth.example',          '+218 92 000 0102'),
  ('demo-co-03', 'Sahara Retail Co.',        'Omar Khalifa',   'omar@sahara.example',       '+218 91 000 0103'),
  ('demo-co-04', 'Tripoli Medical Center',   'Huda Ali',       'huda@tmc.example',          '+218 94 000 0104'),
  ('demo-co-05', 'Misrata Steel Supplies',   'Khaled Nasser',  'khaled@mss.example',        '+218 91 000 0105'),
  ('demo-co-06', 'Green Mountain Tours',     'Mariam Saad',    'mariam@gmt.example',        '+218 92 000 0106'),
  ('demo-co-07', 'Oasis Foods',              'Yousef Ibrahim', 'yousef@oasis.example',      '+218 91 000 0107'),
  ('demo-co-08', 'Zawiya Auto Parts',        'Nour Hassan',    'nour@zap.example',          '+218 94 000 0108'),
  ('demo-co-09', 'Leptis Consulting',        'Ali Mansour',    'ali@leptis.example',        '+218 91 000 0109'),
  ('demo-co-10', 'Cyrene Pharmacy Group',    'Fatima Omar',    'fatima@cyrene.example',     '+218 92 000 0110'),
  ('demo-co-11', 'Sabha Solar Energy',       'Mohamed Taher',  'mohamed@sabhasolar.example','+218 91 000 0111'),
  ('demo-co-12', 'Mediterranean Academy',    'Reem Abdullah',  'reem@medacademy.example',   '+218 94 000 0112');

-- Plans -----------------------------------------------------------------------
INSERT INTO plans (id, name, description, billing_interval, price_lyd, price_usd) VALUES
  ('demo-plan-starter',    'Starter',    'For small teams getting started', 'MONTHLY',  500.00,  120.00),
  ('demo-plan-business',   'Business',   'For growing companies',           'MONTHLY',  750.00,  200.00),
  ('demo-plan-enterprise', 'Enterprise', 'Annual plan for large companies', 'YEARLY',  6000.00, 1400.00);

-- Subscriptions: roughly 10-16 new subscriptions per month, growing over time.
WITH days AS (
  SELECT d,
         LEAST(
           (date_trunc('day', now() AT TIME ZONE 'Africa/Tripoli')
              - d * interval '1 day'
              + (9 + d % 8) * interval '1 hour') AT TIME ZONE 'Africa/Tripoli',
           now() - interval '10 minutes'
         ) AS at
  FROM generate_series(0, 364) AS d
  WHERE d IN (0, 2, 6, 9)
     OR (d * 7) % 10 < CASE WHEN d < 120 THEN 5 WHEN d < 240 THEN 4 ELSE 3 END
),
picked AS (
  SELECT d, at,
         'demo-co-' || lpad((((d * 5) % 12) + 1)::text, 2, '0') AS company_id,
         CASE d % 3 WHEN 0 THEN 'demo-plan-starter'
                    WHEN 1 THEN 'demo-plan-business'
                    ELSE CASE WHEN d % 9 = 2 THEN 'demo-plan-enterprise' ELSE 'demo-plan-starter' END
         END AS plan_id,
         CASE WHEN d % 4 = 0 THEN 'USD' ELSE 'LYD' END::currency AS currency,
         CASE WHEN d % 11 = 3 THEN 'PENDING'
              WHEN d > 200 AND d % 9 = 0 THEN 'EXPIRED'
              WHEN d % 13 = 5 THEN 'CANCELLED'
              ELSE 'ACTIVE' END::subscription_status AS status
  FROM days
)
INSERT INTO subscriptions (id, company_id, plan_id, amount, currency, status, starts_at, expires_at, created_at, updated_at)
SELECT 'demo-sub-' || p.d,
       p.company_id,
       p.plan_id,
       CASE WHEN p.currency = 'USD' THEN pl.price_usd ELSE pl.price_lyd END,
       p.currency,
       p.status,
       p.at,
       p.at + CASE WHEN pl.billing_interval = 'YEARLY' THEN interval '1 year' ELSE interval '1 month' END,
       p.at,
       p.at
FROM picked p
JOIN plans pl ON pl.id = p.plan_id;

-- First payment for every subscription that is not pending.
INSERT INTO payments (id, subscription_id, amount, currency, method, status, provider_reference, paid_at, created_at, updated_at)
SELECT 'demo-pay-' || substr(s.id, 10) || '-0',
       s.id,
       s.amount,
       s.currency,
       CASE WHEN s.currency = 'USD' THEN 'INTERNATIONAL_CARD'
            WHEN (substr(s.id, 10)::int) % 2 = 0 THEN 'LOCAL_BANK_CARD'
            ELSE 'CASH' END::payment_method,
       'SUCCEEDED',
       'DEMO-REF-' || substr(s.id, 10) || '-0',
       LEAST(s.created_at + interval '2 hours', now() - interval '5 minutes'),
       s.created_at,
       s.created_at
FROM subscriptions s
WHERE s.id LIKE 'demo-sub-%' AND s.status <> 'PENDING';

-- Monthly renewals: active monthly plans renew every month until today;
-- cancelled and expired ones renewed up to three times before stopping.
INSERT INTO payments (id, subscription_id, amount, currency, method, status, provider_reference, paid_at, created_at, updated_at)
SELECT 'demo-pay-' || substr(s.id, 10) || '-' || k,
       s.id,
       s.amount,
       s.currency,
       CASE WHEN s.currency = 'USD' THEN 'INTERNATIONAL_CARD' ELSE 'LOCAL_BANK_CARD' END::payment_method,
       'SUCCEEDED',
       'DEMO-REF-' || substr(s.id, 10) || '-' || k,
       s.created_at + k * interval '1 month',
       s.created_at + k * interval '1 month',
       s.created_at + k * interval '1 month'
FROM subscriptions s
JOIN plans pl ON pl.id = s.plan_id AND pl.billing_interval = 'MONTHLY'
CROSS JOIN generate_series(1, 12) AS k
WHERE s.id LIKE 'demo-sub-%'
  AND s.status IN ('ACTIVE', 'CANCELLED', 'EXPIRED')
  AND s.created_at + k * interval '1 month' <= now()
  AND (s.status = 'ACTIVE' OR k <= 3);

-- A few failed card payments, which must NOT count as revenue.
INSERT INTO payments (id, subscription_id, amount, currency, method, status, paid_at, created_at, updated_at)
SELECT 'demo-pay-failed-' || substr(s.id, 10),
       s.id, s.amount, s.currency, 'INTERNATIONAL_CARD', 'FAILED', NULL, s.created_at, s.created_at
FROM subscriptions s
WHERE s.id LIKE 'demo-sub-%' AND s.status = 'PENDING';

-- Expenses ------------------------------------------------------------------
-- Fixed monthly costs on the 1st of each month (13 months, so last month
-- and the month before have complete costs).
WITH months AS (
  SELECT m,
         (date_trunc('month', now() AT TIME ZONE 'Africa/Tripoli')
            - m * interval '1 month' + interval '10 hours') AT TIME ZONE 'Africa/Tripoli' AS at
  FROM generate_series(0, 12) AS m
)
INSERT INTO expenses (id, title, description, amount, currency, expense_date, created_at, updated_at)
SELECT 'demo-exp-' || x.code || '-' || m.m, x.title, x.description, x.amount, x.currency::currency, m.at, m.at, m.at
FROM months m
CROSS JOIN (VALUES
  ('salaries', 'Staff salaries',         'Monthly payroll',              9000.00, 'LYD'),
  ('rent',     'Office rent',            'Tripoli office',               3500.00, 'LYD'),
  ('utility',  'Electricity & internet', 'Office utilities',              650.00, 'LYD'),
  ('hosting',  'Cloud hosting',          'Servers and bandwidth',         450.00, 'USD'),
  ('software', 'Software licences',      'Design, email and dev tools',   180.00, 'USD')
) AS x(code, title, description, amount, currency)
WHERE m.at <= now();

-- Weekly operating costs (transport, supplies) every Sunday.
INSERT INTO expenses (id, title, description, amount, currency, expense_date, created_at, updated_at)
SELECT 'demo-exp-weekly-' || w,
       'Transport & supplies',
       'Weekly operating costs',
       (300 + (w * 37) % 150)::numeric(15, 2),
       'LYD',
       at, at, at
FROM (
  SELECT w,
         (date_trunc('week', now() AT TIME ZONE 'Africa/Tripoli')
            - w * interval '1 week' - interval '1 day' + interval '12 hours') AT TIME ZONE 'Africa/Tripoli' AS at
  FROM generate_series(0, 52) AS w
) weeks;

-- One-off purchases (create a couple of loss periods in the history).
INSERT INTO expenses (id, title, description, amount, currency, expense_date, created_at, updated_at)
SELECT id, title, description, amount, currency::currency, at, at, at
FROM (VALUES
  ('demo-exp-oneoff-1', 'Data center hardware', 'New server rack',          26000.00, 'LYD', 4),
  ('demo-exp-oneoff-2', 'Marketing campaign',   'Libya Build expo stand',    7500.00, 'LYD', 7),
  ('demo-exp-oneoff-3', 'Security audit',       'External penetration test', 1800.00, 'USD', 9),
  ('demo-exp-oneoff-4', 'Laptops for new hires','5 developer laptops',      12500.00, 'LYD', 1)
) AS v(id, title, description, amount, currency, months_ago)
CROSS JOIN LATERAL (
  SELECT (date_trunc('month', now() AT TIME ZONE 'Africa/Tripoli')
            - v.months_ago * interval '1 month' + interval '14 days 11 hours') AT TIME ZONE 'Africa/Tripoli' AS at
) t;

-- Payables (bills A-Group still owes) ------------------------------------------
INSERT INTO payables (id, vendor_name, description, amount, amount_paid, currency, status, due_date) VALUES
  ('demo-payable-1', 'Libyana Business',        'Corporate lines, Q4',          4200.00, 1200.00, 'LYD', 'PARTIALLY_PAID', now() + interval '12 days'),
  ('demo-payable-2', 'Tripoli Office Supplies', 'Furniture for new floor',      8800.00,    0.00, 'LYD', 'UNPAID',         now() + interval '25 days'),
  ('demo-payable-3', 'Cloud Provider',          'Reserved instances (annual)',  2400.00,  600.00, 'USD', 'PARTIALLY_PAID', now() + interval '40 days'),
  ('demo-payable-4', 'Design Agency',           'Brand refresh',                1500.00,    0.00, 'USD', 'UNPAID',         now() + interval '8 days'),
  ('demo-payable-5', 'Accounting Firm',         'Annual audit',                 3000.00, 3000.00, 'LYD', 'PAID',           now() - interval '20 days');

COMMIT;

-- Quick check of what was created
SELECT 'companies' AS table_name, count(*) FROM companies WHERE id LIKE 'demo-%'
UNION ALL SELECT 'plans', count(*) FROM plans WHERE id LIKE 'demo-%'
UNION ALL SELECT 'subscriptions', count(*) FROM subscriptions WHERE id LIKE 'demo-%'
UNION ALL SELECT 'payments', count(*) FROM payments WHERE id LIKE 'demo-%'
UNION ALL SELECT 'expenses', count(*) FROM expenses WHERE id LIKE 'demo-%'
UNION ALL SELECT 'payables', count(*) FROM payables WHERE id LIKE 'demo-%';
