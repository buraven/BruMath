-- The schedule is a controlled V4 extension. Authenticated clients may read
-- it through RLS, but must never mutate its rows outside the validated V4
-- snapshot writer or the narrow Class-A materializer.
--
-- Keep the existing V4 implementations intact in the non-exposed schema.
-- The public wrappers below are the only privileged entry points. They check
-- both the JWT principal and household membership before entering the former
-- SECURITY INVOKER implementation. This avoids granting table DML simply so
-- an invoker function can reach its own schedule extension.

alter function public.replace_financial_snapshot_v4(uuid, jsonb, text)
  rename to replace_financial_snapshot_v4_internal;
alter function public.replace_financial_snapshot_v4_internal(uuid, jsonb, text)
  set schema brumath_internal;

alter function public.import_financial_snapshot_v4(uuid, text, jsonb, jsonb)
  rename to import_financial_snapshot_v4_internal;
alter function public.import_financial_snapshot_v4_internal(uuid, text, jsonb, jsonb)
  set schema brumath_internal;

revoke all on function brumath_internal.replace_financial_snapshot_v4_internal(uuid, jsonb, text) from public;
revoke all on function brumath_internal.replace_financial_snapshot_v4_internal(uuid, jsonb, text) from anon;
revoke all on function brumath_internal.replace_financial_snapshot_v4_internal(uuid, jsonb, text) from authenticated;
revoke all on function brumath_internal.import_financial_snapshot_v4_internal(uuid, text, jsonb, jsonb) from public;
revoke all on function brumath_internal.import_financial_snapshot_v4_internal(uuid, text, jsonb, jsonb) from anon;
revoke all on function brumath_internal.import_financial_snapshot_v4_internal(uuid, text, jsonb, jsonb) from authenticated;

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

-- Class-A materialization already validates the complete schedule, protected
-- facts, and its per-plan lock. It needs the same narrow privileged boundary
-- once direct schedule INSERT is removed.
alter function public.materialize_legacy_installment_schedule_class_a(uuid, bigint, jsonb)
  security definer;
alter function public.materialize_legacy_installment_schedule_class_a(uuid, bigint, jsonb)
  set search_path = '';

revoke all on function public.replace_financial_snapshot_v4(uuid, jsonb, text) from public;
revoke all on function public.replace_financial_snapshot_v4(uuid, jsonb, text) from anon;
revoke all on function public.import_financial_snapshot_v4(uuid, text, jsonb, jsonb) from public;
revoke all on function public.import_financial_snapshot_v4(uuid, text, jsonb, jsonb) from anon;
revoke all on function public.materialize_legacy_installment_schedule_class_a(uuid, bigint, jsonb) from public;
revoke all on function public.materialize_legacy_installment_schedule_class_a(uuid, bigint, jsonb) from anon;
grant execute on function public.replace_financial_snapshot_v4(uuid, jsonb, text) to authenticated;
grant execute on function public.import_financial_snapshot_v4(uuid, text, jsonb, jsonb) to authenticated;
grant execute on function public.materialize_legacy_installment_schedule_class_a(uuid, bigint, jsonb) to authenticated;

revoke all privileges on table public.installment_schedule_items from public;
revoke all privileges on table public.installment_schedule_items from anon;
revoke all privileges on table public.installment_schedule_items from authenticated;
grant select on table public.installment_schedule_items to authenticated;
