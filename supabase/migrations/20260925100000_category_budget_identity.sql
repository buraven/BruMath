-- V4 rollout contract: deploy this migration before V4 writers. Once a V4
-- snapshot has been written, V3 writers are read-only during a controlled
-- rollback; writing through V3 would omit category_budgets.
--
-- category_budgets is authoritative for resolved category identities. The
-- legacy name-keyed map is retained only for values that cannot be resolved
-- unambiguously, and is never regenerated from category_budgets.
alter table public.financial_settings
  add column if not exists category_budgets jsonb not null default '{}'::jsonb;

-- Backfill only names with exactly one active matching category. Ambiguous
-- names deliberately remain in the legacy JSON map rather than being guessed.
with candidates as (
  select settings.household_id, category.legacy_id, entry.key as legacy_name, entry.value as amount
  from public.financial_settings settings
  cross join lateral jsonb_each(coalesce(settings.budgets, '{}'::jsonb)) entry
  join public.financial_categories category
    on category.household_id = settings.household_id
   and category.active
   and category.normalized_name = translate(regexp_replace(btrim(entry.key, ' '), ' +', ' ', 'g'),
     'ABCDEFGHIJKLMNOPQRSTUVWXYZÁÀÂÃÄÇÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜ',
     'abcdefghijklmnopqrstuvwxyzáàâãäçéèêëíìîïóòôõöúùûü')
  where jsonb_typeof(entry.value) = 'number'
), unambiguous as (
  -- Equivalent legacy spellings may carry conflicting values. Do not choose
  -- one: leave every such key in legacy compatibility until it is resolved.
  select household_id, legacy_id, min(amount::text)::jsonb as amount
  from candidates
  group by household_id, legacy_id
  having count(*) = 1
), mapped as (
  select household_id, jsonb_object_agg(legacy_id, amount) as budgets
  from unambiguous group by household_id
)
update public.financial_settings settings
set category_budgets = mapped.budgets || coalesce(settings.category_budgets, '{}'::jsonb)
from mapped where mapped.household_id = settings.household_id;

