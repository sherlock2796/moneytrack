-- MoneyTrack — schema Supabase
-- Esegui questo script nel SQL Editor del tuo progetto Supabase (una sola volta).
-- Ogni tabella ha user_id = utente proprietario; le policy RLS garantiscono che
-- ogni utente veda e modifichi SOLO le proprie righe.

create table if not exists public.accounts (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  icon text,
  color text,
  initial_balance numeric(12,2) default 0,
  include_in_total boolean default true,
  sort integer default 0,
  archived boolean default false,
  updated_at timestamptz not null default now(),
  deleted boolean not null default false
);

create table if not exists public.categories (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  type text not null check (type in ('expense','income')),
  name text not null,
  icon text,
  color text,
  budget numeric(12,2) default 0,
  budget_period text default 'month' check (budget_period in ('month','year')),
  sort integer default 0,
  archived boolean default false,
  updated_at timestamptz not null default now(),
  deleted boolean not null default false
);

create table if not exists public.transactions (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  type text not null check (type in ('expense','income','transfer')),
  amount numeric(12,2) not null default 0,
  date date not null,
  category_id uuid,
  account_id uuid,
  to_account_id uuid,
  note text default '',
  is_recurring boolean default false,
  recurring_id uuid,
  updated_at timestamptz not null default now(),
  deleted boolean not null default false
);

create table if not exists public.recurring (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  type text not null default 'expense',
  amount numeric(12,2) not null default 0,
  category_id uuid,
  account_id uuid,
  to_account_id uuid,
  note text default '',
  frequency text not null default 'monthly',
  next_date date,
  active boolean default true,
  updated_at timestamptz not null default now(),
  deleted boolean not null default false
);

create table if not exists public.settings (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  key text not null,
  value jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, key)
);

create index if not exists transactions_user_updated on public.transactions (user_id, updated_at);
create index if not exists transactions_user_date on public.transactions (user_id, date);
create index if not exists accounts_user_updated on public.accounts (user_id, updated_at);
create index if not exists categories_user_updated on public.categories (user_id, updated_at);
create index if not exists recurring_user_updated on public.recurring (user_id, updated_at);

alter table public.accounts enable row level security;
alter table public.categories enable row level security;
alter table public.transactions enable row level security;
alter table public.recurring enable row level security;
alter table public.settings enable row level security;

do $$
declare t text;
begin
  foreach t in array array['accounts','categories','transactions','recurring','settings'] loop
    execute format('drop policy if exists "own rows" on public.%I', t);
    execute format('create policy "own rows" on public.%I for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid())', t);
  end loop;
end $$;
