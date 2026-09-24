-- Additive, household-scoped category catalog. Legacy text columns stay in
-- place during the transition so existing clients and historical snapshots
-- remain readable.
--
-- Operational contract: apply this migration before deploying clients that
-- call v3. Pause v2 writers for the rollout window. A rollback client may
-- read legacy text safely, but must not resume v2 writes after v3 data exists:
-- v2 does not maintain category_legacy_id.
create table if not exists public.financial_categories (
  household_id uuid not null references public.households(id) on delete cascade,
  legacy_id text not null check (length(trim(legacy_id)) > 0),
  name text not null check (length(trim(name)) > 0),
  normalized_name text not null check (length(trim(normalized_name)) > 0),
  icon text,
  active boolean not null default true,
  sort_order integer not null default 0,
  primary key (household_id, legacy_id)
);

create unique index if not exists financial_categories_active_normalized_name_idx
  on public.financial_categories(household_id, normalized_name)
  where active;

-- Tables created after the foundation migration do not inherit its table
-- privileges. RLS below remains the household authorization boundary.
grant select, insert, update, delete on public.financial_categories to authenticated;

alter table public.expenses add column if not exists category_legacy_id text;
alter table public.installments add column if not exists category_legacy_id text;

alter table public.expenses
  drop constraint if exists expenses_category_legacy_id_fkey;
alter table public.expenses
  add constraint expenses_category_legacy_id_fkey
  foreign key (household_id, category_legacy_id)
  references public.financial_categories(household_id, legacy_id)
  on delete restrict;
alter table public.installments
  drop constraint if exists installments_category_legacy_id_fkey;
alter table public.installments
  add constraint installments_category_legacy_id_fkey
  foreign key (household_id, category_legacy_id)
  references public.financial_categories(household_id, legacy_id)
  on delete restrict;

-- Normalization is intentionally limited to trimming, collapsing whitespace
-- and lower-casing. Accents and distinct words are never fuzzy-matched.
with legacy_names as (
  select household_id, category as name, 1 as source_priority from public.expenses
  union all
  select household_id, category as name, 1 as source_priority from public.installments
  union all
  select household_id, budget_key as name, 1 as source_priority
    from public.financial_settings settings,
         jsonb_object_keys(coalesce(settings.budgets, '{}'::jsonb)) as budget_keys(budget_key)
  union all
  select household.id, defaults.name, 0 as source_priority
    from public.households household
    cross join (values
      ('Casa'), ('Carro'), ('Alimentação'), ('Pets'), ('Assinaturas'),
      ('Saúde'), ('Educação'), ('Pessoal'), ('Lazer'), ('Trabalho'),
      ('Outros'), ('Transporte')
    ) as defaults(name)
), normalized as (
  select distinct on (household_id, normalized_name)
    household_id,
    canonical_name as name,
    normalized_name
  from (
    select household_id, source_priority,
      regexp_replace(btrim(name, ' '), ' +', ' ', 'g') as canonical_name,
      translate(regexp_replace(btrim(name, ' '), ' +', ' ', 'g'),
        'ABCDEFGHIJKLMNOPQRSTUVWXYZÁÀÂÃÄÇÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜ',
        'abcdefghijklmnopqrstuvwxyzáàâãäçéèêëíìîïóòôõöúùûü') as normalized_name
    from legacy_names
  ) candidates
  where length(canonical_name) > 0
  order by household_id, normalized_name, source_priority,
    encode(convert_to(canonical_name, 'UTF8'), 'hex')
)
insert into public.financial_categories(
  household_id, legacy_id, name, normalized_name, active, sort_order
)
select household_id, 'legacy:' || normalized_name, name, normalized_name, true,
       row_number() over (partition by household_id order by normalized_name) - 1
from normalized
on conflict (household_id, legacy_id) do nothing;

update public.expenses expense
   set category_legacy_id = category.legacy_id
  from public.financial_categories category
 where category.household_id = expense.household_id
   and category.normalized_name = translate(regexp_replace(btrim(expense.category, ' '), ' +', ' ', 'g'),
      'ABCDEFGHIJKLMNOPQRSTUVWXYZÁÀÂÃÄÇÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜ',
      'abcdefghijklmnopqrstuvwxyzáàâãäçéèêëíìîïóòôõöúùûü')
   and expense.category_legacy_id is null;
update public.installments installment
   set category_legacy_id = category.legacy_id
  from public.financial_categories category
 where category.household_id = installment.household_id
   and category.normalized_name = translate(regexp_replace(btrim(installment.category, ' '), ' +', ' ', 'g'),
      'ABCDEFGHIJKLMNOPQRSTUVWXYZÁÀÂÃÄÇÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜ',
      'abcdefghijklmnopqrstuvwxyzáàâãäçéèêëíìîïóòôõöúùûü')
   and installment.category_legacy_id is null;

alter table public.financial_categories enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'financial_categories' and policyname = 'financial_categories_select_member') then
    create policy financial_categories_select_member on public.financial_categories for select to authenticated using (public.is_household_member(household_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'financial_categories' and policyname = 'financial_categories_insert_member') then
    create policy financial_categories_insert_member on public.financial_categories for insert to authenticated with check (public.is_household_member(household_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'financial_categories' and policyname = 'financial_categories_update_member') then
    create policy financial_categories_update_member on public.financial_categories for update to authenticated using (public.is_household_member(household_id)) with check (public.is_household_member(household_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'financial_categories' and policyname = 'financial_categories_delete_member') then
    create policy financial_categories_delete_member on public.financial_categories for delete to authenticated using (public.is_household_member(household_id));
  end if;
end $$;

create or replace function public.replace_financial_snapshot_v3(
  p_household_id uuid, p_snapshot jsonb, p_revision_hash text
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_snapshot_v2 jsonb;
  v_expenses jsonb;
  v_installments jsonb;
  v_result jsonb;
begin
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
revoke all on function public.replace_financial_snapshot_v3(uuid,jsonb,text) from public;
grant execute on function public.replace_financial_snapshot_v3(uuid,jsonb,text) to authenticated;

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
revoke all on function public.import_financial_snapshot_v3(uuid,text,jsonb,jsonb) from public;
grant execute on function public.import_financial_snapshot_v3(uuid,text,jsonb,jsonb) to authenticated;
