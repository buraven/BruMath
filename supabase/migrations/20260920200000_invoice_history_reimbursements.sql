-- Historical invoice facts are deliberately separate from expenses. All
-- columns are additive so snapshots written before this migration remain valid.
alter table public.expenses add column if not exists invoice_reference_month date;

create table public.invoice_adjustments (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  legacy_id bigint not null,
  card_legacy_id bigint not null,
  reference_month date not null,
  adjustment_type text not null check (adjustment_type in ('previous_balance','credit','debit','reversal','discount','installment_anticipation_discount')),
  amount numeric(14,2) not null,
  description text not null,
  occurred_on date,
  unique (household_id, legacy_id)
);

create table public.installment_invoice_events (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  legacy_id bigint not null,
  installment_legacy_id bigint not null,
  card_legacy_id bigint not null,
  reference_month date not null,
  installment_number integer not null check (installment_number > 0),
  amount numeric(14,2) not null check (amount >= 0),
  event_type text not null check (event_type in ('regular','anticipated','historical')),
  occurred_on date,
  unique (household_id, legacy_id)
);

create table public.installment_reimbursement_allocations (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  legacy_id bigint not null,
  installment_legacy_id bigint not null,
  person text not null,
  installment_number integer not null check (installment_number > 0),
  amount numeric(14,2) not null check (amount >= 0),
  expected_month date not null,
  status text not null check (status in ('future','due','received','cancelled')),
  debt_legacy_id bigint,
  unique (household_id, legacy_id)
);

create index invoice_adjustments_household_cycle_idx on public.invoice_adjustments(household_id, card_legacy_id, reference_month);
create index installment_invoice_events_household_cycle_idx on public.installment_invoice_events(household_id, card_legacy_id, reference_month);
create index installment_reimbursement_allocations_household_month_idx on public.installment_reimbursement_allocations(household_id, expected_month);

alter table public.invoice_adjustments enable row level security;
alter table public.installment_invoice_events enable row level security;
alter table public.installment_reimbursement_allocations enable row level security;
grant select, insert, update, delete on public.invoice_adjustments, public.installment_invoice_events, public.installment_reimbursement_allocations to authenticated;
create policy "members manage invoice adjustments" on public.invoice_adjustments for all to authenticated using (public.is_household_member(household_id)) with check (public.is_household_member(household_id));
create policy "members manage installment invoice events" on public.installment_invoice_events for all to authenticated using (public.is_household_member(household_id)) with check (public.is_household_member(household_id));
create policy "members manage reimbursement allocations" on public.installment_reimbursement_allocations for all to authenticated using (public.is_household_member(household_id)) with check (public.is_household_member(household_id));

