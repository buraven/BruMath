-- V4 owns installment_schedule_items just as it owns category_budgets. The
-- V3/V2/V1 chain deliberately never receives this V4-only collection.
--
-- Presence semantics are intentional:
--   * missing installment_schedule_items preserves rows for legacy snapshots;
--   * an explicitly present [] replaces the household schedule with empty.

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

    -- A full legacy replace can remove an installment. FK RESTRICT requires
    -- removing only its explicitly replaced schedule before that core write.
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

  -- category_budgets and installment_schedule_items are V4 extensions. The
  -- V3/V2/V1 reconciliation chain receives only the legacy projection.
  v_snapshot_v3 := jsonb_set(
    p_snapshot - 'installment_schedule_items',
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

  return jsonb_set(
    jsonb_set(v_result, '{settings,category_budgets}', v_category_budgets, true),
    '{installment_schedule_items}', v_schedule_readback, true
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
begin
  perform set_config('brumath.v4_snapshot_writer', 'enabled', true);
  v_snapshot_v3 := jsonb_set(
    p_snapshot - 'installment_schedule_items',
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
    v_snapshot := jsonb_set(
      jsonb_set(
        v_snapshot,
        '{settings,category_budgets}',
        coalesce(v_category_budgets, '{}'::jsonb),
        true
      ),
      '{installment_schedule_items}',
      v_schedule_readback,
      true
    );
  end if;
  return jsonb_build_object('imported', v_imported, 'snapshot', v_snapshot);
end; $$;

revoke all on function public.import_financial_snapshot_v4(uuid,text,jsonb,jsonb) from public;
revoke all on function public.import_financial_snapshot_v4(uuid,text,jsonb,jsonb) from anon;
grant execute on function public.import_financial_snapshot_v4(uuid,text,jsonb,jsonb) to authenticated;
