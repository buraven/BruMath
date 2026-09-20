create table public.households (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.household_members (
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'member')),
  primary key (household_id, user_id)
);

create table public.financial_settings (
  household_id uuid primary key references public.households(id) on delete cascade,
  income numeric(14,2) not null default 0 check (income >= 0),
  budgets jsonb not null default '{}'::jsonb,
  limits jsonb not null default '{}'::jsonb,
  personal_limits jsonb not null default '{}'::jsonb,
  active_profile text not null default 'Bruna' check (active_profile in ('Bruna', 'Matheus', 'Casal')),
  view_month date not null default date_trunc('month', current_date)::date,
  updated_at timestamptz not null default now()
);

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  legacy_id bigint not null,
  title text not null check (length(trim(title)) > 0),
  category text not null check (length(trim(category)) > 0),
  responsible text not null check (responsible in ('Bruna', 'Matheus', 'Casal')),
  amount numeric(14,2) not null check (amount >= 0),
  occurred_on date not null,
  personal_limit_bucket text check (personal_limit_bucket in ('bruna_nails', 'bruna_personal', 'matheus_personal')),
  credit_card_legacy_id bigint,
  created_at timestamptz not null default now(),
  unique (household_id, legacy_id)
);

create table public.installments (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  legacy_id bigint not null,
  title text not null,
  category text not null,
  responsible text not null check (responsible in ('Bruna', 'Matheus', 'Casal')),
  amount numeric(14,2) not null check (amount >= 0),
  total_installments integer not null check (total_installments > 0),
  paid_installments integer not null default 0 check (paid_installments >= 0 and paid_installments <= total_installments),
  next_due date not null,
  credit_card_legacy_id bigint,
  unique (household_id, legacy_id)
);

create table public.receivables (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  legacy_id bigint not null,
  person text not null,
  amount numeric(14,2) not null check (amount >= 0),
  paid numeric(14,2) not null default 0 check (paid >= 0 and paid <= amount),
  destination text not null check (destination in ('cartao', 'bruna', 'matheus', 'casal')),
  note text not null default '',
  competence_month date not null,
  received_month date,
  unique (household_id, legacy_id)
);

create table public.income_entries (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  legacy_id bigint not null,
  title text not null,
  amount numeric(14,2) not null check (amount >= 0),
  responsible text not null check (responsible in ('Bruna', 'Matheus', 'Casal')),
  occurred_on date not null,
  destination text not null check (destination in ('conta', 'cartao')),
  note text not null default '',
  unique (household_id, legacy_id)
);

create table public.credit_cards (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  legacy_id bigint not null,
  name text not null,
  issuer text,
  owner text not null check (owner in ('Bruna', 'Matheus', 'Casal')),
  credit_limit numeric(14,2) not null check (credit_limit >= 0),
  closing_day integer not null check (closing_day between 1 and 31),
  due_day integer not null check (due_day between 1 and 31),
  appearance text check (appearance in ('purple', 'orange', 'blue')),
  active boolean not null default true,
  unique (household_id, legacy_id)
);

create table public.invoice_payments (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  legacy_id bigint not null,
  card_legacy_id bigint not null,
  reference_month date not null,
  paid_at date not null,
  amount numeric(14,2) not null check (amount > 0),
  unique (household_id, legacy_id)
);

create table public.local_imports (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  source_hash text not null,
  imported_at timestamptz not null default now(),
  summary jsonb not null,
  unique (household_id, source_hash)
);

create index household_members_user_id_idx on public.household_members(user_id);
create index expenses_household_date_idx on public.expenses(household_id, occurred_on);
create index installments_household_due_idx on public.installments(household_id, next_due);
create index income_entries_household_date_idx on public.income_entries(household_id, occurred_on);

alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.financial_settings enable row level security;
alter table public.expenses enable row level security;
alter table public.installments enable row level security;
alter table public.receivables enable row level security;
alter table public.income_entries enable row level security;
alter table public.credit_cards enable row level security;
alter table public.invoice_payments enable row level security;
alter table public.local_imports enable row level security;

create function public.is_household_member(target_household_id uuid)
returns boolean language sql stable security invoker set search_path = '' as $$
  select exists (
    select 1 from public.household_members m
    where m.household_id = target_household_id and m.user_id = (select auth.uid())
  );
$$;

grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;

create policy "members manage household" on public.households for all to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy "members read own membership" on public.household_members for select to authenticated
  using (user_id = (select auth.uid()));
create policy "owners manage membership" on public.household_members for all to authenticated
  using (exists (select 1 from public.households h where h.id = household_id and h.owner_id = (select auth.uid())))
  with check (exists (select 1 from public.households h where h.id = household_id and h.owner_id = (select auth.uid())));

create policy "members manage settings" on public.financial_settings for all to authenticated
  using (public.is_household_member(household_id)) with check (public.is_household_member(household_id));
create policy "members manage expenses" on public.expenses for all to authenticated
  using (public.is_household_member(household_id)) with check (public.is_household_member(household_id));
create policy "members manage installments" on public.installments for all to authenticated
  using (public.is_household_member(household_id)) with check (public.is_household_member(household_id));
create policy "members manage receivables" on public.receivables for all to authenticated
  using (public.is_household_member(household_id)) with check (public.is_household_member(household_id));
create policy "members manage income entries" on public.income_entries for all to authenticated
  using (public.is_household_member(household_id)) with check (public.is_household_member(household_id));
create policy "members manage cards" on public.credit_cards for all to authenticated
  using (public.is_household_member(household_id)) with check (public.is_household_member(household_id));
create policy "members manage invoice payments" on public.invoice_payments for all to authenticated
  using (public.is_household_member(household_id)) with check (public.is_household_member(household_id));
create policy "members manage imports" on public.local_imports for all to authenticated
  using (public.is_household_member(household_id)) with check (public.is_household_member(household_id));
