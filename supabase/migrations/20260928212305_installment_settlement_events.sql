-- A settlement is an immutable financial fact for one scheduled installment.
-- It deliberately does not require a card or invoice competence: invoice facts
-- remain the source for card cycles, while this table records the cases that
-- cannot be represented by them (notably cardless plans).

alter table public.installment_schedule_items
  add constraint installment_schedule_item_identity_key
  unique (household_id, id, installment_id, installment_number);

create table public.installment_settlement_events (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  legacy_id text not null,
  installment_schedule_item_id uuid not null,
  installment_id uuid not null,
  installment_number integer not null check (installment_number >= 1),
  amount numeric(14,2) not null check (amount >= 0),
  settled_on date not null,
  settlement_type text not null check (settlement_type in ('regular', 'anticipated')),
  created_at timestamptz not null default now(),
  constraint installment_settlement_legacy_unique unique (household_id, legacy_id),
  -- A schedule item represents one complete payable fact, so it has at most
  -- one immutable full settlement. Future reversals require a separate fact.
  constraint installment_settlement_item_unique
    unique (household_id, installment_schedule_item_id),
  constraint installment_settlement_schedule_identity_fk
    foreign key (
      household_id,
      installment_schedule_item_id,
      installment_id,
      installment_number
    )
    references public.installment_schedule_items(
      household_id,
      id,
      installment_id,
      installment_number
    )
    on delete restrict
);

create index installment_settlement_household_plan_number_idx
  on public.installment_settlement_events(
    household_id,
    installment_id,
    installment_number
  );

alter table public.installment_settlement_events enable row level security;

create policy "members read installment settlements"
  on public.installment_settlement_events for select to authenticated
  using (public.is_household_member(household_id));
create policy "members append installment settlements"
  on public.installment_settlement_events for insert to authenticated
  with check (
    public.is_household_member(household_id)
    and exists (
      select 1
      from public.installment_schedule_items schedule
      where schedule.household_id = installment_settlement_events.household_id
        and schedule.id = installment_settlement_events.installment_schedule_item_id
        and schedule.installment_id = installment_settlement_events.installment_id
        and schedule.installment_number = installment_settlement_events.installment_number
        and schedule.amount = installment_settlement_events.amount
    )
  );

revoke all on table public.installment_settlement_events from public;
revoke all on table public.installment_settlement_events from anon;
grant select, insert on table public.installment_settlement_events to authenticated;

