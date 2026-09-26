-- V4 owns category_budgets, while V3/V2/V1 intentionally keep the older
-- settings contract. Project this V4-only field away before delegation so the
-- V1 reconciliation guard continues to compare like-for-like snapshots.

create or replace function public.replace_financial_snapshot_v4(
  p_household_id uuid, p_snapshot jsonb, p_revision_hash text
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_result jsonb;
  v_category_budgets jsonb;
  v_snapshot_v3 jsonb;
begin
  perform set_config('brumath.v4_snapshot_writer', 'enabled', true);
  if p_snapshot -> 'settings' ? 'category_budgets' then
    v_category_budgets := p_snapshot -> 'settings' -> 'category_budgets';
  else
    select category_budgets into v_category_budgets
      from public.financial_settings
      where household_id = p_household_id;
    v_category_budgets := coalesce(v_category_budgets, '{}'::jsonb);
  end if;
  if jsonb_typeof(v_category_budgets) <> 'object' then
    raise exception 'settings category_budgets must be an object';
  end if;
  if exists (
    select 1 from jsonb_each(v_category_budgets) item
    where jsonb_typeof(item.value) <> 'number'
  ) then
    raise exception 'settings category_budgets must contain numeric values';
  end if;
  if exists (
    select 1 from jsonb_object_keys(v_category_budgets) id
    where not exists (
      select 1 from jsonb_array_elements(coalesce(p_snapshot -> 'categories', '[]'::jsonb)) category
      where category ->> 'legacy_id' = id
    )
  ) then
    raise exception 'settings category_budgets references a missing category';
  end if;

  v_snapshot_v3 := jsonb_set(
    p_snapshot,
    '{settings}',
    (p_snapshot -> 'settings') - 'category_budgets',
    true
  );
  v_result := public.replace_financial_snapshot_v3(
    p_household_id,
    v_snapshot_v3,
    p_revision_hash
  );

  update public.financial_settings
    set category_budgets = v_category_budgets
    where household_id = p_household_id;
  return jsonb_set(v_result, '{settings,category_budgets}', v_category_budgets, true);
end; $$;

revoke all on function public.replace_financial_snapshot_v4(uuid,jsonb,text) from public;
grant execute on function public.replace_financial_snapshot_v4(uuid,jsonb,text) to authenticated;

create or replace function public.import_financial_snapshot_v4(
  p_household_id uuid, p_source_hash text, p_snapshot jsonb, p_summary jsonb
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_result jsonb;
  v_snapshot jsonb;
  v_snapshot_v3 jsonb;
  v_imported boolean;
  v_category_budgets jsonb;
begin
  perform set_config('brumath.v4_snapshot_writer', 'enabled', true);
  v_snapshot_v3 := jsonb_set(
    p_snapshot,
    '{settings}',
    (p_snapshot -> 'settings') - 'category_budgets',
    true
  );
  v_result := public.import_financial_snapshot_v3(
    p_household_id,
    p_source_hash,
    v_snapshot_v3,
    p_summary
  );
  v_imported := coalesce((v_result ->> 'imported')::boolean, false);
  if v_imported then
    v_snapshot := public.replace_financial_snapshot_v4(
      p_household_id,
      p_snapshot,
      'migration:' || p_source_hash
    );
  else
    v_snapshot := v_result -> 'snapshot';
    select category_budgets into v_category_budgets
      from public.financial_settings
      where household_id = p_household_id;
    v_snapshot := jsonb_set(
      v_snapshot,
      '{settings,category_budgets}',
      coalesce(v_category_budgets, '{}'::jsonb),
      true
    );
  end if;
  return jsonb_build_object('imported', v_imported, 'snapshot', v_snapshot);
end; $$;

revoke all on function public.import_financial_snapshot_v4(uuid,text,jsonb,jsonb) from public;
grant execute on function public.import_financial_snapshot_v4(uuid,text,jsonb,jsonb) to authenticated;
