-- This migration deliberately leaves the foundation schema untouched.  The RPCs
-- below run as the authenticated caller, so the existing RLS policies remain the
-- authorization boundary for both bootstrap and import.

alter table public.local_imports
  add column if not exists snapshot jsonb not null default '{}'::jsonb;

create or replace function public.bootstrap_financial_household()
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_household_id uuid;
begin
  if v_user_id is null then
    raise exception 'authentication is required';
  end if;

  -- A retry or two browser tabs must not create two owner households.
  perform pg_advisory_xact_lock(hashtext(v_user_id::text));

  select h.id
    into v_household_id
    from public.households h
   where h.owner_id = v_user_id
   order by h.created_at
   limit 1;

  if v_household_id is null then
    insert into public.households (owner_id)
    values (v_user_id)
    returning id into v_household_id;
  end if;

  insert into public.household_members (household_id, user_id, role)
  values (v_household_id, v_user_id, 'owner')
  on conflict (household_id, user_id) do update set role = 'owner';

  insert into public.financial_settings (household_id)
  values (v_household_id)
  on conflict (household_id) do nothing;

  return v_household_id;
end;
$$;

create or replace function public.import_financial_snapshot(
  p_household_id uuid,
  p_source_hash text,
  p_snapshot jsonb,
  p_summary jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_existing jsonb;
  v_persisted jsonb;
  v_collection text;
begin
  if v_user_id is null then
    raise exception 'authentication is required';
  end if;
  if p_source_hash is null or length(trim(p_source_hash)) = 0 then
    raise exception 'source hash is required';
  end if;
  if p_snapshot is null or jsonb_typeof(p_snapshot) <> 'object' then
    raise exception 'a snapshot object is required';
  end if;
  if not public.is_household_member(p_household_id) then
    raise exception 'household membership is required';
  end if;

  -- Serialize same-snapshot imports before checking the unique constraint, so a
  -- concurrent retry observes the first completed import as idempotent.
  perform pg_advisory_xact_lock(hashtext(p_household_id::text || ':' || p_source_hash));

  select li.snapshot into v_existing
    from public.local_imports li
   where li.household_id = p_household_id
     and li.source_hash = p_source_hash;
  if found then
    return jsonb_build_object('imported', false, 'snapshot', v_existing);
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

  -- The browser preview performs the same checks, but the RPC is also a public
  -- API boundary and must reject malformed legacy identity on its own.
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

  insert into public.financial_settings (
    household_id, income, budgets, limits, personal_limits, active_profile, view_month
  )
  select
    p_household_id,
    coalesce((p_snapshot #>> '{settings,income}')::numeric, 0),
    coalesce(p_snapshot #> '{settings,budgets}', '{}'::jsonb),
    coalesce(p_snapshot #> '{settings,limits}', '{}'::jsonb),
    coalesce(p_snapshot #> '{settings,personal_limits}', '{}'::jsonb),
    coalesce(p_snapshot #>> '{settings,active_profile}', 'Bruna'),
    coalesce((p_snapshot #>> '{settings,view_month}')::date, date_trunc('month', current_date)::date)
  on conflict (household_id) do update set
    income = excluded.income,
    budgets = excluded.budgets,
    limits = excluded.limits,
    personal_limits = excluded.personal_limits,
    active_profile = excluded.active_profile,
    view_month = excluded.view_month,
    updated_at = now();

  insert into public.credit_cards (
    household_id, legacy_id, name, issuer, owner, credit_limit, closing_day, due_day, appearance, active
  )
  select p_household_id, c.legacy_id, c.name, c.issuer, c.owner, c.credit_limit,
    c.closing_day, c.due_day, c.appearance, c.active
  from jsonb_to_recordset(p_snapshot -> 'credit_cards') as c(
    legacy_id bigint, name text, issuer text, owner text, credit_limit numeric,
    closing_day integer, due_day integer, appearance text, active boolean
  )
  on conflict (household_id, legacy_id) do update set
    name = excluded.name, issuer = excluded.issuer, owner = excluded.owner,
    credit_limit = excluded.credit_limit, closing_day = excluded.closing_day,
    due_day = excluded.due_day, appearance = excluded.appearance, active = excluded.active;

  insert into public.expenses (
    household_id, legacy_id, title, category, responsible, amount, occurred_on,
    personal_limit_bucket, credit_card_legacy_id
  )
  select p_household_id, e.legacy_id, e.title, e.category, e.responsible, e.amount,
    e.occurred_on, e.personal_limit_bucket, e.credit_card_legacy_id
  from jsonb_to_recordset(p_snapshot -> 'expenses') as e(
    legacy_id bigint, title text, category text, responsible text, amount numeric,
    occurred_on date, personal_limit_bucket text, credit_card_legacy_id bigint
  )
  on conflict (household_id, legacy_id) do update set
    title = excluded.title, category = excluded.category, responsible = excluded.responsible,
    amount = excluded.amount, occurred_on = excluded.occurred_on,
    personal_limit_bucket = excluded.personal_limit_bucket,
    credit_card_legacy_id = excluded.credit_card_legacy_id;

  insert into public.installments (
    household_id, legacy_id, title, category, responsible, amount, total_installments,
    paid_installments, next_due, credit_card_legacy_id
  )
  select p_household_id, i.legacy_id, i.title, i.category, i.responsible, i.amount,
    i.total_installments, i.paid_installments, i.next_due, i.credit_card_legacy_id
  from jsonb_to_recordset(p_snapshot -> 'installments') as i(
    legacy_id bigint, title text, category text, responsible text, amount numeric,
    total_installments integer, paid_installments integer, next_due date, credit_card_legacy_id bigint
  )
  on conflict (household_id, legacy_id) do update set
    title = excluded.title, category = excluded.category, responsible = excluded.responsible,
    amount = excluded.amount, total_installments = excluded.total_installments,
    paid_installments = excluded.paid_installments, next_due = excluded.next_due,
    credit_card_legacy_id = excluded.credit_card_legacy_id;

  insert into public.receivables (
    household_id, legacy_id, person, amount, paid, destination, note, competence_month, received_month
  )
  select p_household_id, r.legacy_id, r.person, r.amount, r.paid, r.destination,
    r.note, r.competence_month, r.received_month
  from jsonb_to_recordset(p_snapshot -> 'receivables') as r(
    legacy_id bigint, person text, amount numeric, paid numeric, destination text,
    note text, competence_month date, received_month date
  )
  on conflict (household_id, legacy_id) do update set
    person = excluded.person, amount = excluded.amount, paid = excluded.paid,
    destination = excluded.destination, note = excluded.note,
    competence_month = excluded.competence_month, received_month = excluded.received_month;

  insert into public.income_entries (
    household_id, legacy_id, title, amount, responsible, occurred_on, destination, note
  )
  select p_household_id, i.legacy_id, i.title, i.amount, i.responsible,
    i.occurred_on, i.destination, i.note
  from jsonb_to_recordset(p_snapshot -> 'income_entries') as i(
    legacy_id bigint, title text, amount numeric, responsible text, occurred_on date,
    destination text, note text
  )
  on conflict (household_id, legacy_id) do update set
    title = excluded.title, amount = excluded.amount, responsible = excluded.responsible,
    occurred_on = excluded.occurred_on, destination = excluded.destination, note = excluded.note;

  insert into public.invoice_payments (
    household_id, legacy_id, card_legacy_id, reference_month, paid_at, amount
  )
  select p_household_id, p.legacy_id, p.card_legacy_id, p.reference_month, p.paid_at, p.amount
  from jsonb_to_recordset(p_snapshot -> 'invoice_payments') as p(
    legacy_id bigint, card_legacy_id bigint, reference_month date, paid_at date, amount numeric
  )
  on conflict (household_id, legacy_id) do update set
    card_legacy_id = excluded.card_legacy_id, reference_month = excluded.reference_month,
    paid_at = excluded.paid_at, amount = excluded.amount;

  select jsonb_build_object(
    'settings', jsonb_build_object(
      'income', s.income, 'budgets', s.budgets, 'limits', s.limits,
      'personal_limits', s.personal_limits, 'active_profile', s.active_profile,
      'view_month', s.view_month
    ),
    'expenses', coalesce((select jsonb_agg(jsonb_build_object(
      'legacy_id', e.legacy_id, 'title', e.title, 'category', e.category,
      'responsible', e.responsible, 'amount', e.amount, 'occurred_on', e.occurred_on,
      'personal_limit_bucket', e.personal_limit_bucket,
      'credit_card_legacy_id', e.credit_card_legacy_id
    ) order by e.legacy_id) from public.expenses e where e.household_id = p_household_id), '[]'::jsonb),
    'installments', coalesce((select jsonb_agg(jsonb_build_object(
      'legacy_id', i.legacy_id, 'title', i.title, 'category', i.category,
      'responsible', i.responsible, 'amount', i.amount,
      'total_installments', i.total_installments, 'paid_installments', i.paid_installments,
      'next_due', i.next_due, 'credit_card_legacy_id', i.credit_card_legacy_id
    ) order by i.legacy_id) from public.installments i where i.household_id = p_household_id), '[]'::jsonb),
    'receivables', coalesce((select jsonb_agg(jsonb_build_object(
      'legacy_id', r.legacy_id, 'person', r.person, 'amount', r.amount, 'paid', r.paid,
      'destination', r.destination, 'note', r.note, 'competence_month', r.competence_month,
      'received_month', r.received_month
    ) order by r.legacy_id) from public.receivables r where r.household_id = p_household_id), '[]'::jsonb),
    'income_entries', coalesce((select jsonb_agg(jsonb_build_object(
      'legacy_id', i.legacy_id, 'title', i.title, 'amount', i.amount,
      'responsible', i.responsible, 'occurred_on', i.occurred_on,
      'destination', i.destination, 'note', i.note
    ) order by i.legacy_id) from public.income_entries i where i.household_id = p_household_id), '[]'::jsonb),
    'credit_cards', coalesce((select jsonb_agg(jsonb_build_object(
      'legacy_id', c.legacy_id, 'name', c.name, 'issuer', c.issuer, 'owner', c.owner,
      'credit_limit', c.credit_limit, 'closing_day', c.closing_day, 'due_day', c.due_day,
      'appearance', c.appearance, 'active', c.active
    ) order by c.legacy_id) from public.credit_cards c where c.household_id = p_household_id), '[]'::jsonb),
    'invoice_payments', coalesce((select jsonb_agg(jsonb_build_object(
      'legacy_id', p.legacy_id, 'card_legacy_id', p.card_legacy_id,
      'reference_month', p.reference_month, 'paid_at', p.paid_at, 'amount', p.amount
    ) order by p.legacy_id) from public.invoice_payments p where p.household_id = p_household_id), '[]'::jsonb)
  ) into v_persisted
  from public.financial_settings s
  where s.household_id = p_household_id;

  if v_persisted is distinct from p_snapshot then
    raise exception 'persisted snapshot does not reconcile with source snapshot';
  end if;

  insert into public.local_imports (household_id, source_hash, summary, snapshot)
  values (p_household_id, p_source_hash, p_summary, v_persisted);

  return jsonb_build_object('imported', true, 'snapshot', v_persisted);
end;
$$;

revoke all on function public.bootstrap_financial_household() from public;
revoke all on function public.import_financial_snapshot(uuid, text, jsonb, jsonb) from public;
revoke all on function public.is_household_member(uuid) from public;
grant execute on function public.bootstrap_financial_household() to authenticated;
grant execute on function public.import_financial_snapshot(uuid, text, jsonb, jsonb) to authenticated;
grant execute on function public.is_household_member(uuid) to authenticated;
