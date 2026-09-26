-- V4 owns the current write contract.  V1/V2 must remain callable only from
-- the V4 transaction chain (V4 -> V3 -> V2 -> V1), not from the public RPC
-- surface. Their original implementations are moved to a non-exposed schema;
-- public compatibility wrappers enforce the same transaction-local context
-- that already protects direct V3 writes. All functions remain SECURITY
-- INVOKER, so RLS and household membership checks continue to run as the
-- authenticated caller.

create schema if not exists brumath_internal;
revoke all on schema brumath_internal from public;
grant usage on schema brumath_internal to authenticated;
grant usage on schema brumath_internal to service_role;

alter function public.replace_financial_snapshot(uuid, jsonb, text)
  rename to replace_financial_snapshot_v1_internal;
alter function public.replace_financial_snapshot_v1_internal(uuid, jsonb, text)
  set schema brumath_internal;

alter function public.import_financial_snapshot(uuid, text, jsonb, jsonb)
  rename to import_financial_snapshot_v1_internal;
alter function public.import_financial_snapshot_v1_internal(uuid, text, jsonb, jsonb)
  set schema brumath_internal;

alter function public.replace_financial_snapshot_v2(uuid, jsonb, text)
  rename to replace_financial_snapshot_v2_internal;
alter function public.replace_financial_snapshot_v2_internal(uuid, jsonb, text)
  set schema brumath_internal;

alter function public.import_financial_snapshot_v2(uuid, text, jsonb, jsonb)
  rename to import_financial_snapshot_v2_internal;
alter function public.import_financial_snapshot_v2_internal(uuid, text, jsonb, jsonb)
  set schema brumath_internal;

revoke all on function brumath_internal.replace_financial_snapshot_v1_internal(uuid, jsonb, text) from public;
revoke all on function brumath_internal.import_financial_snapshot_v1_internal(uuid, text, jsonb, jsonb) from public;
revoke all on function brumath_internal.replace_financial_snapshot_v2_internal(uuid, jsonb, text) from public;
revoke all on function brumath_internal.import_financial_snapshot_v2_internal(uuid, text, jsonb, jsonb) from public;
grant execute on function brumath_internal.replace_financial_snapshot_v1_internal(uuid, jsonb, text) to authenticated;
grant execute on function brumath_internal.import_financial_snapshot_v1_internal(uuid, text, jsonb, jsonb) to authenticated;
grant execute on function brumath_internal.replace_financial_snapshot_v2_internal(uuid, jsonb, text) to authenticated;
grant execute on function brumath_internal.import_financial_snapshot_v2_internal(uuid, text, jsonb, jsonb) to authenticated;
grant execute on function brumath_internal.replace_financial_snapshot_v1_internal(uuid, jsonb, text) to service_role;
grant execute on function brumath_internal.import_financial_snapshot_v1_internal(uuid, text, jsonb, jsonb) to service_role;
grant execute on function brumath_internal.replace_financial_snapshot_v2_internal(uuid, jsonb, text) to service_role;
grant execute on function brumath_internal.import_financial_snapshot_v2_internal(uuid, text, jsonb, jsonb) to service_role;

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
begin
  if current_setting('brumath.v4_snapshot_writer', true) is distinct from 'enabled' then
    raise exception 'replace_financial_snapshot is disabled after the V4 category-budget rollout';
  end if;
  return brumath_internal.replace_financial_snapshot_v1_internal(
    p_household_id,
    p_snapshot,
    p_revision_hash
  );
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
begin
  if current_setting('brumath.v4_snapshot_writer', true) is distinct from 'enabled' then
    raise exception 'import_financial_snapshot is disabled after the V4 category-budget rollout';
  end if;
  return brumath_internal.import_financial_snapshot_v1_internal(
    p_household_id,
    p_source_hash,
    p_snapshot,
    p_summary
  );
end;
$$;

create or replace function public.replace_financial_snapshot_v2(
  p_household_id uuid,
  p_snapshot jsonb,
  p_revision_hash text
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if current_setting('brumath.v4_snapshot_writer', true) is distinct from 'enabled' then
    raise exception 'replace_financial_snapshot_v2 is disabled after the V4 category-budget rollout';
  end if;
  return brumath_internal.replace_financial_snapshot_v2_internal(
    p_household_id,
    p_snapshot,
    p_revision_hash
  );
end;
$$;

create or replace function public.import_financial_snapshot_v2(
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
begin
  if current_setting('brumath.v4_snapshot_writer', true) is distinct from 'enabled' then
    raise exception 'import_financial_snapshot_v2 is disabled after the V4 category-budget rollout';
  end if;
  return brumath_internal.import_financial_snapshot_v2_internal(
    p_household_id,
    p_source_hash,
    p_snapshot,
    p_summary
  );
end;
$$;

revoke all on function public.replace_financial_snapshot(uuid, jsonb, text) from public;
revoke all on function public.import_financial_snapshot(uuid, text, jsonb, jsonb) from public;
revoke all on function public.replace_financial_snapshot_v2(uuid, jsonb, text) from public;
revoke all on function public.import_financial_snapshot_v2(uuid, text, jsonb, jsonb) from public;
revoke all on function public.replace_financial_snapshot(uuid, jsonb, text) from anon;
revoke all on function public.import_financial_snapshot(uuid, text, jsonb, jsonb) from anon;
revoke all on function public.replace_financial_snapshot_v2(uuid, jsonb, text) from anon;
revoke all on function public.import_financial_snapshot_v2(uuid, text, jsonb, jsonb) from anon;
grant execute on function public.replace_financial_snapshot(uuid, jsonb, text) to authenticated;
grant execute on function public.import_financial_snapshot(uuid, text, jsonb, jsonb) to authenticated;
grant execute on function public.replace_financial_snapshot_v2(uuid, jsonb, text) to authenticated;
grant execute on function public.import_financial_snapshot_v2(uuid, text, jsonb, jsonb) to authenticated;
