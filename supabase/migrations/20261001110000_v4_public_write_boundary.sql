-- Phase 1: make V4 the only authenticated financial snapshot write boundary.
--
-- This migration intentionally changes no financial data, table DML grants, or
-- lifecycle semantics. It moves the existing V3/V4 implementations behind a
-- narrow SECURITY DEFINER authorization boundary while retaining the existing
-- V4 -> V3 -> V2 -> V1 execution chain for the migration owner only.

create schema if not exists brumath_internal;

-- Internal implementations are not an authenticated-client API. The migration
-- owner and service_role retain the access needed for the controlled chain.
revoke all on schema brumath_internal from public;
revoke all on schema brumath_internal from anon;
revoke all on schema brumath_internal from authenticated;
grant usage on schema brumath_internal to service_role;

-- Move the V3 implementations first. The new public V3 compatibility wrappers
-- preserve the existing transaction-local guard for calls made by V4 only.
alter function public.replace_financial_snapshot_v3(uuid, jsonb, text)
  rename to replace_financial_snapshot_v3_internal;
alter function public.replace_financial_snapshot_v3_internal(uuid, jsonb, text)
  set schema brumath_internal;

alter function public.import_financial_snapshot_v3(uuid, text, jsonb, jsonb)
  rename to import_financial_snapshot_v3_internal;
alter function public.import_financial_snapshot_v3_internal(uuid, text, jsonb, jsonb)
  set schema brumath_internal;

-- Move the current V4 implementations without changing their V4 extension,
-- canonicalization, reconciliation, or P0001 behavior.
alter function public.replace_financial_snapshot_v4(uuid, jsonb, text)
  rename to replace_financial_snapshot_v4_internal;
alter function public.replace_financial_snapshot_v4_internal(uuid, jsonb, text)
  set schema brumath_internal;

alter function public.import_financial_snapshot_v4(uuid, text, jsonb, jsonb)
  rename to import_financial_snapshot_v4_internal;
alter function public.import_financial_snapshot_v4_internal(uuid, text, jsonb, jsonb)
  set schema brumath_internal;

revoke all on function brumath_internal.replace_financial_snapshot_v1_internal(uuid, jsonb, text) from public;
revoke all on function brumath_internal.replace_financial_snapshot_v1_internal(uuid, jsonb, text) from anon;
revoke all on function brumath_internal.replace_financial_snapshot_v1_internal(uuid, jsonb, text) from authenticated;
revoke all on function brumath_internal.import_financial_snapshot_v1_internal(uuid, text, jsonb, jsonb) from public;
revoke all on function brumath_internal.import_financial_snapshot_v1_internal(uuid, text, jsonb, jsonb) from anon;
revoke all on function brumath_internal.import_financial_snapshot_v1_internal(uuid, text, jsonb, jsonb) from authenticated;
revoke all on function brumath_internal.replace_financial_snapshot_v2_internal(uuid, jsonb, text) from public;
revoke all on function brumath_internal.replace_financial_snapshot_v2_internal(uuid, jsonb, text) from anon;
revoke all on function brumath_internal.replace_financial_snapshot_v2_internal(uuid, jsonb, text) from authenticated;
revoke all on function brumath_internal.import_financial_snapshot_v2_internal(uuid, text, jsonb, jsonb) from public;
revoke all on function brumath_internal.import_financial_snapshot_v2_internal(uuid, text, jsonb, jsonb) from anon;
revoke all on function brumath_internal.import_financial_snapshot_v2_internal(uuid, text, jsonb, jsonb) from authenticated;
revoke all on function brumath_internal.replace_financial_snapshot_v3_internal(uuid, jsonb, text) from public;
revoke all on function brumath_internal.replace_financial_snapshot_v3_internal(uuid, jsonb, text) from anon;
revoke all on function brumath_internal.replace_financial_snapshot_v3_internal(uuid, jsonb, text) from authenticated;
revoke all on function brumath_internal.import_financial_snapshot_v3_internal(uuid, text, jsonb, jsonb) from public;
revoke all on function brumath_internal.import_financial_snapshot_v3_internal(uuid, text, jsonb, jsonb) from anon;
revoke all on function brumath_internal.import_financial_snapshot_v3_internal(uuid, text, jsonb, jsonb) from authenticated;
revoke all on function brumath_internal.replace_financial_snapshot_v4_internal(uuid, jsonb, text) from public;
revoke all on function brumath_internal.replace_financial_snapshot_v4_internal(uuid, jsonb, text) from anon;
revoke all on function brumath_internal.replace_financial_snapshot_v4_internal(uuid, jsonb, text) from authenticated;
revoke all on function brumath_internal.import_financial_snapshot_v4_internal(uuid, text, jsonb, jsonb) from public;
revoke all on function brumath_internal.import_financial_snapshot_v4_internal(uuid, text, jsonb, jsonb) from anon;
revoke all on function brumath_internal.import_financial_snapshot_v4_internal(uuid, text, jsonb, jsonb) from authenticated;

