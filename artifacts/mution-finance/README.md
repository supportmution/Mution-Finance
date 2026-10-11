# Mution Finance

Internal finance tracker for Mution.tech. The app uses Supabase Auth and
Postgres, with the browser restricted to the Supabase public anon key and
database access enforced by row-level security.

## Supabase setup

1. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` to Replit Secrets. The
   anon key is intended for browser clients; never use `service_role`.
2. Run these files in order in the Supabase SQL Editor:
   - `supabase/migrations/202610070001_finance_schema.sql`
   - `supabase/migrations/202610110001_internal_finance_ledger.sql`
3. In Supabase Auth, enable email/password sign-in and add the app's preview
   and published domains to the allowed redirect URLs.
4. To bootstrap the first owner/admin account (including an `@mution.tech`
   account), replace the example email below and run it in the Supabase SQL Editor:

   ```sql
   insert into public.finance_allowed_emails (email, role)
   values (lower('founder@example.com'), 'ADMIN')
   on conflict (email) do update set role = excluded.role;
   ```

   Users with an `@mution.tech` email can sign in after they have been invited
   or created in Supabase Auth. Accounts not listed in the allowlist have
   `MEMBER` access; only an email in `finance_allowed_emails` with the `ADMIN`
   role can manage categories, budgets, and the opening cash balance.
5. Once the first admin can sign in, additional allowed emails and roles can be
   managed from **Pengaturan → Akses tim**. The person must still have an
   account in Supabase Auth; invite or create that account from the Supabase
   dashboard.

## Internal finance ledger

- **Pemasukan/pengeluaran usaha** and loan interest affect the profit-and-loss
  report. Owner capital, owner withdrawals, loan principal, and asset/investment
  purchases are separate cash movements, not operating revenue or expenses.
- **Laba ditahan** is calculated from recorded operating profit, less owner
  withdrawals. It is not entered a second time as new capital.
- Set **Saldo awal kas** and its start date in **Pengaturan** before relying on
  the cash balance. The current balance combines that opening amount with all
  recorded cash movements from that date across cash and bank accounts;
  balances are currently shown as one combined total, and earlier transactions
  are excluded from the balance calculation.
- Loan receipts and principal repayments are tracked in aggregate by
  transaction type; the app does not yet track a separate schedule for each
  loan or formal accounting/tax statements.

## Local preview

Without both Supabase environment variables, the app runs in an explicitly
labelled demo mode and stores sample edits in that browser's local storage.
Once configured, all finance records are read and written through Supabase;
there is no silent switch to demo data when a database request fails.
