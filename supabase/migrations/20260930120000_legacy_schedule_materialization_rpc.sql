-- Materializes exactly one already-approved legacy Class-A plan. This is
-- intentionally separate from the V4 snapshot-replacement path: it appends a
-- complete schedule under a per-installment lock and never replaces schedules
-- belonging to other plans.

create or replace function public.materialize_legacy_installment_schedule_class_a(
  p_household_id uuid,
  p_installment_legacy_id bigint,
  p_schedule jsonb
) returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_installment public.installments%rowtype;
  v_item_count integer;
begin
  if (select auth.uid()) is null then
    raise exception 'authentication is required';
  end if;
  if not public.is_household_member(p_household_id) then
    raise exception 'household membership is required';
  end if;
  if jsonb_typeof(p_schedule) <> 'array' then
    raise exception 'schedule must be an array';
  end if;

  -- This row lock serializes two materialization attempts for the same plan.
  select * into v_installment
    from public.installments
    where household_id = p_household_id
      and legacy_id = p_installment_legacy_id
    for update;
  if not found then
    raise exception 'installment was not found in the household';
  end if;

  if exists (
    select 1 from public.installment_schedule_items
    where household_id = p_household_id and installment_id = v_installment.id
  ) then
    return jsonb_build_object('status', 'conflict', 'reason', 'schedule_exists');
  end if;

  select count(*) into v_item_count from jsonb_array_elements(p_schedule);
  if v_item_count <> v_installment.total_installments then
    raise exception 'schedule must contain every installment number exactly once';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_schedule) source(value)
    where jsonb_typeof(source.value -> 'legacy_id') <> 'string'
       or coalesce(length(btrim(source.value ->> 'legacy_id')), 0) = 0
       or jsonb_typeof(source.value -> 'installment_legacy_id') <> 'number'
       or (source.value ->> 'installment_legacy_id')::bigint <> p_installment_legacy_id
       or jsonb_typeof(source.value -> 'installment_number') <> 'number'
       or jsonb_typeof(source.value -> 'total_installments') <> 'number'
       or (source.value ->> 'total_installments')::integer <> v_installment.total_installments
       or jsonb_typeof(source.value -> 'amount') <> 'number'
       or (source.value ->> 'amount')::numeric < 0
       or source.value ->> 'status' is distinct from 'scheduled'
       or (source.value ->> 'installment_number')::integer < 1
       or (source.value ->> 'installment_number')::integer > v_installment.total_installments
       or (source.value -> 'invoice_reference_month' is not null
           and jsonb_typeof(source.value -> 'invoice_reference_month') <> 'null'
           and (jsonb_typeof(source.value -> 'invoice_reference_month') <> 'string'
             or source.value ->> 'invoice_reference_month' !~ '^[0-9]{4}-[0-9]{2}-01$'))
       or (source.value -> 'due_date' is not null
           and jsonb_typeof(source.value -> 'due_date') <> 'null'
           and (jsonb_typeof(source.value -> 'due_date') <> 'string'
             or source.value ->> 'due_date' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'))
       or (source.value -> 'credit_card_legacy_id' is not null
           and jsonb_typeof(source.value -> 'credit_card_legacy_id') <> 'null'
           and jsonb_typeof(source.value -> 'credit_card_legacy_id') <> 'number')
  ) then
    raise exception 'schedule has an invalid item';
  end if;
  if (select count(*) <> count(distinct source.value ->> 'legacy_id') from jsonb_array_elements(p_schedule) source(value))
     or (select count(*) <> count(distinct (source.value ->> 'installment_number')::integer) from jsonb_array_elements(p_schedule) source(value)) then
    raise exception 'schedule contains duplicate identities';
  end if;
  if (select coalesce(sum((source.value ->> 'amount')::numeric), 0) from jsonb_array_elements(p_schedule) source(value))
     <> v_installment.amount * v_installment.total_installments then
    raise exception 'schedule amount does not reconcile with the installment plan';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_schedule) source(value)
    where source.value ->> 'credit_card_legacy_id' is not null
      and not exists (
        select 1 from public.credit_cards card
        where card.household_id = p_household_id
          and card.legacy_id = (source.value ->> 'credit_card_legacy_id')::bigint
      )
  ) then
    raise exception 'schedule references a missing credit card';
  end if;

  -- Explicit invoice history must match its exact X/Y schedule item.
  if exists (
    select 1
    from public.installment_invoice_events event
    left join jsonb_array_elements(p_schedule) source(value)
      on (source.value ->> 'installment_number')::integer = event.installment_number
    where event.household_id = p_household_id
      and event.installment_legacy_id = p_installment_legacy_id
      and (
        source.value is null
        or (source.value ->> 'amount')::numeric <> event.amount
        or nullif(source.value ->> 'invoice_reference_month', '')::date is distinct from event.reference_month
        or nullif(source.value ->> 'credit_card_legacy_id', '')::bigint is distinct from event.card_legacy_id
      )
  ) then
    raise exception 'schedule conflicts with an invoice event';
  end if;
  if exists (
    select 1 from public.installment_settlement_events
    where household_id = p_household_id and installment_id = v_installment.id
  ) then
    raise exception 'schedule conflicts with a settlement event';
  end if;
  if exists (
    select 1 from public.installment_reimbursement_allocations
    where household_id = p_household_id
      and installment_legacy_id = p_installment_legacy_id
      and (debt_legacy_id is not null or status in ('due', 'received', 'cancelled'))
  ) then
    raise exception 'schedule conflicts with a protected reimbursement';
  end if;

  insert into public.installment_schedule_items(
    household_id, legacy_id, installment_id, installment_number,
    total_installments, amount, invoice_reference_month, due_date,
    credit_card_id, status
  )
  select
    p_household_id,
    source.value ->> 'legacy_id',
    v_installment.id,
    (source.value ->> 'installment_number')::integer,
    (source.value ->> 'total_installments')::integer,
    (source.value ->> 'amount')::numeric,
    nullif(source.value ->> 'invoice_reference_month', '')::date,
    nullif(source.value ->> 'due_date', '')::date,
    card.id,
    'scheduled'
  from jsonb_array_elements(p_schedule) source(value)
  left join public.credit_cards card
    on card.household_id = p_household_id
   and card.legacy_id = nullif(source.value ->> 'credit_card_legacy_id', '')::bigint;

  return jsonb_build_object('status', 'applied', 'schedule_items', v_item_count);
end;
$$;

revoke all on function public.materialize_legacy_installment_schedule_class_a(uuid,bigint,jsonb) from public;
revoke all on function public.materialize_legacy_installment_schedule_class_a(uuid,bigint,jsonb) from anon;
grant execute on function public.materialize_legacy_installment_schedule_class_a(uuid,bigint,jsonb) to authenticated;
