# Ledger

Private personal-finance PWA. Next.js 14 (App Router) + Supabase (auth, Postgres, RLS). One codebase, installable on desktop and mobile.

## Setup

1. **Create a Supabase project** at supabase.com.
2. **Run the schema**: open the SQL editor in your Supabase project and run the contents of `schema.sql`. This creates every table, the RLS policies (each table is locked to `auth.uid()`), and the derived views the dashboard reads from (`dashboard_summary`, `account_balances`, etc.).
3. **Enable email OTP auth**: in Supabase → Authentication → Providers, make sure Email is enabled (magic link / OTP, no password — that's what `app/login/page.js` uses).
4. **Set redirect URL**: in Authentication → URL Configuration, add your deployed URL (and `http://localhost:3000` for local dev) to the redirect allow list.
5. **Env vars**: copy `.env.local.example` to `.env.local` and fill in your project URL + anon key (Project Settings → API).
6. **Install & run**:
   ```
   npm install
   npm run dev
   ```

## Deploying so it installs as a PWA on your phone

Push this repo to GitHub, then import it into Vercel (vercel.com → New Project → import the repo). Add the same two env vars in Vercel's project settings. Once deployed, open the URL on your phone — Chrome/Safari will offer "Add to Home Screen," which installs it using `public/manifest.json` and the icons in `public/`.

## How the numbers work

- All money is stored as integer cents (`bigint`) — never floats — see `lib/money.js`.
- Account balances are never stored directly; they're derived live from `starting_balance_cents` + every transaction that has touched the account (`account_balances` view in `schema.sql`). Editing or deleting a past transaction automatically keeps balances correct.
- The monthly discretionary budget is versioned by `effective_from` in `budget_settings`, so changing it today doesn't rewrite history.
- "Available today" = remaining discretionary budget ÷ days left in the month (including today), recalculated live from `dashboard_summary` — so it self-corrects if you overspend or underspend on a given day.

## What's built

- Magic-link auth (`app/login`, `middleware.js` gates every route except `/login` and `/auth`)
- Overview dashboard: available-today, monthly budget (editable), recent transactions, category breakdown, add-transaction FAB
- Add/edit transaction sheet with calculator-style amount entry, custom categories, all five transaction types (discretionary/fixed/income/investment/transfer)
- Accounts page: net worth, per-account balances, add account
- Stats page: month-by-month income/expense/invested totals, category breakdown, investment values

## Not yet built

- Editing/deleting existing transactions from the Recent list (insert works; the schema and `AddTransactionSheet` already support passing an `initial` transaction to switch it into edit mode — just needs a tap handler wired up on each row)
- Recurring fixed expenses / recurring investment deposits (tables exist in `schema.sql`, no UI yet)
- Manually updating an investment's current value (table exists, no UI yet — needed before Stats' investment totals are meaningful)
- Archiving accounts/categories from the UI (the `is_archived` columns exist; nothing toggles them)