-- v2 extends the already-audited atomic replacement. PostgreSQL functions run
-- in one transaction, so any validation/upsert/reconciliation failure rolls
-- back both the original snapshot and these new collections.
create or replace function public.replace_financial_snapshot_v2(
  p_household_id uuid, p_snapshot jsonb, p_revision_hash text
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_user_id uuid := (select auth.uid());
  v_result jsonb;
  v_collection text;
begin
  if v_user_id is null then raise exception 'authentication is required'; end if;
  if not public.is_household_member(p_household_id) then raise exception 'household membership is required'; end if;
  foreach v_collection in array array['invoice_adjustments','installment_invoice_events','installment_reimbursement_allocations'] loop
    if jsonb_typeof(coalesce(p_snapshot -> v_collection, '[]'::jsonb)) <> 'array' then raise exception 'snapshot collection % must be an array', v_collection; end if;
    if exists (select 1 from jsonb_array_elements(coalesce(p_snapshot -> v_collection, '[]'::jsonb)) item(value) where jsonb_typeof(item.value -> 'legacy_id') <> 'number') then raise exception 'snapshot collection % has an invalid legacy id', v_collection; end if;
    if (select count(*) <> count(distinct (item.value ->> 'legacy_id')::bigint) from jsonb_array_elements(coalesce(p_snapshot -> v_collection, '[]'::jsonb)) item(value)) then raise exception 'snapshot collection % has duplicate legacy ids', v_collection; end if;
  end loop;
  if exists (select 1 from jsonb_array_elements(coalesce(p_snapshot -> 'invoice_adjustments','[]'::jsonb)) item(value) where not exists (select 1 from jsonb_array_elements(p_snapshot -> 'credit_cards') card(value) where (card.value ->> 'legacy_id')::bigint = (item.value ->> 'card_legacy_id')::bigint)) then raise exception 'adjustment references a missing credit card'; end if;
  if exists (select 1 from jsonb_array_elements(coalesce(p_snapshot -> 'installment_invoice_events','[]'::jsonb)) item(value) where not exists (select 1 from jsonb_array_elements(p_snapshot -> 'installments') installment(value) where (installment.value ->> 'legacy_id')::bigint = (item.value ->> 'installment_legacy_id')::bigint)) then raise exception 'event references a missing installment'; end if;
  if exists (select 1 from jsonb_array_elements(coalesce(p_snapshot -> 'installment_reimbursement_allocations','[]'::jsonb)) item(value) where not exists (select 1 from jsonb_array_elements(p_snapshot -> 'installments') installment(value) where (installment.value ->> 'legacy_id')::bigint = (item.value ->> 'installment_legacy_id')::bigint)) then raise exception 'allocation references a missing installment'; end if;

  -- First replace the original collections. Its validation/reconciliation is
  -- retained; all changes below remain in the same transaction.
  v_result := public.replace_financial_snapshot(p_household_id, p_snapshot, p_revision_hash);
  update public.expenses current
     set invoice_reference_month = nullif(item.value ->> 'invoice_reference_month','')::date
    from jsonb_array_elements(p_snapshot -> 'expenses') item(value)
   where current.household_id = p_household_id
     and current.legacy_id = (item.value ->> 'legacy_id')::bigint;
  delete from public.invoice_adjustments current where current.household_id = p_household_id and not exists (select 1 from jsonb_array_elements(coalesce(p_snapshot -> 'invoice_adjustments','[]'::jsonb)) item(value) where (item.value ->> 'legacy_id')::bigint = current.legacy_id);
  delete from public.installment_invoice_events current where current.household_id = p_household_id and not exists (select 1 from jsonb_array_elements(coalesce(p_snapshot -> 'installment_invoice_events','[]'::jsonb)) item(value) where (item.value ->> 'legacy_id')::bigint = current.legacy_id);
  delete from public.installment_reimbursement_allocations current where current.household_id = p_household_id and not exists (select 1 from jsonb_array_elements(coalesce(p_snapshot -> 'installment_reimbursement_allocations','[]'::jsonb)) item(value) where (item.value ->> 'legacy_id')::bigint = current.legacy_id);
  insert into public.invoice_adjustments(household_id,legacy_id,card_legacy_id,reference_month,adjustment_type,amount,description,occurred_on)
  select p_household_id,(x->>'legacy_id')::bigint,(x->>'card_legacy_id')::bigint,(x->>'reference_month')::date,x->>'adjustment_type',(x->>'amount')::numeric,x->>'description',nullif(x->>'occurred_on','')::date from jsonb_array_elements(coalesce(p_snapshot -> 'invoice_adjustments','[]'::jsonb)) x
  on conflict (household_id,legacy_id) do update set card_legacy_id=excluded.card_legacy_id,reference_month=excluded.reference_month,adjustment_type=excluded.adjustment_type,amount=excluded.amount,description=excluded.description,occurred_on=excluded.occurred_on;
  insert into public.installment_invoice_events(household_id,legacy_id,installment_legacy_id,card_legacy_id,reference_month,installment_number,amount,event_type,occurred_on)
  select p_household_id,(x->>'legacy_id')::bigint,(x->>'installment_legacy_id')::bigint,(x->>'card_legacy_id')::bigint,(x->>'reference_month')::date,(x->>'installment_number')::integer,(x->>'amount')::numeric,x->>'event_type',nullif(x->>'occurred_on','')::date from jsonb_array_elements(coalesce(p_snapshot -> 'installment_invoice_events','[]'::jsonb)) x
  on conflict (household_id,legacy_id) do update set installment_legacy_id=excluded.installment_legacy_id,card_legacy_id=excluded.card_legacy_id,reference_month=excluded.reference_month,installment_number=excluded.installment_number,amount=excluded.amount,event_type=excluded.event_type,occurred_on=excluded.occurred_on;
  insert into public.installment_reimbursement_allocations(household_id,legacy_id,installment_legacy_id,person,installment_number,amount,expected_month,status,debt_legacy_id)
  select p_household_id,(x->>'legacy_id')::bigint,(x->>'installment_legacy_id')::bigint,x->>'person',(x->>'installment_number')::integer,(x->>'amount')::numeric,(x->>'expected_month')::date,x->>'status',nullif(x->>'debt_legacy_id','')::bigint from jsonb_array_elements(coalesce(p_snapshot -> 'installment_reimbursement_allocations','[]'::jsonb)) x
  on conflict (household_id,legacy_id) do update set installment_legacy_id=excluded.installment_legacy_id,person=excluded.person,installment_number=excluded.installment_number,amount=excluded.amount,expected_month=excluded.expected_month,status=excluded.status,debt_legacy_id=excluded.debt_legacy_id;
  return v_result || jsonb_build_object('expenses', p_snapshot -> 'expenses', 'invoice_adjustments', coalesce(p_snapshot -> 'invoice_adjustments','[]'::jsonb), 'installment_invoice_events', coalesce(p_snapshot -> 'installment_invoice_events','[]'::jsonb), 'installment_reimbursement_allocations', coalesce(p_snapshot -> 'installment_reimbursement_allocations','[]'::jsonb));
end; $$;
revoke all on function public.replace_financial_snapshot_v2(uuid,jsonb,text) from public;
grant execute on function public.replace_financial_snapshot_v2(uuid,jsonb,text) to authenticated;

-- Explicit local migration keeps its provenance hash/idempotency in the
-- original RPC, then atomically extends the returned snapshot with the new
-- collections. Any failure here rolls the original import and marker back.
create or replace function public.import_financial_snapshot_v2(
  p_household_id uuid, p_source_hash text, p_snapshot jsonb, p_summary jsonb
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare v_result jsonb;
begin
  v_result := public.import_financial_snapshot(p_household_id, p_source_hash, p_snapshot, p_summary);
  -- `replace` validates all new legacy references. Reuse that validation by
  -- making a no-op full replacement only for a newly imported source; for an
  -- idempotent existing import its stored snapshot is already authoritative.
  if (v_result ->> 'imported')::boolean then
    perform public.replace_financial_snapshot_v2(p_household_id, p_snapshot, 'migration:' || p_source_hash);
  end if;
  return v_result || jsonb_build_object('snapshot', (v_result -> 'snapshot') || jsonb_build_object('invoice_adjustments', coalesce(p_snapshot -> 'invoice_adjustments','[]'::jsonb), 'installment_invoice_events', coalesce(p_snapshot -> 'installment_invoice_events','[]'::jsonb), 'installment_reimbursement_allocations', coalesce(p_snapshot -> 'installment_reimbursement_allocations','[]'::jsonb)));
end; $$;
revoke all on function public.import_financial_snapshot_v2(uuid,text,jsonb,jsonb) from public;
grant execute on function public.import_financial_snapshot_v2(uuid,text,jsonb,jsonb) to authenticated;
