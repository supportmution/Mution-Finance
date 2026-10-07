-- Mution Finance schema for Supabase.
-- Run this file in Supabase Dashboard > SQL Editor before signing in.

do $$ begin
  create type public.finance_transaction_type as enum ('INCOME', 'EXPENSE');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.finance_allowed_emails (
  email text primary key check (email = lower(email)),
  role text not null default 'MEMBER' check (role in ('ADMIN', 'MEMBER')),
  created_at timestamptz not null default now()
);

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  type public.finance_transaction_type not null,
  color text not null default '#F3A26F'
    check (color ~ '^#[0-9A-Fa-f]{6}$'),
  cost_class text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint categories_cost_class_check check (
    (type = 'INCOME' and cost_class is null)
    or (
      type = 'EXPENSE'
      and cost_class is not null
      and cost_class in ('DIRECT', 'OPERATING')
    )
  ),
  constraint categories_name_type_unique unique (name, type),
  constraint categories_id_type_unique unique (id, type)
);

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  date timestamptz not null default now(),
  type public.finance_transaction_type not null,
  category_id uuid not null,
  amount numeric(16, 2) not null check (amount > 0),
  description text not null check (length(trim(description)) > 0),
  payment_method text,
  receipt_url text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint transactions_category_type_fkey
    foreign key (category_id, type)
    references public.categories(id, type)
    on update restrict
);

create table if not exists public.budgets (
  id uuid primary key default gen_random_uuid(),
  month_year date not null
    check (month_year = date_trunc('month', month_year)::date),
  category_id uuid not null,
  category_type public.finance_transaction_type
    generated always as ('EXPENSE'::public.finance_transaction_type) stored,
  limit_amount numeric(16, 2) not null check (limit_amount > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint budgets_expense_category_fkey
    foreign key (category_id, category_type)
    references public.categories(id, type)
    on update restrict
    on delete restrict,
  constraint budgets_month_category_unique unique (month_year, category_id)
);

create index if not exists transactions_date_idx
  on public.transactions (date desc);
create index if not exists transactions_type_date_idx
  on public.transactions (type, date desc);
create index if not exists transactions_category_date_idx
  on public.transactions (category_id, date desc);
create index if not exists budgets_month_idx
  on public.budgets (month_year);

create or replace function public.finance_is_authorized()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    lower(coalesce(auth.jwt() ->> 'email', '')) like '%@mution.tech'
    or exists (
      select 1
      from public.finance_allowed_emails allowed
      where allowed.email = lower(coalesce(auth.jwt() ->> 'email', ''))
    );
$$;

create or replace function public.finance_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.finance_allowed_emails allowed
    where allowed.email = lower(coalesce(auth.jwt() ->> 'email', ''))
      and allowed.role = 'ADMIN'
  );
$$;

create or replace function public.finance_list_allowed_emails()
returns table (email text, role text, created_at timestamptz)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.finance_is_authorized() or not public.finance_is_admin() then
    raise exception 'Finance admin access required';
  end if;
  return query
    select allowed.email, allowed.role, allowed.created_at
    from public.finance_allowed_emails as allowed
    order by allowed.email;
end;
$$;