create function public.replace_financial_snapshot_v3(
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
    raise exception 'replace_financial_snapshot_v3 is disabled after the V4 category-budget rollout';
  end if;

  return brumath_internal.replace_financial_snapshot_v3_internal(
    p_household_id,
    p_snapshot,
    p_revision_hash
  );
end;
$$;

create function public.import_financial_snapshot_v3(
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
    raise exception 'import_financial_snapshot_v3 is disabled after the V4 category-budget rollout';
  end if;

  return brumath_internal.import_financial_snapshot_v3_internal(
    p_household_id,
    p_source_hash,
    p_snapshot,
    p_summary
  );
end;
$$;

-- These are the only authenticated snapshot writers. Authorization derives
-- from the JWT and membership, never from the caller-supplied household id.
create function public.replace_financial_snapshot_v4(
  p_household_id uuid,
  p_snapshot jsonb,
  p_revision_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'authentication is required';
  end if;
  if not coalesce(public.is_household_member(p_household_id), false) then
    raise exception 'household membership is required';
  end if;

  return brumath_internal.replace_financial_snapshot_v4_internal(
    p_household_id,
    p_snapshot,
    p_revision_hash
  );
end;
$$;

create function public.import_financial_snapshot_v4(
  p_household_id uuid,
  p_source_hash text,
  p_snapshot jsonb,
  p_summary jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'authentication is required';
  end if;
  if not coalesce(public.is_household_member(p_household_id), false) then
    raise exception 'household membership is required';
  end if;

  return brumath_internal.import_financial_snapshot_v4_internal(
    p_household_id,
    p_source_hash,
    p_snapshot,
    p_summary
  );
end;
$$;

-- The production writer family is owned by postgres. Pin the new public
-- definer wrappers to that controlled owner instead of inheriting an
-- incidental migration role.
alter function public.replace_financial_snapshot_v4(uuid, jsonb, text) owner to postgres;
alter function public.import_financial_snapshot_v4(uuid, text, jsonb, jsonb) owner to postgres;

-- No authenticated caller can invoke legacy writers or any implementation
-- directly. The V4 definer wrapper invokes the guarded compatibility chain as
-- its controlled owner.
revoke all on function public.replace_financial_snapshot(uuid, jsonb, text) from public;
revoke all on function public.replace_financial_snapshot(uuid, jsonb, text) from anon;
revoke all on function public.replace_financial_snapshot(uuid, jsonb, text) from authenticated;
revoke all on function public.import_financial_snapshot(uuid, text, jsonb, jsonb) from public;
revoke all on function public.import_financial_snapshot(uuid, text, jsonb, jsonb) from anon;
revoke all on function public.import_financial_snapshot(uuid, text, jsonb, jsonb) from authenticated;
revoke all on function public.replace_financial_snapshot_v2(uuid, jsonb, text) from public;
revoke all on function public.replace_financial_snapshot_v2(uuid, jsonb, text) from anon;
revoke all on function public.replace_financial_snapshot_v2(uuid, jsonb, text) from authenticated;
revoke all on function public.import_financial_snapshot_v2(uuid, text, jsonb, jsonb) from public;
revoke all on function public.import_financial_snapshot_v2(uuid, text, jsonb, jsonb) from anon;
revoke all on function public.import_financial_snapshot_v2(uuid, text, jsonb, jsonb) from authenticated;
revoke all on function public.replace_financial_snapshot_v3(uuid, jsonb, text) from public;
revoke all on function public.replace_financial_snapshot_v3(uuid, jsonb, text) from anon;
revoke all on function public.replace_financial_snapshot_v3(uuid, jsonb, text) from authenticated;
revoke all on function public.import_financial_snapshot_v3(uuid, text, jsonb, jsonb) from public;
revoke all on function public.import_financial_snapshot_v3(uuid, text, jsonb, jsonb) from anon;
revoke all on function public.import_financial_snapshot_v3(uuid, text, jsonb, jsonb) from authenticated;
revoke all on function public.replace_financial_snapshot_v4(uuid, jsonb, text) from public;
revoke all on function public.replace_financial_snapshot_v4(uuid, jsonb, text) from anon;
revoke all on function public.import_financial_snapshot_v4(uuid, text, jsonb, jsonb) from public;
revoke all on function public.import_financial_snapshot_v4(uuid, text, jsonb, jsonb) from anon;
grant execute on function public.replace_financial_snapshot_v4(uuid, jsonb, text) to authenticated;
grant execute on function public.import_financial_snapshot_v4(uuid, text, jsonb, jsonb) to authenticated;

-- bootstrap_financial_household is intentionally untouched: it is a separate,
-- authenticated initialization contract rather than a snapshot writer.
