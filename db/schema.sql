-- A-Group Financial Dashboard: Postgres schema for Neon.
-- Safe to run more than once: it only creates what is missing.
-- Run it in the Neon SQL Editor, or with `npm run db:setup`.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'currency') THEN
    CREATE TYPE currency AS ENUM ('LYD', 'USD');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'subscription_status') THEN
    CREATE TYPE subscription_status AS ENUM ('PENDING', 'ACTIVE', 'CANCELLED', 'EXPIRED');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'billing_interval') THEN
    CREATE TYPE billing_interval AS ENUM ('MONTHLY', 'YEARLY');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_method') THEN
    CREATE TYPE payment_method AS ENUM ('CASH', 'LOCAL_BANK_CARD', 'INTERNATIONAL_CARD');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_status') THEN
    CREATE TYPE payment_status AS ENUM ('PENDING', 'SUCCEEDED', 'FAILED', 'REFUNDED');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payable_status') THEN
    CREATE TYPE payable_status AS ENUM ('UNPAID', 'PARTIALLY_PAID', 'PAID');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
    CREATE TYPE user_role AS ENUM ('SUPER_ADMIN', 'FINANCE', 'SUPPORT');
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS companies (
  id           TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name         VARCHAR(191) NOT NULL,
  contact_name VARCHAR(191),
  email        VARCHAR(191),
  phone        VARCHAR(50),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS companies_name_idx ON companies (name);

CREATE TABLE IF NOT EXISTS plans (
  id               TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name             VARCHAR(191) NOT NULL UNIQUE,
  description      TEXT,
  billing_interval billing_interval NOT NULL DEFAULT 'MONTHLY',
  price_lyd        NUMERIC(15, 2),
  price_usd        NUMERIC(15, 2),
  is_active        BOOLEAN NOT NULL DEFAULT true,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS subscriptions (
  id         TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  company_id TEXT NOT NULL REFERENCES companies (id) ON DELETE RESTRICT,
  plan_id    TEXT NOT NULL REFERENCES plans (id) ON DELETE RESTRICT,
  amount     NUMERIC(15, 2) NOT NULL,
  currency   currency NOT NULL,
  status     subscription_status NOT NULL DEFAULT 'PENDING',
  starts_at  TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS subscriptions_created_status_idx ON subscriptions (created_at, status);
CREATE INDEX IF NOT EXISTS subscriptions_company_idx ON subscriptions (company_id);

CREATE TABLE IF NOT EXISTS payments (
  id                 TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  subscription_id    TEXT NOT NULL REFERENCES subscriptions (id) ON DELETE RESTRICT,
  amount             NUMERIC(15, 2) NOT NULL,
  currency           currency NOT NULL,
  method             payment_method NOT NULL,
  status             payment_status NOT NULL DEFAULT 'PENDING',
  provider_reference VARCHAR(191) UNIQUE,
  paid_at            TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS payments_status_paid_idx ON payments (status, paid_at);
CREATE INDEX IF NOT EXISTS payments_currency_paid_idx ON payments (currency, paid_at);

CREATE TABLE IF NOT EXISTS expenses (
  id           TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  title        VARCHAR(191) NOT NULL,
  description  TEXT,
  amount       NUMERIC(15, 2) NOT NULL,
  currency     currency NOT NULL,
  expense_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS expenses_currency_date_idx ON expenses (currency, expense_date);

CREATE TABLE IF NOT EXISTS payables (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  vendor_name VARCHAR(191) NOT NULL,
  description TEXT,
  amount      NUMERIC(15, 2) NOT NULL,
  amount_paid NUMERIC(15, 2) NOT NULL DEFAULT 0,
  currency    currency NOT NULL,
  status      payable_status NOT NULL DEFAULT 'UNPAID',
  due_date    TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS payables_status_currency_idx ON payables (status, currency);

-- Dashboard users. Sign-in itself is handled by Clerk; this table only
-- stores each Clerk user's role, so permissions live in our own database.
CREATE TABLE IF NOT EXISTS admin_users (
  id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  clerk_user_id VARCHAR(191) NOT NULL UNIQUE,
  email         VARCHAR(191) NOT NULL,
  full_name     VARCHAR(191),
  role          user_role NOT NULL DEFAULT 'SUPPORT',
  is_active     BOOLEAN NOT NULL DEFAULT true,
  last_seen_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS admin_users_email_idx ON admin_users (lower(email));