create or replace function public.replace_financial_snapshot_v4(
  p_household_id uuid, p_snapshot jsonb, p_revision_hash text
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare v_result jsonb; v_category_budgets jsonb;
begin
  perform set_config('brumath.v4_snapshot_writer', 'enabled', true);
  if p_snapshot -> 'settings' ? 'category_budgets' then
    v_category_budgets := p_snapshot -> 'settings' -> 'category_budgets';
  else
    select category_budgets into v_category_budgets from public.financial_settings where household_id = p_household_id;
    v_category_budgets := coalesce(v_category_budgets, '{}'::jsonb);
  end if;
  if jsonb_typeof(v_category_budgets) <> 'object' then
    raise exception 'settings category_budgets must be an object';
  end if;
  if exists (select 1 from jsonb_each(v_category_budgets) item where jsonb_typeof(item.value) <> 'number') then
    raise exception 'settings category_budgets must contain numeric values';
  end if;
  if exists (select 1 from jsonb_object_keys(v_category_budgets) id where not exists (
    select 1 from jsonb_array_elements(coalesce(p_snapshot -> 'categories', '[]'::jsonb)) category
    where category ->> 'legacy_id' = id
  )) then raise exception 'settings category_budgets references a missing category'; end if;
  v_result := public.replace_financial_snapshot_v3(p_household_id, p_snapshot, p_revision_hash);
  update public.financial_settings set category_budgets = v_category_budgets where household_id = p_household_id;
  return jsonb_set(v_result, '{settings,category_budgets}', v_category_budgets, true);
end; $$;
revoke all on function public.replace_financial_snapshot_v4(uuid,jsonb,text) from public;
grant execute on function public.replace_financial_snapshot_v4(uuid,jsonb,text) to authenticated;

create or replace function public.import_financial_snapshot_v4(
  p_household_id uuid, p_source_hash text, p_snapshot jsonb, p_summary jsonb
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare v_result jsonb; v_snapshot jsonb; v_imported boolean; v_category_budgets jsonb;
begin
  perform set_config('brumath.v4_snapshot_writer', 'enabled', true);
  v_result := public.import_financial_snapshot_v3(p_household_id, p_source_hash, p_snapshot, p_summary);
  v_imported := coalesce((v_result ->> 'imported')::boolean, false);
  if v_imported then
    v_snapshot := public.replace_financial_snapshot_v4(p_household_id, p_snapshot, 'migration:' || p_source_hash);
  else
    v_snapshot := v_result -> 'snapshot';
    select category_budgets into v_category_budgets from public.financial_settings where household_id = p_household_id;
    v_snapshot := jsonb_set(v_snapshot, '{settings,category_budgets}', coalesce(v_category_budgets, '{}'::jsonb), true);
  end if;
  return jsonb_build_object('imported', v_imported, 'snapshot', v_snapshot);
end; $$;
revoke all on function public.import_financial_snapshot_v4(uuid,text,jsonb,jsonb) from public;
grant execute on function public.import_financial_snapshot_v4(uuid,text,jsonb,jsonb) to authenticated;

-- V4 delegates to V3 under SECURITY INVOKER, so revoking V3 EXECUTE would
-- also break V4. Redefine the two V3 writers with an internal, transaction-
-- local guard instead: a direct V3 RPC fails explicitly, while V4 sets the
-- guard only for its own call stack. RLS remains active throughout.
create or replace function public.replace_financial_snapshot_v3(
  p_household_id uuid, p_snapshot jsonb, p_revision_hash text
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_snapshot_v2 jsonb;
  v_expenses jsonb;
  v_installments jsonb;
  v_result jsonb;
begin
  if current_setting('brumath.v4_snapshot_writer', true) is distinct from 'enabled' then
    raise exception 'replace_financial_snapshot_v3 is disabled after the V4 category-budget rollout';
  end if;
  if jsonb_typeof(coalesce(p_snapshot -> 'categories', '[]'::jsonb)) <> 'array' then
    raise exception 'snapshot collection categories must be an array';
  end if;
  if exists (
    select 1 from jsonb_array_elements(coalesce(p_snapshot -> 'categories', '[]'::jsonb)) item(value)
    where jsonb_typeof(item.value -> 'legacy_id') <> 'string'
       or coalesce(length(btrim(item.value ->> 'name')), 0) = 0
       or jsonb_typeof(item.value -> 'active') <> 'boolean'
       or jsonb_typeof(item.value -> 'sort_order') <> 'number'
  ) then raise exception 'snapshot categories has an invalid item'; end if;
  if (select count(*) <> count(distinct item.value ->> 'legacy_id') from jsonb_array_elements(coalesce(p_snapshot -> 'categories', '[]'::jsonb)) item(value)) then
    raise exception 'snapshot categories has duplicate legacy ids';
  end if;
  if exists (
    select 1 from jsonb_array_elements(coalesce(p_snapshot -> 'categories', '[]'::jsonb)) item(value)
    group by translate(regexp_replace(btrim(item.value ->> 'name', ' '), ' +', ' ', 'g'),
      'ABCDEFGHIJKLMNOPQRSTUVWXYZÁÀÂÃÄÇÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜ',
      'abcdefghijklmnopqrstuvwxyzáàâãäçéèêëíìîïóòôõöúùûü')
    having count(*) filter (where coalesce((item.value ->> 'active')::boolean, false)) > 1
  ) then raise exception 'snapshot categories has duplicate active names'; end if;
  if exists (
    select 1 from jsonb_array_elements(p_snapshot -> 'expenses') item(value)
    where item.value ->> 'category_legacy_id' is not null and not exists (
      select 1 from jsonb_array_elements(p_snapshot -> 'categories') category(value)
      where category.value ->> 'legacy_id' = item.value ->> 'category_legacy_id'
    )
  ) or exists (
    select 1 from jsonb_array_elements(p_snapshot -> 'installments') item(value)
    where item.value ->> 'category_legacy_id' is not null and not exists (
      select 1 from jsonb_array_elements(p_snapshot -> 'categories') category(value)
      where category.value ->> 'legacy_id' = item.value ->> 'category_legacy_id'
    )
  ) then raise exception 'snapshot references a missing category legacy id'; end if;

  select coalesce(jsonb_agg(item.value - 'category_legacy_id' order by (item.value ->> 'legacy_id')::bigint), '[]'::jsonb) into v_expenses
    from jsonb_array_elements(p_snapshot -> 'expenses') item(value);
  select coalesce(jsonb_agg(item.value - 'category_legacy_id' order by (item.value ->> 'legacy_id')::bigint), '[]'::jsonb) into v_installments
    from jsonb_array_elements(p_snapshot -> 'installments') item(value);
  v_snapshot_v2 := jsonb_set(jsonb_set(p_snapshot - 'categories', '{expenses}', v_expenses), '{installments}', v_installments);
  v_result := public.replace_financial_snapshot_v2(p_household_id, v_snapshot_v2, p_revision_hash);

  insert into public.financial_categories(household_id, legacy_id, name, normalized_name, icon, active, sort_order)
  select p_household_id, x ->> 'legacy_id', regexp_replace(btrim(x ->> 'name', ' '), ' +', ' ', 'g'),
    translate(regexp_replace(btrim(x ->> 'name', ' '), ' +', ' ', 'g'),
      'ABCDEFGHIJKLMNOPQRSTUVWXYZÁÀÂÃÄÇÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜ',
      'abcdefghijklmnopqrstuvwxyzáàâãäçéèêëíìîïóòôõöúùûü'),
    nullif(x->>'icon',''), (x->>'active')::boolean, (x->>'sort_order')::integer
  from jsonb_array_elements(p_snapshot -> 'categories') x
  on conflict (household_id, legacy_id) do update set name = excluded.name, normalized_name = excluded.normalized_name, icon = excluded.icon, active = excluded.active, sort_order = excluded.sort_order;
  update public.expenses current set category_legacy_id = nullif(item.value ->> 'category_legacy_id','')
    from jsonb_array_elements(p_snapshot -> 'expenses') item(value)
   where current.household_id = p_household_id and current.legacy_id = (item.value ->> 'legacy_id')::bigint;
  update public.installments current set category_legacy_id = nullif(item.value ->> 'category_legacy_id','')
    from jsonb_array_elements(p_snapshot -> 'installments') item(value)
   where current.household_id = p_household_id and current.legacy_id = (item.value ->> 'legacy_id')::bigint;
  delete from public.financial_categories current where current.household_id = p_household_id and not exists (
    select 1 from jsonb_array_elements(p_snapshot -> 'categories') item(value) where item.value ->> 'legacy_id' = current.legacy_id
  );
  return v_result || jsonb_build_object('categories', p_snapshot -> 'categories', 'expenses', p_snapshot -> 'expenses', 'installments', p_snapshot -> 'installments');
end; $$;

create or replace function public.import_financial_snapshot_v3(
  p_household_id uuid, p_source_hash text, p_snapshot jsonb, p_summary jsonb
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_snapshot_v2 jsonb;
  v_expenses jsonb;
  v_installments jsonb;
  v_result jsonb;
  v_imported boolean;
  v_snapshot jsonb;
begin
  if current_setting('brumath.v4_snapshot_writer', true) is distinct from 'enabled' then
    raise exception 'import_financial_snapshot_v3 is disabled after the V4 category-budget rollout';
  end if;
  select coalesce(jsonb_agg(item.value - 'category_legacy_id' order by (item.value ->> 'legacy_id')::bigint), '[]'::jsonb) into v_expenses from jsonb_array_elements(p_snapshot -> 'expenses') item(value);
  select coalesce(jsonb_agg(item.value - 'category_legacy_id' order by (item.value ->> 'legacy_id')::bigint), '[]'::jsonb) into v_installments from jsonb_array_elements(p_snapshot -> 'installments') item(value);
  v_snapshot_v2 := jsonb_set(jsonb_set(p_snapshot - 'categories', '{expenses}', v_expenses), '{installments}', v_installments);
  v_result := public.import_financial_snapshot_v2(p_household_id, p_source_hash, v_snapshot_v2, p_summary);
  v_imported := coalesce((v_result ->> 'imported')::boolean, false);
  if v_imported then
    v_snapshot := public.replace_financial_snapshot_v3(p_household_id, p_snapshot, 'migration:' || p_source_hash);
  else
    v_snapshot := (v_result -> 'snapshot') || jsonb_build_object('categories', p_snapshot -> 'categories', 'expenses', p_snapshot -> 'expenses', 'installments', p_snapshot -> 'installments');
  end if;
  return jsonb_build_object('imported', v_imported, 'snapshot', v_snapshot);
end; $$;
