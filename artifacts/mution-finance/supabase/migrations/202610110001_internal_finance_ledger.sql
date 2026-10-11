-- Separate operating performance from owner funding, debt, and investments.
-- Run after 202610070001_finance_schema.sql.

do $$ begin
  create type public.finance_transaction_purpose as enum (
    'OPERATING',
    'OWNER_CAPITAL',
    'OWNER_WITHDRAWAL',
    'LOAN_RECEIVED',
    'LOAN_PRINCIPAL_REPAYMENT',
    'LOAN_INTEREST',
    'ASSET_PURCHASE'
  );
exception
  when duplicate_object then null;
end $$;

alter table public.transactions
  add column if not exists purpose public.finance_transaction_purpose
  not null default 'OPERATING';

alter table public.transactions
  alter column category_id drop not null;

alter table public.transactions
  drop constraint if exists transactions_purpose_direction_check;
alter table public.transactions
  add constraint transactions_purpose_direction_check check (
    (purpose in ('OPERATING', 'OWNER_CAPITAL', 'LOAN_RECEIVED') and type = 'INCOME')
    or (
      purpose in (
        'OPERATING',
        'OWNER_WITHDRAWAL',
        'LOAN_PRINCIPAL_REPAYMENT',
        'LOAN_INTEREST',
        'ASSET_PURCHASE'
      )
      and type = 'EXPENSE'
    )
  );

alter table public.transactions
  drop constraint if exists transactions_purpose_category_check;
alter table public.transactions
  add constraint transactions_purpose_category_check check (
    (purpose = 'OPERATING' and category_id is not null)
    or (purpose <> 'OPERATING' and category_id is null)
  );

create table if not exists public.finance_settings (
  id boolean primary key default true check (id),
  opening_balance numeric(16, 2) not null default 0 check (opening_balance >= 0),
  opening_date date not null default current_date,
  updated_at timestamptz not null default now()
);

insert into public.finance_settings (id, opening_balance, opening_date)
values (
  true,
  0,
  coalesce((select min(date)::date from public.transactions), current_date)
)
on conflict (id) do nothing;

drop trigger if exists finance_settings_stamp_updated_at
  on public.finance_settings;
create trigger finance_settings_stamp_updated_at
  before update on public.finance_settings
  for each row execute function public.finance_stamp_updated_at();

alter table public.finance_settings enable row level security;

drop policy if exists "Authorized users can read finance settings"
  on public.finance_settings;
create policy "Authorized users can read finance settings"
  on public.finance_settings for select to authenticated
  using (public.finance_is_authorized());

drop policy if exists "Finance admins can manage finance settings"
  on public.finance_settings;
create policy "Finance admins can manage finance settings"
  on public.finance_settings for all to authenticated
  using (public.finance_is_authorized() and public.finance_is_admin())
  with check (public.finance_is_authorized() and public.finance_is_admin());

grant select, insert, update on public.finance_settings to authenticated;
revoke delete on public.finance_settings from anon, authenticated;
