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

  -- Namespace this temporary marker away from explicit local imports. The
  -- delegated function validates all snapshot identity and relations before
  -- changing rows. A unique revision makes every accepted runtime write fresh.
  v_runtime_hash := 'runtime:' || p_revision_hash;
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

  -- Remove records no longer represented by the complete snapshot only after
  -- its validated upserts succeeded. These deletes, import and marker cleanup
  -- share the same PostgreSQL transaction.
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

  delete from public.local_imports
   where household_id = p_household_id and source_hash = v_runtime_hash;

  return v_result -> 'snapshot';
end;
$$;

revoke all on function public.replace_financial_snapshot(uuid, jsonb, text) from public;
grant execute on function public.replace_financial_snapshot(uuid, jsonb, text) to authenticated;
