-- Runtime persistence uses the same validated import representation, but keeps
-- `local_imports` reserved for explicit localStorage migration provenance.
-- The function is SECURITY INVOKER: authenticated RLS membership remains the
-- authorization boundary and any exception rolls the complete transaction back.
create or replace function public.replace_financial_snapshot(
  p_household_id uuid,
  p_snapshot jsonb,
  p_revision_hash text
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_runtime_hash text;
  v_result jsonb;
  v_collection text;
begin
  if v_user_id is null then
    raise exception 'authentication is required';
  end if;
  if not public.is_household_member(p_household_id) then
    raise exception 'household membership is required';
  end if;
  if p_revision_hash is null or length(trim(p_revision_hash)) = 0 then
    raise exception 'revision hash is required';
  end if;
  if p_snapshot is null or jsonb_typeof(p_snapshot) <> 'object' then
    raise exception 'a snapshot object is required';
  end if;
  if not (p_snapshot ? 'settings')
     or not (p_snapshot ? 'expenses')
     or not (p_snapshot ? 'installments')
     or not (p_snapshot ? 'receivables')
     or not (p_snapshot ? 'income_entries')
     or not (p_snapshot ? 'credit_cards')
     or not (p_snapshot ? 'invoice_payments') then
    raise exception 'snapshot is missing a required collection';
  end if;

  -- Validate the complete replacement before deleting anything. The delegated
  -- import repeats these boundary checks, but it must run only after stale
  -- records are gone so its structural reconciliation observes the full new
  -- snapshot rather than a mixture of old and new rows.
  foreach v_collection in array array[
    'expenses', 'installments', 'receivables', 'income_entries',
    'credit_cards', 'invoice_payments'
  ] loop
    if jsonb_typeof(p_snapshot -> v_collection) <> 'array' then
      raise exception 'snapshot collection % must be an array', v_collection;
    end if;
    if exists (
      select 1
      from jsonb_array_elements(p_snapshot -> v_collection) as item(value)
      where jsonb_typeof(item.value -> 'legacy_id') <> 'number'
         or (item.value ->> 'legacy_id')::numeric <> trunc((item.value ->> 'legacy_id')::numeric)
    ) then
      raise exception 'snapshot collection % has an invalid legacy id', v_collection;
    end if;
    if (
      select count(*) <> count(distinct (item.value ->> 'legacy_id')::bigint)
      from jsonb_array_elements(p_snapshot -> v_collection) as item(value)
    ) then
      raise exception 'snapshot collection % has duplicate legacy ids', v_collection;
    end if;
  end loop;

  if exists (
    select 1
    from jsonb_array_elements(p_snapshot -> 'expenses') as item(value)
    where item.value ->> 'credit_card_legacy_id' is not null
      and not exists (
        select 1 from jsonb_array_elements(p_snapshot -> 'credit_cards') as card(value)
        where (card.value ->> 'legacy_id')::bigint = (item.value ->> 'credit_card_legacy_id')::bigint
      )
  ) or exists (
    select 1
    from jsonb_array_elements(p_snapshot -> 'installments') as item(value)
    where item.value ->> 'credit_card_legacy_id' is not null
      and not exists (
        select 1 from jsonb_array_elements(p_snapshot -> 'credit_cards') as card(value)
        where (card.value ->> 'legacy_id')::bigint = (item.value ->> 'credit_card_legacy_id')::bigint
      )
  ) or exists (
    select 1
    from jsonb_array_elements(p_snapshot -> 'invoice_payments') as item(value)
    where not exists (
      select 1 from jsonb_array_elements(p_snapshot -> 'credit_cards') as card(value)
      where (card.value ->> 'legacy_id')::bigint = (item.value ->> 'card_legacy_id')::bigint
    )
  ) then
    raise exception 'snapshot references a missing credit card legacy id';
  end if;

  -- Remove stale records only after pre-validation succeeds. Deleting dependent
  -- rows before cards preserves legacy-card integrity. The delegated import
  -- then upserts and reconciles this complete replacement in the same
  -- transaction; any error rolls both phases back.
  v_runtime_hash := 'runtime:' || p_revision_hash;
  delete from public.invoice_payments current
   where current.household_id = p_household_id
     and not exists (
       select 1 from jsonb_array_elements(p_snapshot -> 'invoice_payments') item(value)
        where (item.value ->> 'legacy_id')::bigint = current.legacy_id
     );
  delete from public.expenses current
   where current.household_id = p_household_id
     and not exists (
       select 1 from jsonb_array_elements(p_snapshot -> 'expenses') item(value)
        where (item.value ->> 'legacy_id')::bigint = current.legacy_id
     );
  delete from public.installments current
   where current.household_id = p_household_id
     and not exists (
       select 1 from jsonb_array_elements(p_snapshot -> 'installments') item(value)
        where (item.value ->> 'legacy_id')::bigint = current.legacy_id
     );
  delete from public.receivables current
   where current.household_id = p_household_id
     and not exists (
       select 1 from jsonb_array_elements(p_snapshot -> 'receivables') item(value)
        where (item.value ->> 'legacy_id')::bigint = current.legacy_id
     );
  delete from public.income_entries current
   where current.household_id = p_household_id
     and not exists (
       select 1 from jsonb_array_elements(p_snapshot -> 'income_entries') item(value)
        where (item.value ->> 'legacy_id')::bigint = current.legacy_id
     );
  delete from public.credit_cards current
   where current.household_id = p_household_id
     and not exists (
       select 1 from jsonb_array_elements(p_snapshot -> 'credit_cards') item(value)
        where (item.value ->> 'legacy_id')::bigint = current.legacy_id
     );

  v_result := public.import_financial_snapshot(
    p_household_id,
    v_runtime_hash,
    p_snapshot,
    jsonb_build_object(
      'expenses', jsonb_array_length(p_snapshot -> 'expenses'),
      'installments', jsonb_array_length(p_snapshot -> 'installments'),
      'receivables', jsonb_array_length(p_snapshot -> 'receivables'),
      'incomeEntries', jsonb_array_length(p_snapshot -> 'income_entries'),
      'creditCards', jsonb_array_length(p_snapshot -> 'credit_cards'),
      'invoicePayments', jsonb_array_length(p_snapshot -> 'invoice_payments')
    )
  );

  -- The import creates a temporary runtime marker only after its final
  -- reconciliation. It is not migration provenance, so remove it after the
  -- reconciled result has been produced.
  delete from public.local_imports
   where household_id = p_household_id and source_hash = v_runtime_hash;

  return v_result -> 'snapshot';
end;
$$;

revoke all on function public.replace_financial_snapshot(uuid, jsonb, text) from public;
grant execute on function public.replace_financial_snapshot(uuid, jsonb, text) to authenticated;
