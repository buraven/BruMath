-- The v1 import/replacement functions deliberately know only the original
-- snapshot contract. v2 must project that contract before delegating, then
-- layer the additive invoice-history collections back in the same transaction.
-- This preserves the v1 reconciliation guardrail without treating additive
-- v2 fields as a false structural mismatch.

create or replace function public.replace_financial_snapshot_v2(
  p_household_id uuid, p_snapshot jsonb, p_revision_hash text
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_user_id uuid := (select auth.uid());
  v_result jsonb;
  v_legacy_snapshot jsonb;
  v_legacy_expenses jsonb;
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

  select coalesce(jsonb_agg(item.value - 'invoice_reference_month' order by (item.value ->> 'legacy_id')::bigint), '[]'::jsonb)
    into v_legacy_expenses
    from jsonb_array_elements(coalesce(p_snapshot -> 'expenses', '[]'::jsonb)) item(value);
  v_legacy_snapshot := jsonb_set(
    p_snapshot - 'invoice_adjustments' - 'installment_invoice_events' - 'installment_reimbursement_allocations',
    '{expenses}',
    v_legacy_expenses
  );

  -- The delegated function still validates/reconciles every legacy field.
  v_result := public.replace_financial_snapshot(p_household_id, v_legacy_snapshot, p_revision_hash);
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
  return v_result || jsonb_build_object(
    'expenses', p_snapshot -> 'expenses',
    'invoice_adjustments', coalesce(p_snapshot -> 'invoice_adjustments','[]'::jsonb),
    'installment_invoice_events', coalesce(p_snapshot -> 'installment_invoice_events','[]'::jsonb),
    'installment_reimbursement_allocations', coalesce(p_snapshot -> 'installment_reimbursement_allocations','[]'::jsonb)
  );
end; $$;
revoke all on function public.replace_financial_snapshot_v2(uuid,jsonb,text) from public;
grant execute on function public.replace_financial_snapshot_v2(uuid,jsonb,text) to authenticated;

create or replace function public.import_financial_snapshot_v2(
  p_household_id uuid, p_source_hash text, p_snapshot jsonb, p_summary jsonb
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_legacy_snapshot jsonb;
  v_legacy_expenses jsonb;
  v_legacy_result jsonb;
  v_snapshot jsonb;
  v_imported boolean;
begin
  select coalesce(jsonb_agg(item.value - 'invoice_reference_month' order by (item.value ->> 'legacy_id')::bigint), '[]'::jsonb)
    into v_legacy_expenses
    from jsonb_array_elements(coalesce(p_snapshot -> 'expenses', '[]'::jsonb)) item(value);
  v_legacy_snapshot := jsonb_set(
    p_snapshot - 'invoice_adjustments' - 'installment_invoice_events' - 'installment_reimbursement_allocations',
    '{expenses}',
    v_legacy_expenses
  );
  v_legacy_result := public.import_financial_snapshot(p_household_id, p_source_hash, v_legacy_snapshot, p_summary);
  v_imported := coalesce((v_legacy_result ->> 'imported')::boolean, false);
  if v_imported then
    v_snapshot := public.replace_financial_snapshot_v2(p_household_id, p_snapshot, 'migration:' || p_source_hash);
  else
    -- Existing v2 provenance means the stored legacy snapshot is authoritative
    -- for legacy fields; overlay only the additive v2 contract for the response.
    v_snapshot := (v_legacy_result -> 'snapshot') || jsonb_build_object(
      'expenses', p_snapshot -> 'expenses',
      'invoice_adjustments', coalesce(p_snapshot -> 'invoice_adjustments','[]'::jsonb),
      'installment_invoice_events', coalesce(p_snapshot -> 'installment_invoice_events','[]'::jsonb),
      'installment_reimbursement_allocations', coalesce(p_snapshot -> 'installment_reimbursement_allocations','[]'::jsonb)
    );
  end if;
  return jsonb_build_object('imported', v_imported, 'snapshot', v_snapshot);
end; $$;
revoke all on function public.import_financial_snapshot_v2(uuid,text,jsonb,jsonb) from public;
grant execute on function public.import_financial_snapshot_v2(uuid,text,jsonb,jsonb) to authenticated;