create or replace function public.replace_financial_snapshot_v4(
  p_household_id uuid, p_snapshot jsonb, p_revision_hash text
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_result jsonb;
  v_category_budgets jsonb;
  v_snapshot_v3 jsonb;
  v_schedule_provided boolean := p_snapshot ? 'installment_schedule_items';
  v_schedule_source jsonb := coalesce(
    p_snapshot -> 'installment_schedule_items',
    '[]'::jsonb
  );
  v_schedule_readback jsonb;
  v_settlements_provided boolean := p_snapshot ? 'installment_settlement_events';
  v_settlements_source jsonb := coalesce(
    p_snapshot -> 'installment_settlement_events',
    '[]'::jsonb
  );
  v_settlements_readback jsonb;
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
      select 1
      from jsonb_array_elements(coalesce(p_snapshot -> 'categories', '[]'::jsonb)) category
      where category ->> 'legacy_id' = id
    )
  ) then
    raise exception 'settings category_budgets references a missing category';
  end if;

  if v_schedule_provided then
    if jsonb_typeof(v_schedule_source) <> 'array' then
      raise exception 'snapshot collection installment_schedule_items must be an array';
    end if;
    if exists (
      select 1 from jsonb_array_elements(v_schedule_source) item(value)
      where jsonb_typeof(item.value -> 'legacy_id') <> 'string'
         or coalesce(length(btrim(item.value ->> 'legacy_id')), 0) = 0
         or jsonb_typeof(item.value -> 'installment_legacy_id') <> 'number'
         or jsonb_typeof(item.value -> 'installment_number') <> 'number'
         or jsonb_typeof(item.value -> 'total_installments') <> 'number'
         or jsonb_typeof(item.value -> 'amount') <> 'number'
         or jsonb_typeof(item.value -> 'status') <> 'string'
         or (item.value ->> 'installment_legacy_id')::numeric <> trunc((item.value ->> 'installment_legacy_id')::numeric)
         or (item.value ->> 'installment_number')::numeric <> trunc((item.value ->> 'installment_number')::numeric)
         or (item.value ->> 'total_installments')::numeric <> trunc((item.value ->> 'total_installments')::numeric)
         or (item.value ->> 'installment_number')::numeric < 1
         or (item.value ->> 'total_installments')::numeric < 1
         or (item.value ->> 'installment_number')::numeric > (item.value ->> 'total_installments')::numeric
         or (item.value ->> 'amount')::numeric < 0
         or item.value ->> 'status' <> 'scheduled'
         or (item.value -> 'invoice_reference_month' is not null
             and jsonb_typeof(item.value -> 'invoice_reference_month') <> 'null'
             and (jsonb_typeof(item.value -> 'invoice_reference_month') <> 'string'
                  or item.value ->> 'invoice_reference_month' !~ '^[0-9]{4}-[0-9]{2}-01$'))
         or (item.value -> 'due_date' is not null
             and jsonb_typeof(item.value -> 'due_date') <> 'null'
             and (jsonb_typeof(item.value -> 'due_date') <> 'string'
                  or item.value ->> 'due_date' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'))
         or (item.value -> 'credit_card_legacy_id' is not null
             and jsonb_typeof(item.value -> 'credit_card_legacy_id') <> 'null'
             and jsonb_typeof(item.value -> 'credit_card_legacy_id') <> 'number')
         or (item.value -> 'credit_card_legacy_id' is not null
             and jsonb_typeof(item.value -> 'credit_card_legacy_id') <> 'null'
             and (item.value ->> 'credit_card_legacy_id')::numeric <> trunc((item.value ->> 'credit_card_legacy_id')::numeric))
    ) then
      raise exception 'snapshot installment_schedule_items has an invalid item';
    end if;
    if (select count(*) <> count(distinct item.value ->> 'legacy_id')
        from jsonb_array_elements(v_schedule_source) item(value)) then
      raise exception 'snapshot installment_schedule_items has duplicate legacy ids';
    end if;
    if (select count(*) <> count(distinct concat_ws(':', item.value ->> 'installment_legacy_id', item.value ->> 'installment_number'))
        from jsonb_array_elements(v_schedule_source) item(value)) then
      raise exception 'snapshot installment_schedule_items has duplicate plan numbers';
    end if;
    if exists (
      select 1 from jsonb_array_elements(v_schedule_source) item(value)
      where not exists (
        select 1 from jsonb_array_elements(p_snapshot -> 'installments') installment(value)
        where (installment.value ->> 'legacy_id')::bigint = (item.value ->> 'installment_legacy_id')::bigint
      )
    ) then
      raise exception 'schedule item references a missing installment';
    end if;
    if exists (
      select 1 from jsonb_array_elements(v_schedule_source) item(value)
      where item.value ->> 'credit_card_legacy_id' is not null
        and not exists (
          select 1 from jsonb_array_elements(p_snapshot -> 'credit_cards') card(value)
          where (card.value ->> 'legacy_id')::bigint = (item.value ->> 'credit_card_legacy_id')::bigint
        )
    ) then
      raise exception 'schedule item references a missing credit card';
    end if;

    -- A settled item is a historical fact: replace cannot delete or rewrite
    -- its plan facts, even if the caller explicitly replaces the schedule.
    if exists (
      select 1
      from public.installment_settlement_events settlement
      join public.installment_schedule_items current
        on current.id = settlement.installment_schedule_item_id
       and current.household_id = settlement.household_id
      left join jsonb_array_elements(v_schedule_source) source(value)
        on source.value ->> 'legacy_id' = current.legacy_id
      where settlement.household_id = p_household_id
        and (
          source.value is null
          or source.value ->> 'installment_legacy_id' is distinct from (
            select legacy_id::text from public.installments
            where id = current.installment_id and household_id = p_household_id
          )
          or source.value ->> 'installment_number' is distinct from current.installment_number::text
          or source.value ->> 'total_installments' is distinct from current.total_installments::text
          or source.value ->> 'amount' is distinct from current.amount::text
          or source.value ->> 'invoice_reference_month' is distinct from current.invoice_reference_month::text
          or source.value ->> 'due_date' is distinct from current.due_date::text
          or source.value ->> 'credit_card_legacy_id' is distinct from (
            select legacy_id::text from public.credit_cards
            where id = current.credit_card_id and household_id = p_household_id
          )
          or source.value ->> 'status' is distinct from current.status
        )
    ) then
      raise exception 'snapshot cannot rewrite a settled schedule item';
    end if;

    delete from public.installment_schedule_items current
     where current.household_id = p_household_id
       and not exists (
         select 1 from jsonb_array_elements(p_snapshot -> 'installments') installment(value)
         where (installment.value ->> 'legacy_id')::bigint = (
           select legacy_id from public.installments
           where id = current.installment_id and household_id = p_household_id
         )
       );
  end if;

  -- V4 extensions never enter the V3/V2/V1 reconciliation boundary.
  v_snapshot_v3 := jsonb_set(
    p_snapshot - 'installment_schedule_items' - 'installment_settlement_events',
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

  if v_schedule_provided then
    delete from public.installment_schedule_items current
     where current.household_id = p_household_id
       and not exists (
         select 1 from jsonb_array_elements(v_schedule_source) item(value)
         where item.value ->> 'legacy_id' = current.legacy_id
       );

    insert into public.installment_schedule_items(
      household_id, legacy_id, installment_id, installment_number,
      total_installments, amount, invoice_reference_month, due_date,
      credit_card_id, status
    )
    select
      p_household_id,
      item.value ->> 'legacy_id',
      installment.id,
      (item.value ->> 'installment_number')::integer,
      (item.value ->> 'total_installments')::integer,
      (item.value ->> 'amount')::numeric,
      nullif(item.value ->> 'invoice_reference_month', '')::date,
      nullif(item.value ->> 'due_date', '')::date,
      card.id,
      item.value ->> 'status'
    from jsonb_array_elements(v_schedule_source) item(value)
    join public.installments installment
      on installment.household_id = p_household_id
     and installment.legacy_id = (item.value ->> 'installment_legacy_id')::bigint
    left join public.credit_cards card
      on card.household_id = p_household_id
     and card.legacy_id = nullif(item.value ->> 'credit_card_legacy_id', '')::bigint
    on conflict (household_id, legacy_id) do update set
      installment_id = excluded.installment_id,
      installment_number = excluded.installment_number,
      total_installments = excluded.total_installments,
      amount = excluded.amount,
      invoice_reference_month = excluded.invoice_reference_month,
      due_date = excluded.due_date,
      credit_card_id = excluded.credit_card_id,
      status = excluded.status,
      updated_at = now();
  end if;

  if v_settlements_provided then
    if jsonb_typeof(v_settlements_source) <> 'array' then
      raise exception 'snapshot collection installment_settlement_events must be an array';
    end if;
    if exists (
      select 1 from jsonb_array_elements(v_settlements_source) event(value)
      where jsonb_typeof(event.value -> 'legacy_id') <> 'string'
         or coalesce(length(btrim(event.value ->> 'legacy_id')), 0) = 0
         or jsonb_typeof(event.value -> 'installment_legacy_id') <> 'number'
         or jsonb_typeof(event.value -> 'installment_number') <> 'number'
         or jsonb_typeof(event.value -> 'amount') <> 'number'
         or jsonb_typeof(event.value -> 'settled_on') <> 'string'
         or jsonb_typeof(event.value -> 'settlement_type') <> 'string'
         or (event.value ->> 'installment_legacy_id')::numeric <> trunc((event.value ->> 'installment_legacy_id')::numeric)
         or (event.value ->> 'installment_number')::numeric <> trunc((event.value ->> 'installment_number')::numeric)
         or (event.value ->> 'installment_number')::numeric < 1
         or (event.value ->> 'amount')::numeric < 0
         or event.value ->> 'settled_on' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
         or event.value ->> 'settlement_type' not in ('regular', 'anticipated')
    ) then
      raise exception 'snapshot installment_settlement_events has an invalid item';
    end if;
    if (select count(*) <> count(distinct event.value ->> 'legacy_id')
        from jsonb_array_elements(v_settlements_source) event(value)) then
      raise exception 'snapshot installment_settlement_events has duplicate legacy ids';
    end if;
    if (select count(*) <> count(distinct concat_ws(':', event.value ->> 'installment_legacy_id', event.value ->> 'installment_number'))
        from jsonb_array_elements(v_settlements_source) event(value)) then
      raise exception 'snapshot installment_settlement_events has duplicate plan numbers';
    end if;
    if exists (
      select 1
      from public.installment_settlement_events current
      where current.household_id = p_household_id
        and not exists (
          select 1 from jsonb_array_elements(v_settlements_source) event(value)
          where event.value ->> 'legacy_id' = current.legacy_id
        )
    ) then
      raise exception 'snapshot cannot remove an immutable settlement event';
    end if;
    if exists (
      select 1
      from public.installment_settlement_events current
      join jsonb_array_elements(v_settlements_source) event(value)
        on event.value ->> 'legacy_id' = current.legacy_id
      join public.installments installment
        on installment.id = current.installment_id
       and installment.household_id = current.household_id
      where current.household_id = p_household_id
        and (
          event.value ->> 'installment_legacy_id' is distinct from installment.legacy_id::text
          or event.value ->> 'installment_number' is distinct from current.installment_number::text
          or event.value ->> 'amount' is distinct from current.amount::text
          or event.value ->> 'settled_on' is distinct from current.settled_on::text
          or event.value ->> 'settlement_type' is distinct from current.settlement_type
        )
    ) then
      raise exception 'snapshot cannot rewrite an immutable settlement event';
    end if;
    if exists (
      select 1
      from jsonb_array_elements(v_settlements_source) event(value)
      join public.installments installment
        on installment.household_id = p_household_id
       and installment.legacy_id = (event.value ->> 'installment_legacy_id')::bigint
      join public.installment_schedule_items schedule
        on schedule.household_id = p_household_id
       and schedule.installment_id = installment.id
       and schedule.installment_number = (event.value ->> 'installment_number')::integer
      where schedule.amount <> (event.value ->> 'amount')::numeric
    ) then
      raise exception 'settlement amount must equal its scheduled amount';
    end if;
    if exists (
      select 1
      from jsonb_array_elements(v_settlements_source) event(value)
      where not exists (
        select 1
        from public.installments installment
        join public.installment_schedule_items schedule
          on schedule.household_id = installment.household_id
         and schedule.installment_id = installment.id
         and schedule.installment_number = (event.value ->> 'installment_number')::integer
        where installment.household_id = p_household_id
          and installment.legacy_id = (event.value ->> 'installment_legacy_id')::bigint
      )
    ) then
      raise exception 'settlement event references a missing schedule item';
    end if;
    if exists (
      select 1
      from jsonb_array_elements(v_settlements_source) event(value)
      join public.installments installment
        on installment.household_id = p_household_id
       and installment.legacy_id = (event.value ->> 'installment_legacy_id')::bigint
      join public.installment_schedule_items schedule
        on schedule.household_id = p_household_id
       and schedule.installment_id = installment.id
       and schedule.installment_number = (event.value ->> 'installment_number')::integer
      join public.installment_settlement_events current
        on current.household_id = p_household_id
       and current.installment_schedule_item_id = schedule.id
      where current.legacy_id <> event.value ->> 'legacy_id'
    ) then
      raise exception 'schedule item already has an immutable settlement event';
    end if;

    insert into public.installment_settlement_events(
      household_id, legacy_id, installment_schedule_item_id, installment_id,
      installment_number, amount, settled_on, settlement_type
    )
    select
      p_household_id,
      event.value ->> 'legacy_id',
      schedule.id,
      installment.id,
      (event.value ->> 'installment_number')::integer,
      (event.value ->> 'amount')::numeric,
      (event.value ->> 'settled_on')::date,
      event.value ->> 'settlement_type'
    from jsonb_array_elements(v_settlements_source) event(value)
    join public.installments installment
      on installment.household_id = p_household_id
     and installment.legacy_id = (event.value ->> 'installment_legacy_id')::bigint
    join public.installment_schedule_items schedule
      on schedule.household_id = p_household_id
     and schedule.installment_id = installment.id
     and schedule.installment_number = (event.value ->> 'installment_number')::integer
    on conflict (household_id, legacy_id) do nothing;
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'legacy_id', item.legacy_id,
        'installment_legacy_id', installment.legacy_id,
        'installment_number', item.installment_number,
        'total_installments', item.total_installments,
        'amount', item.amount,
        'invoice_reference_month', item.invoice_reference_month,
        'due_date', item.due_date,
        'credit_card_legacy_id', card.legacy_id,
        'status', item.status
      ) order by installment.legacy_id, item.installment_number, item.legacy_id
    ),
    '[]'::jsonb
  ) into v_schedule_readback
  from public.installment_schedule_items item
  join public.installments installment
    on installment.id = item.installment_id
   and installment.household_id = item.household_id
  left join public.credit_cards card
    on card.id = item.credit_card_id
   and card.household_id = item.household_id
  where item.household_id = p_household_id;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'legacy_id', settlement.legacy_id,
        'installment_legacy_id', installment.legacy_id,
        'installment_number', settlement.installment_number,
        'amount', settlement.amount,
        'settled_on', settlement.settled_on,
        'settlement_type', settlement.settlement_type
      ) order by installment.legacy_id, settlement.installment_number, settlement.legacy_id
    ),
    '[]'::jsonb
  ) into v_settlements_readback
  from public.installment_settlement_events settlement
  join public.installments installment
    on installment.id = settlement.installment_id
   and installment.household_id = settlement.household_id
  where settlement.household_id = p_household_id;

  if v_schedule_provided then
    select coalesce(
      jsonb_agg(item.value order by
        (item.value ->> 'installment_legacy_id')::bigint,
        (item.value ->> 'installment_number')::integer,
        item.value ->> 'legacy_id'
      ),
      '[]'::jsonb
    ) into v_schedule_source
    from jsonb_array_elements(v_schedule_source) item(value);
    if v_schedule_source is distinct from v_schedule_readback then
      raise exception 'persisted snapshot does not reconcile with source snapshot';
    end if;
  end if;
  if v_settlements_provided then
    select coalesce(
      jsonb_agg(event.value order by
        (event.value ->> 'installment_legacy_id')::bigint,
        (event.value ->> 'installment_number')::integer,
        event.value ->> 'legacy_id'
      ),
      '[]'::jsonb
    ) into v_settlements_source
    from jsonb_array_elements(v_settlements_source) event(value);
    if v_settlements_source is distinct from v_settlements_readback then
      raise exception 'persisted snapshot does not reconcile with source snapshot';
    end if;
  end if;

  return jsonb_set(
    jsonb_set(
      jsonb_set(v_result, '{settings,category_budgets}', v_category_budgets, true),
      '{installment_schedule_items}', v_schedule_readback, true
    ),
    '{installment_settlement_events}', v_settlements_readback, true
  );
