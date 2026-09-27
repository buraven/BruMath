-- A schedule is intentionally additive: legacy installments remain without
-- rows until a future writer creates schedules for new plans.

alter table public.installments
  add constraint installments_household_id_id_key unique (household_id, id);

alter table public.credit_cards
  add constraint credit_cards_household_id_id_key unique (household_id, id);

create table public.installment_schedule_items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  legacy_id text not null,
  installment_id uuid not null,
  installment_number integer not null check (installment_number >= 1),
  total_installments integer not null check (total_installments >= 1),
  amount numeric(14,2) not null check (amount >= 0),
  invoice_reference_month date,
  due_date date,
  credit_card_id uuid,
  status text not null check (status in ('scheduled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint installment_schedule_number_within_plan
    check (installment_number <= total_installments),
  constraint installment_schedule_legacy_unique unique (household_id, legacy_id),
  constraint installment_schedule_plan_number_unique
    unique (household_id, installment_id, installment_number),
  constraint installment_schedule_installment_household_fk
    foreign key (household_id, installment_id)
    references public.installments(household_id, id)
    on delete restrict,
  constraint installment_schedule_card_household_fk
    foreign key (household_id, credit_card_id)
    references public.credit_cards(household_id, id)
    on delete restrict
);

create index installment_schedule_household_installment_idx
  on public.installment_schedule_items(household_id, installment_id);
create index installment_schedule_household_card_idx
  on public.installment_schedule_items(household_id, credit_card_id)
  where credit_card_id is not null;
create index installment_schedule_household_reference_month_idx
  on public.installment_schedule_items(household_id, invoice_reference_month)
  where invoice_reference_month is not null;
create index installment_schedule_household_status_idx
  on public.installment_schedule_items(household_id, status);

alter table public.installment_schedule_items enable row level security;

create policy "members manage installment schedules"
  on public.installment_schedule_items for all to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

revoke all on table public.installment_schedule_items from public;
revoke all on table public.installment_schedule_items from anon;
grant select, insert, update, delete on table public.installment_schedule_items to authenticated;
