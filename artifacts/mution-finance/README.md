# Mution Finance

Internal finance tracker for Mution.tech. The app uses Supabase Auth and
Postgres, with the browser restricted to the Supabase public anon key and
database access enforced by row-level security.

## Supabase setup

1. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` to Replit Secrets. The
   anon key is intended for browser clients; never use `service_role`.
2. Run `supabase/migrations/202610070001_finance_schema.sql` in the Supabase
   SQL Editor.
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
   role can manage categories and budgets.
5. Once the first admin can sign in, additional allowed emails and roles can be
   managed from **Pengaturan → Akses tim**. The person must still have an
   account in Supabase Auth; invite or create that account from the Supabase
   dashboard.

## Local preview

Without both Supabase environment variables, the app runs in an explicitly
labelled demo mode and stores sample edits in that browser's local storage.
Once configured, all finance records are read and written through Supabase;
there is no silent switch to demo data when a database request fails.