end; $$;

revoke all on function public.replace_financial_snapshot_v4(uuid,jsonb,text) from public;
revoke all on function public.replace_financial_snapshot_v4(uuid,jsonb,text) from anon;
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
  v_schedule_readback jsonb;
  v_settlements_readback jsonb;
begin
  perform set_config('brumath.v4_snapshot_writer', 'enabled', true);
  v_snapshot_v3 := jsonb_set(
    p_snapshot - 'installment_schedule_items' - 'installment_settlement_events',
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
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'legacy_id', item.legacy_id,
          'installment_legacy_id', installment.legacy_id,
          'installment_number', item.installment_number,
          'total_installments', item.total_installments,
          'amount', item.amount,
          'invoice_reference_month', item.invoice_reference_month,
          'due_date', item.due_date,
          'credit_card_legacy_id', card.legacy_id,
          'status', item.status
        ) order by installment.legacy_id, item.installment_number, item.legacy_id
      ),
      '[]'::jsonb
    ) into v_schedule_readback
    from public.installment_schedule_items item
    join public.installments installment
      on installment.id = item.installment_id
     and installment.household_id = item.household_id
    left join public.credit_cards card
      on card.id = item.credit_card_id
     and card.household_id = item.household_id
    where item.household_id = p_household_id;
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'legacy_id', settlement.legacy_id,
          'installment_legacy_id', installment.legacy_id,
          'installment_number', settlement.installment_number,
          'amount', settlement.amount,
          'settled_on', settlement.settled_on,
          'settlement_type', settlement.settlement_type
        ) order by installment.legacy_id, settlement.installment_number, settlement.legacy_id
      ),
      '[]'::jsonb
    ) into v_settlements_readback
    from public.installment_settlement_events settlement
    join public.installments installment
      on installment.id = settlement.installment_id
     and installment.household_id = settlement.household_id
    where settlement.household_id = p_household_id;
    v_snapshot := jsonb_set(
      jsonb_set(
        jsonb_set(
          v_snapshot,
          '{settings,category_budgets}',
          coalesce(v_category_budgets, '{}'::jsonb),
          true
        ),
        '{installment_schedule_items}',
        v_schedule_readback,
        true
      ),
      '{installment_settlement_events}',
      v_settlements_readback,
      true
    );
  end if;
  return jsonb_build_object('imported', v_imported, 'snapshot', v_snapshot);
end; $$;

revoke all on function public.import_financial_snapshot_v4(uuid,text,jsonb,jsonb) from public;
revoke all on function public.import_financial_snapshot_v4(uuid,text,jsonb,jsonb) from anon;
grant execute on function public.import_financial_snapshot_v4(uuid,text,jsonb,jsonb) to authenticated;
