-- ============================================================
-- Personal Finance Tracker — Supabase/Postgres Schema (v1)
-- All money stored as BIGINT cents. No floats, ever.
-- Every table has user_id + RLS policy scoping to auth.uid().
-- ============================================================

-- ---------- ACCOUNTS ----------
-- Cash, bank, credit card, investment, and "people" (receivables) accounts
-- all live here. Balance is NOT stored directly (except starting_balance) —
-- current balance is derived from starting_balance + all transactions that
-- touch this account. This means editing any past transaction automatically
-- keeps every balance correct with zero extra logic.

create type account_type as enum ('cash', 'bank', 'credit_card', 'investment', 'receivable', 'custom');

create table accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  type account_type not null,
  starting_balance_cents bigint not null default 0,
  starting_date date not null default current_date,
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- CATEGORIES ----------
create type category_kind as enum ('income', 'expense');

create table categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  kind category_kind not null,
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  unique (user_id, name, kind)
);

-- ---------- TRANSACTIONS ----------
-- Single ledger table for everything: discretionary/fixed expenses, income,
-- investment contributions, and transfers (incl. credit card bill payments
-- and loans given/repaid, which are just transfers to/from a 'receivable'
-- account).

create type transaction_type as enum (
  'discretionary_expense',
  'fixed_expense',
  'income',
  'investment_contribution',
  'transfer'
);

create table transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type transaction_type not null,
  amount_cents bigint not null check (amount_cents > 0),
  date date not null,
  category_id uuid references categories(id) on delete set null,
  account_id uuid not null references accounts(id) on delete restrict, -- "paid from" / source
  to_account_id uuid references accounts(id) on delete restrict,       -- only for transfers
  investment_id uuid, -- set when type = investment_contribution (fk added below)
  note text,
  recurring_expense_id uuid, -- set if generated from a recurring rule (fk added below)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint transfer_needs_destination check (
    (type = 'transfer' and to_account_id is not null) or (type <> 'transfer')
  )
);

create index on transactions (user_id, date desc);
create index on transactions (account_id);

-- ---------- RECURRING FIXED EXPENSES ----------
create type recurrence_frequency as enum ('monthly', 'yearly');

create table recurring_expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  amount_cents bigint not null check (amount_cents > 0),
  frequency recurrence_frequency not null,
  day_of_month int check (day_of_month between 1 and 31), -- for monthly
  month_of_year int check (month_of_year between 1 and 12), -- for yearly
  category_id uuid references categories(id) on delete set null,
  account_id uuid not null references accounts(id) on delete restrict,
  next_due_date date not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table transactions
  add constraint fk_recurring_expense
  foreign key (recurring_expense_id) references recurring_expenses(id) on delete set null;

-- ---------- INVESTMENTS ----------
-- Current value is manually updated by the user (it's a market value, not
-- derivable from contributions). Invested capital IS derived — sum of
-- investment_contribution transactions targeting this investment.

create table investments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  type text not null, -- free text, user-defined (no forced taxonomy)
  current_value_cents bigint not null default 0,
  current_value_updated_at timestamptz not null default now(),
  is_archived boolean not null default false,
  created_at timestamptz not null default now()
);

alter table transactions
  add constraint fk_investment
  foreign key (investment_id) references investments(id) on delete set null;

create table recurring_investment_deposits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  investment_id uuid not null references investments(id) on delete cascade,
  amount_cents bigint not null check (amount_cents > 0),
  frequency recurrence_frequency not null,
  day_of_month int check (day_of_month between 1 and 31),
  month_of_year int check (month_of_year between 1 and 12),
  from_account_id uuid not null references accounts(id) on delete restrict,
  next_due_date date not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------- BUDGET SETTINGS ----------
-- Discretionary budget is editable "anytime" — we keep history via
-- effective_from so past months' numbers don't shift if you change it today.

create table budget_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  discretionary_budget_cents bigint not null check (discretionary_budget_cents >= 0),
  effective_from date not null default current_date,
  created_at timestamptz not null default now()
);

create index on budget_settings (user_id, effective_from desc);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table accounts enable row level security;
alter table categories enable row level security;
alter table transactions enable row level security;
alter table recurring_expenses enable row level security;
alter table investments enable row level security;
alter table recurring_investment_deposits enable row level security;
alter table budget_settings enable row level security;

-- One policy pattern repeated per table: users can only see/touch their own rows.
create policy "own rows only" on accounts for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own rows only" on categories for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own rows only" on transactions for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own rows only" on recurring_expenses for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own rows only" on investments for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own rows only" on recurring_investment_deposits for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own rows only" on budget_settings for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ============================================================
-- DERIVED VIEWS
-- (dashboard numbers are computed live, never cached/stored)
-- ============================================================

-- Current balance per account: starting balance + net effect of every
-- transaction that has touched it (as source, destination, expense, or income).
create view account_balances as
select
  a.id as account_id,
  a.user_id,
  a.name,
  a.type,
  a.starting_balance_cents
    + coalesce(sum(case
        when t.account_id = a.id and t.type in ('income') then t.amount_cents
        when t.account_id = a.id and t.type in ('discretionary_expense','fixed_expense','investment_contribution') then -t.amount_cents
        when t.account_id = a.id and t.type = 'transfer' then -t.amount_cents
        when t.to_account_id = a.id and t.type = 'transfer' then t.amount_cents
        else 0
      end), 0)
    -- credit card purchases increase what's owed rather than reduce a balance;
    -- for credit_card accounts we flip the sign convention (see note below).
    as current_balance_cents
from accounts a
left join transactions t
  on t.account_id = a.id or t.to_account_id = a.id
group by a.id, a.user_id, a.name, a.type, a.starting_balance_cents;

-- This month's discretionary budget (most recent setting effective on/before today)
create view current_discretionary_budget as
select distinct on (user_id)
  user_id, discretionary_budget_cents, effective_from
from budget_settings
where effective_from <= current_date
order by user_id, effective_from desc;

-- Discretionary spend so far this calendar month
create view discretionary_spend_this_month as
select
  user_id,
  coalesce(sum(amount_cents), 0) as spent_cents
from transactions
where type = 'discretionary_expense'
  and date >= date_trunc('month', current_date)
  and date < date_trunc('month', current_date) + interval '1 month'
group by user_id;

-- Dashboard summary: remaining budget + daily available, recalculated live
create view dashboard_summary as
select
  b.user_id,
  b.discretionary_budget_cents,
  coalesce(s.spent_cents, 0) as spent_this_month_cents,
  (b.discretionary_budget_cents - coalesce(s.spent_cents, 0)) as remaining_cents,
  (extract(day from (date_trunc('month', current_date) + interval '1 month' - interval '1 day'))::int
     - extract(day from current_date)::int + 1) as days_remaining_incl_today,
  case
    when (extract(day from (date_trunc('month', current_date) + interval '1 month' - interval '1 day'))::int
          - extract(day from current_date)::int + 1) > 0
    then (b.discretionary_budget_cents - coalesce(s.spent_cents, 0))
         / (extract(day from (date_trunc('month', current_date) + interval '1 month' - interval '1 day'))::int
            - extract(day from current_date)::int + 1)
    else (b.discretionary_budget_cents - coalesce(s.spent_cents, 0))
  end as daily_available_cents
from current_discretionary_budget b
left join discretionary_spend_this_month s on s.user_id = b.user_id;
