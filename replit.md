# Mution Finance

Internal finance workspace for Mution.tech to record income and expenses, review cash flow, and analyze monthly profitability.

## Run & Operate

- `pnpm --filter @workspace/mution-finance run dev` — run the finance app through its managed workflow
- `pnpm --filter @workspace/mution-finance run typecheck` — typecheck the finance app
- `pnpm run typecheck` — typecheck the workspace
- Run `artifacts/mution-finance/supabase/migrations/202610070001_finance_schema.sql` in the Supabase SQL Editor to initialize its schema
- Required environment: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (Replit Secrets; see `artifacts/mution-finance/.env.example`)

## Stack

- React, Vite, TypeScript, Tailwind CSS, TanStack Query, Wouter
- Supabase Auth and PostgreSQL through `@supabase/supabase-js`
- The finance app uses the Supabase project specified by its environment variables; it does not store finance records in the workspace's starter database.

## Where things live

- `artifacts/mution-finance/src/pages/finance.tsx` — dashboard, transactions, reports, settings, and login
- `artifacts/mution-finance/src/lib/finance-data.ts` — Supabase queries, mutations, and explicitly labelled local demo mode
- `artifacts/mution-finance/src/lib/auth.tsx` — Supabase session and access checks
- `artifacts/mution-finance/src/index.css` — light white and soft-orange theme
- `artifacts/mution-finance/supabase/migrations/` — Supabase schema, RLS, authorization functions, and starter categories

## Architecture decisions

- Finance data stays in Supabase, separate from Mution's product systems, as requested.
- The browser uses only Supabase's public anon key; row-level security is the authorization boundary. Never use a `service_role` key in this app.
- The cash balance is the net total of transactions recorded in this ledger, not a synced bank balance.
- `@mution.tech` accounts may use the finance ledger. Any owner/admin email, including an `@mution.tech` account, must be added to `finance_allowed_emails` with the `ADMIN` role to edit categories and budgets.

## Product

- Monthly dashboard with income, expenses, net profit, recorded cash balance, six-month cash flow, expense categories, and recent activity.
- Transaction ledger with month/type/category/search filters and create, edit, and delete actions.
- Monthly profit-and-loss report with CSV export.
- Category management, optional per-category monthly budgets, team access roles, and password updates.
- Supabase email/password access with restricted finance-data policies.

## User preferences

- Keep the UI light, with white surfaces and soft orange accents.

## Gotchas

- Supabase's SQL migration must be run in the user's Supabase project before the app can read or write finance tables.
- Supabase Auth email/password sign-in must be enabled, and the preview/published URLs must be listed in allowed redirect URLs.
- Only `@mution.tech` users or addresses in `finance_allowed_emails` can access finance records. Bootstrap the first owner/admin as `ADMIN` with the SQL snippet in `artifacts/mution-finance/README.md`; manage subsequent access in Settings. New members still need a Supabase Auth account.
- If changing frontend dependencies, restart the managed `artifacts/mution-finance: web` workflow.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