create or replace function public.finance_add_allowed_email(
  p_email text,
  p_role text default 'MEMBER'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_email text := lower(trim(p_email));
  old_role text;
  admin_count integer;
begin
  if not public.finance_is_authorized() or not public.finance_is_admin() then
    raise exception 'Finance admin access required';
  end if;
  if normalized_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'A valid email address is required';
  end if;
  if p_role not in ('ADMIN', 'MEMBER') then
    raise exception 'Role must be ADMIN or MEMBER';
  end if;

  select allowed.role into old_role
  from public.finance_allowed_emails as allowed
  where allowed.email = normalized_email;
  if old_role = 'ADMIN' and p_role = 'MEMBER' then
    select count(*) into admin_count
    from public.finance_allowed_emails as allowed
    where allowed.role = 'ADMIN';
    if admin_count <= 1 then
      raise exception 'The last finance admin cannot be demoted';
    end if;
  end if;

  insert into public.finance_allowed_emails (email, role)
  values (normalized_email, p_role)
  on conflict (email) do update set role = excluded.role;
end;
$$;

create or replace function public.finance_remove_allowed_email(p_email text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_email text := lower(trim(p_email));
  target_role text;
  admin_count integer;
begin
  if not public.finance_is_authorized() or not public.finance_is_admin() then
    raise exception 'Finance admin access required';
  end if;

  select allowed.role into target_role
  from public.finance_allowed_emails as allowed
  where allowed.email = normalized_email;
  if target_role = 'ADMIN' then
    select count(*) into admin_count
    from public.finance_allowed_emails as allowed
    where allowed.role = 'ADMIN';
    if admin_count <= 1 then
      raise exception 'The last finance admin cannot be removed';
    end if;
  end if;

  delete from public.finance_allowed_emails as allowed
  where allowed.email = normalized_email;
end;
$$;

create or replace function public.finance_stamp_transaction()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    new.created_by := auth.uid();
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.finance_stamp_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists transactions_stamp_actor on public.transactions;
create trigger transactions_stamp_actor
  before insert or update on public.transactions
  for each row execute function public.finance_stamp_transaction();

drop trigger if exists categories_stamp_updated_at on public.categories;
create trigger categories_stamp_updated_at
  before update on public.categories
  for each row execute function public.finance_stamp_updated_at();

drop trigger if exists budgets_stamp_updated_at on public.budgets;
create trigger budgets_stamp_updated_at
  before update on public.budgets
  for each row execute function public.finance_stamp_updated_at();

revoke all on function public.finance_is_authorized() from public;
revoke all on function public.finance_is_admin() from public;
revoke all on function public.finance_list_allowed_emails() from public;
revoke all on function public.finance_add_allowed_email(text, text) from public;
revoke all on function public.finance_remove_allowed_email(text) from public;
grant execute on function public.finance_is_authorized() to authenticated;
grant execute on function public.finance_is_admin() to authenticated;
grant execute on function public.finance_list_allowed_emails() to authenticated;
grant execute on function public.finance_add_allowed_email(text, text) to authenticated;
grant execute on function public.finance_remove_allowed_email(text) to authenticated;

alter table public.finance_allowed_emails enable row level security;
alter table public.categories enable row level security;
alter table public.transactions enable row level security;
alter table public.budgets enable row level security;

drop policy if exists "Authorized users can read categories" on public.categories;
create policy "Authorized users can read categories"
  on public.categories for select to authenticated
  using (public.finance_is_authorized());

drop policy if exists "Finance admins can manage categories" on public.categories;
create policy "Finance admins can manage categories"
  on public.categories for all to authenticated
  using (public.finance_is_authorized() and public.finance_is_admin())
  with check (public.finance_is_authorized() and public.finance_is_admin());

drop policy if exists "Authorized users can read transactions" on public.transactions;
create policy "Authorized users can read transactions"
  on public.transactions for select to authenticated
  using (public.finance_is_authorized());

drop policy if exists "Authorized users can add transactions" on public.transactions;
create policy "Authorized users can add transactions"
  on public.transactions for insert to authenticated
  with check (public.finance_is_authorized() and created_by = auth.uid());

drop policy if exists "Authorized users can update transactions" on public.transactions;
create policy "Authorized users can update transactions"
  on public.transactions for update to authenticated
  using (public.finance_is_authorized())
  with check (public.finance_is_authorized());

drop policy if exists "Authorized users can delete transactions" on public.transactions;
create policy "Authorized users can delete transactions"
  on public.transactions for delete to authenticated
  using (public.finance_is_authorized());

drop policy if exists "Authorized users can read budgets" on public.budgets;
create policy "Authorized users can read budgets"
  on public.budgets for select to authenticated
  using (public.finance_is_authorized());

drop policy if exists "Finance admins can manage budgets" on public.budgets;
create policy "Finance admins can manage budgets"
  on public.budgets for all to authenticated
  using (public.finance_is_authorized() and public.finance_is_admin())
  with check (public.finance_is_authorized() and public.finance_is_admin());

grant select, insert, update, delete on public.categories to authenticated;
grant select, insert, update, delete on public.transactions to authenticated;
grant select, insert, update, delete on public.budgets to authenticated;
revoke all on public.finance_allowed_emails from anon, authenticated;

insert into public.categories (name, type, color, cost_class)
values
  ('Pendapatan', 'INCOME', '#48A985', null),
  ('Server & Cloud', 'EXPENSE', '#F39B62', 'DIRECT'),
  ('AI & API', 'EXPENSE', '#E9B95C', 'DIRECT'),
  ('Gaji & Tim', 'EXPENSE', '#8E91D1', 'OPERATING'),
  ('Marketing', 'EXPENSE', '#E78383', 'OPERATING'),
  ('Langganan Tools', 'EXPENSE', '#6DA6CE', 'OPERATING')
on conflict (name, type) do nothing;
