<#
  PostgreSQL runtime gate for Phase 1 / V4 public write boundary.

  This script is deliberately host-local. It only invokes `docker exec` against
  the local Supabase Postgres container labelled for BruMath-pr44 and refuses
  every non-loopback host/port combination before any SQL is sent.

  Usage (Windows host, from the repository root):
    powershell -ExecutionPolicy Bypass -File .\scripts\run-phase1-postgresql-gate.ps1
#>
[CmdletBinding()]
param(
  [ValidateSet('127.0.0.1', 'localhost')]
  [string]$PostgresHost = '127.0.0.1',
  [ValidateRange(1, 65535)]
  [int]$PostgresPort = 56598,
  [switch]$AllowLocalPortOverride,
  [string]$ExpectedProject = 'BruMath-pr44'
)

$ErrorActionPreference = 'Stop'
$expectedMigration = '20261001110000'
$fixturesStarted = $false

function Fail([string]$message) {
  Write-Host "FAIL: $message" -ForegroundColor Red
  throw $message
}

function Require([bool]$condition, [string]$message) {
  if (-not $condition) { Fail $message }
}

function Finish([ValidateSet('PASS', 'FAIL', 'NOT RUN')][string]$status) {
  $color = if ($status -eq 'PASS') { 'Green' } else { 'Red' }
  Write-Host "PHASE 1 POSTGRESQL GATE: $status" -ForegroundColor $color
  exit $(if ($status -eq 'PASS') { 0 } else { 1 })
}

try {
  # These checks intentionally run before Docker/SQL. There is no remote mode,
  # project ref, Supabase CLI command, URL, credential, or remote fallback.
  Require ($PostgresHost -in @('127.0.0.1', 'localhost')) 'PostgresHost must be exactly 127.0.0.1 or localhost.'
  Require (($PostgresPort -eq 56598) -or $AllowLocalPortOverride) 'A non-default PostgreSQL port requires -AllowLocalPortOverride and must still be localhost.'
  Require ($ExpectedProject -eq 'BruMath-pr44') 'ExpectedProject must be BruMath-pr44.'
  $docker = Get-Command docker -ErrorAction Stop
  Write-Host "Target: postgresql://$PostgresHost`:$PostgresPort (local Supabase only)"

  # Every local Supabase service shares the project label (Kong, Auth, Studio,
  # postgres-meta, PostgREST, etc.). The database identity is cumulative: its
  # exact name, image repository, label, running state and port binding.
  $projectContainers = @(& $docker.Source ps --filter "label=com.supabase.cli.project=$ExpectedProject" --filter 'status=running' --format '{{.ID}}' 2>$null | Where-Object { $_ })
  Require ($projectContainers.Count -ge 1) "No running Supabase containers are labelled com.supabase.cli.project=$ExpectedProject."
  $databaseInspects = @(
    foreach ($candidate in $projectContainers) {
      $candidateInspect = (& $docker.Source inspect $candidate.Trim() 2>$null | ConvertFrom-Json)[0]
      # Docker inspect represents container names with exactly one leading
      # slash; docker ps does not. Normalize only that presentation prefix.
      $candidateName = $candidateInspect.Name -replace '^/', ''
      $candidateImage = $candidateInspect.Config.Image
      $candidateBinding = @($candidateInspect.NetworkSettings.Ports.'5432/tcp')
      # Windows PowerShell 5.1 can unwrap a one-item pipeline result to a
      # scalar. Materialize the filter so Count is deterministic for 0/1/N.
      $matchingCandidateBindings = @(
        $candidateBinding | Where-Object {
          $_.HostIp -in @('127.0.0.1', '0.0.0.0', '::') -and
          [string]$_.HostPort -eq [string]$PostgresPort
        }
      )
      if (
        $candidateInspect.State.Running -and
        $candidateInspect.Config.Labels.'com.supabase.cli.project' -eq $ExpectedProject -and
        $candidateName -eq "supabase_db_$ExpectedProject" -and
        $candidateImage -match '^public\.ecr\.aws/supabase/postgres(?::|@|$)' -and
        $matchingCandidateBindings.Count -ge 1
      ) { $candidateInspect }
    }
  )
  Require ($databaseInspects.Count -eq 1) "Expected exactly one matching local database container supabase_db_$ExpectedProject; found $($databaseInspects.Count)."
  $inspect = $databaseInspects[0]
  $container = $inspect.Id
  Require ($inspect.Config.Labels.'com.supabase.cli.project' -eq $ExpectedProject) 'Selected Docker container does not belong to BruMath-pr44.'
  $selectedName = $inspect.Name -replace '^/', ''
  Require ($selectedName -eq "supabase_db_$ExpectedProject") 'Selected container name is not the expected local database name.'
  Require ($inspect.Config.Image -match '^public\.ecr\.aws/supabase/postgres(?::|@|$)') 'Selected container image is not the Supabase PostgreSQL database image.'
  $bindings = @($inspect.NetworkSettings.Ports.'5432/tcp')
  $matchingBindings = @(
    $bindings | Where-Object {
      $_.HostIp -in @('127.0.0.1', '0.0.0.0', '::') -and
      [string]$_.HostPort -eq [string]$PostgresPort
    }
  )
  Require ($matchingBindings.Count -ge 1) "Selected local PostgreSQL container is not mapped to host port $PostgresPort."
  if ($null -ne $inspect.State.Health) {
    Require ($inspect.State.Health.Status -eq 'healthy') "Selected local PostgreSQL container health is $($inspect.State.Health.Status), not healthy."
  }

  # This is intentionally a standalone read-only query. A failure here stops
  # before BEGIN and before any fixture is created.
    $preflightOutput = & $docker.Source exec -i $container psql -X -t -A -v ON_ERROR_STOP=1 -U postgres -d postgres -c 'select current_database();'
  if ($LASTEXITCODE -ne 0) { Fail "Read-only local PostgreSQL preflight failed with exit code $LASTEXITCODE." }
  $preflightText = (($preflightOutput -join "`n").Trim())
  Require ($preflightText -eq 'postgres') 'Read-only preflight did not prove current_database() = postgres.'
  Write-Host 'Read-only database identity preflight: PASS'

  $sql = @'
\set ON_ERROR_STOP on
\pset tuples_only on
\pset format unaligned
begin;

create or replace function pg_temp.gate_assert(p_condition boolean, p_message text)
returns void language plpgsql as $$
begin
  if not coalesce(p_condition, false) then
    raise exception 'PHASE1_GATE_ASSERTION: %', p_message;
  end if;
end;
$$;

-- Pre-flight: the required migration must be in the local migration history.
select pg_temp.gate_assert(
  exists (select 1 from supabase_migrations.schema_migrations where version = '20261001110000'),
  'migration 20261001110000 is not applied to the selected local database'
);

-- A/G: catalog, owner, security mode, search_path, schema and function grants.
do $$
declare
  f record;
begin
  for f in
    select p.oid, n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) args,
           p.prosecdef, r.rolname owner_name, coalesce(array_to_string(p.proconfig, ','), '') config
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      join pg_roles r on r.oid = p.proowner
     where (n.nspname = 'public' and p.proname in ('replace_financial_snapshot_v4','import_financial_snapshot_v4'))
        or (n.nspname = 'public' and p.proname in (
          'replace_financial_snapshot','import_financial_snapshot',
          'replace_financial_snapshot_v2','import_financial_snapshot_v2',
          'replace_financial_snapshot_v3','import_financial_snapshot_v3'))
        or (n.nspname = 'brumath_internal' and p.proname in (
          'replace_financial_snapshot_v1_internal','import_financial_snapshot_v1_internal',
          'replace_financial_snapshot_v2_internal','import_financial_snapshot_v2_internal',
          'replace_financial_snapshot_v3_internal','import_financial_snapshot_v3_internal',
          'replace_financial_snapshot_v4_internal','import_financial_snapshot_v4_internal'))
  loop
    perform pg_temp.gate_assert(f.config like '%search_path=%', format('missing fixed search_path: %s.%s(%s)', f.nspname, f.proname, f.args));
    if f.nspname = 'public' and f.proname like '%_v4' then
      perform pg_temp.gate_assert(f.prosecdef, format('public V4 is not SECURITY DEFINER: %s', f.proname));
      perform pg_temp.gate_assert(f.owner_name = 'postgres', format('public V4 owner is not postgres: %s', f.proname));
      perform pg_temp.gate_assert(has_function_privilege('authenticated', f.oid, 'EXECUTE'), format('authenticated lacks V4 EXECUTE: %s', f.proname));
      perform pg_temp.gate_assert(not has_function_privilege('anon', f.oid, 'EXECUTE'), format('anon has V4 EXECUTE: %s', f.proname));
      perform pg_temp.gate_assert(not has_function_privilege('public', f.oid, 'EXECUTE'), format('PUBLIC has V4 EXECUTE: %s', f.proname));
    else
      perform pg_temp.gate_assert(not has_function_privilege('authenticated', f.oid, 'EXECUTE'), format('authenticated has internal EXECUTE: %s.%s', f.nspname, f.proname));
      perform pg_temp.gate_assert(not has_function_privilege('anon', f.oid, 'EXECUTE'), format('anon has internal EXECUTE: %s.%s', f.nspname, f.proname));
      perform pg_temp.gate_assert(not has_function_privilege('public', f.oid, 'EXECUTE'), format('PUBLIC has internal EXECUTE: %s.%s', f.nspname, f.proname));
    end if;
  end loop;
  perform pg_temp.gate_assert(not has_schema_privilege('authenticated','brumath_internal','USAGE'), 'authenticated has brumath_internal USAGE');
  perform pg_temp.gate_assert(not has_schema_privilege('anon','brumath_internal','USAGE'), 'anon has brumath_internal USAGE');
  perform pg_temp.gate_assert(not has_schema_privilege('public','brumath_internal','USAGE'), 'PUBLIC has brumath_internal USAGE');
end;
$$;
\echo A PASS - public V4 boundary catalog/grants
\echo B PASS - internal schema catalog/grants
\echo G PASS - effective catalog grants/security metadata

-- All fixtures are rolled back. Fixed UUIDs are safe because no test fact is committed.
insert into auth.users(id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('11111111-1111-4111-8111-111111111111','authenticated','authenticated','phase1-gate-a@local.invalid','',now(),'{}','{}',now(),now()),
  ('22222222-2222-4222-8222-222222222222','authenticated','authenticated','phase1-gate-b@local.invalid','',now(),'{}','{}',now(),now()),
  ('33333333-3333-4333-8333-333333333333','authenticated','authenticated','phase1-gate-bootstrap@local.invalid','',now(),'{}','{}',now(),now());
insert into public.households(id, owner_id) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','22222222-2222-4222-8222-222222222222');
insert into public.household_members(household_id,user_id,role) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111','owner'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','22222222-2222-4222-8222-222222222222','owner');
insert into public.financial_settings(household_id) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');

-- A/C: no auth, member, non-member and RLS behavior. The payload is constructed
-- below once and contains only synthetic local records.
create temporary table gate_state (snapshot jsonb not null, source_hash text not null) on commit drop;
insert into gate_state(snapshot, source_hash) values (
jsonb_build_object(
  'settings', jsonb_build_object('income',0,'budgets','{}'::jsonb,'limits','{}'::jsonb,'personal_limits','{}'::jsonb,'active_profile','Bruna','view_month','2030-01-01','category_budgets','{}'::jsonb),
  'expenses','[]'::jsonb,
  'installments',jsonb_build_array(jsonb_build_object('legacy_id',910001,'title','PHASE1 synthetic installment','category','Synthetic','responsible','Bruna','amount',10.00,'total_installments',1,'paid_installments',0,'next_due','2030-01-27','credit_card_legacy_id',null)),
  'receivables','[]'::jsonb,
  'income_entries','[]'::jsonb,
  'credit_cards','[]'::jsonb,
  'invoice_payments','[]'::jsonb,
  'categories','[]'::jsonb,
  'invoice_adjustments','[]'::jsonb,
  'installment_invoice_events','[]'::jsonb,
  'installment_reimbursement_allocations','[]'::jsonb,
  'installment_schedule_items',jsonb_build_array(jsonb_build_object('legacy_id','phase1-schedule-1','installment_legacy_id',910001,'installment_number',1,'total_installments',1,'amount',10.00,'invoice_reference_month',null,'due_date','2030-01-27','credit_card_legacy_id',null,'status','scheduled')),
  'installment_settlement_events',jsonb_build_array(jsonb_build_object('legacy_id','phase1-settlement-1','installment_legacy_id',910001,'installment_number',1,'amount',10.00,'settled_on','2030-01-27','settlement_type','regular'))
), 'phase1-gate-import');

grant select on table gate_state to authenticated;

set local role authenticated;
select set_config('request.jwt.claim.sub', '', true);
do $$
begin
  perform public.replace_financial_snapshot_v4('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', (select snapshot from gate_state), 'no-auth');
  raise exception 'PHASE1_GATE_ASSERTION: unauthenticated public V4 call unexpectedly succeeded';
exception when others then
  if sqlerrm not like '%authentication is required%' then raise; end if;
end;
$$;
select set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', true);
do $$
begin
  perform public.replace_financial_snapshot_v4('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', (select snapshot from gate_state), 'cross-household');
  raise exception 'PHASE1_GATE_ASSERTION: non-member V4 call unexpectedly succeeded';
exception when others then
  if sqlerrm not like '%household membership is required%' then raise; end if;
end;
$$;
select pg_temp.gate_assert((select count(*) from public.financial_settings where household_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa') = 0, 'RLS leaked household A financial settings to B');
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
do $$
begin
  perform public.replace_financial_snapshot_v3('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', (select snapshot from gate_state), 'legacy-bypass');
  raise exception 'PHASE1_GATE_ASSERTION: public V3 bypass unexpectedly succeeded';
exception when others then
  if sqlerrm not like '%disabled%'
     and sqlerrm not like '%permission denied for function replace_financial_snapshot_v3%'
  then
    raise;
  end if;
end;
$$;
reset role;
\echo C PASS - authenticated household isolation and no legacy bypass

-- D/E: V4 direct chain, extensions present/absent, import, reconciliation and
-- rollback after a deliberate P0001 mismatch. All writes remain in this transaction.
set local role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
select pg_temp.gate_assert(
  (public.replace_financial_snapshot_v4('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', (select snapshot from gate_state), 'phase1-replace') -> 'installment_schedule_items') = ((select snapshot from gate_state) -> 'installment_schedule_items'),
  'V4 replace did not reconcile schedule extension'
);
reset role;
select pg_temp.gate_assert(
  (select category_budgets from public.financial_settings where household_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa') = '{}'::jsonb,
  'V4 replace did not preserve category budgets'
);
select pg_temp.gate_assert((select count(*) from public.installment_schedule_items where household_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa') = 1, 'V4 replace did not persist schedule');
select pg_temp.gate_assert((select count(*) from public.installment_settlement_events where household_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa') = 1, 'V4 replace did not persist settlement');
-- Absent extensions must preserve the persisted V4 extension state.
set local role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
select pg_temp.gate_assert(
  (public.replace_financial_snapshot_v4('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', (select snapshot - 'installment_schedule_items' - 'installment_settlement_events' from gate_state), 'phase1-absent') -> 'installment_schedule_items') = ((select snapshot from gate_state) -> 'installment_schedule_items'),
  'V4 absent schedule extension did not preserve persisted state'
);
select pg_temp.gate_assert(
  coalesce((public.import_financial_snapshot_v4('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', (select source_hash from gate_state), (select snapshot from gate_state), jsonb_build_object('expenses',0,'installments',1,'receivables',0,'incomeEntries',0,'creditCards',0,'invoicePayments',0)) ->> 'imported')::boolean, false),
  'V4 import did not import a synthetic snapshot'
);
-- Trigger only synthetic data within this transaction to force a real V4
-- reconciliation mismatch. The failed call must leave no partial schedule row.
reset role;
create temporary table gate_rollback_state on commit drop as
select coalesce(jsonb_agg(to_jsonb(t) order by t.id), '[]'::jsonb) as schedule
from public.installment_schedule_items t where household_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
create function pg_temp.gate_force_p0001() returns trigger language plpgsql as $$ begin if new.legacy_id='phase1-p0001' then new.amount := new.amount + 0.01; end if; return new; end; $$;
create trigger phase1_gate_force_p0001 before insert on public.installment_schedule_items for each row execute function pg_temp.gate_force_p0001();
set local role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
do $$
declare mismatch_seen boolean := false;
begin
  begin
    perform public.replace_financial_snapshot_v4(
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      (select jsonb_set(
        jsonb_set(
          snapshot,
          '{installments}',
          (snapshot -> 'installments') || jsonb_build_array(jsonb_build_object(
            'legacy_id',910002,'title','PHASE1 P0001 installment','category','Synthetic',
            'responsible','Bruna','amount',1.00,'total_installments',1,
            'paid_installments',0,'next_due','2030-02-27','credit_card_legacy_id',null
          ))
        ),
        '{installment_schedule_items}',
        (snapshot -> 'installment_schedule_items') || jsonb_build_array(jsonb_build_object(
          'legacy_id','phase1-p0001','installment_legacy_id',910002,'installment_number',1,
          'total_installments',1,'amount',1.00,'invoice_reference_month',null,
          'due_date','2030-02-27','credit_card_legacy_id',null,'status','scheduled'
        ))
      ) from gate_state),
      'phase1-p0001'
    );
  exception when sqlstate 'P0001' then
    if sqlerrm <> 'persisted snapshot does not reconcile with source snapshot' then raise; end if;
    mismatch_seen := true;
  end;
  perform pg_temp.gate_assert(mismatch_seen, 'deliberate reconciliation mismatch unexpectedly succeeded');
end;
$$;
reset role;
select pg_temp.gate_assert(
  (select coalesce(jsonb_agg(to_jsonb(t) order by t.id), '[]'::jsonb) from public.installment_schedule_items t where household_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa') = (select schedule from gate_rollback_state),
  'P0001 left a partial schedule mutation'
);
drop trigger phase1_gate_force_p0001 on public.installment_schedule_items;
\echo D PASS - V4 replace/import/extensions/reconciliation
\echo E PASS - deliberate P0001 rollback preserved prior state

-- F: the bootstrap path remains an authenticated initialization contract.
set local role authenticated;
select set_config('request.jwt.claim.sub', '33333333-3333-4333-8333-333333333333', true);
select pg_temp.gate_assert(public.bootstrap_financial_household() is not null, 'authenticated bootstrap returned null');
reset role;
\echo F PASS - authenticated bootstrap

-- G report: no secrets or financial values are printed.
select format('GRANT function=%s.%s(%s) owner=%s definer=%s config=%s auth_exec=%s anon_exec=%s public_exec=%s', n.nspname,p.proname,pg_get_function_identity_arguments(p.oid),r.rolname,p.prosecdef,coalesce(array_to_string(p.proconfig,','),''),has_function_privilege('authenticated',p.oid,'EXECUTE'),has_function_privilege('anon',p.oid,'EXECUTE'),has_function_privilege('public',p.oid,'EXECUTE'))
from pg_proc p join pg_namespace n on n.oid=p.pronamespace join pg_roles r on r.oid=p.proowner
where (n.nspname='public' and p.proname in ('replace_financial_snapshot_v4','import_financial_snapshot_v4'))
   or (n.nspname='brumath_internal' and p.proname like '%financial_snapshot%_internal')
order by n.nspname,p.proname;
select format('GRANT schema=brumath_internal role=%s usage=%s', r, has_schema_privilege(r,'brumath_internal','USAGE')) from unnest(array['authenticated','anon','public']) r;
rollback;
'@

  # docker exec has no network path and psql runs inside the verified local DB
  # container. Nothing in this invocation can select a Supabase project ref.
  $fixturesStarted = $true
  $sql | & $docker.Source exec -i $container psql -X -v ON_ERROR_STOP=1 -U postgres -d postgres
  if ($LASTEXITCODE -ne 0) { Fail "local PostgreSQL gate SQL failed with exit code $LASTEXITCODE" }
  Finish 'PASS'
} catch {
  Write-Host "Gate stopped: $($_.Exception.Message)" -ForegroundColor Red
  if ($fixturesStarted) { Finish 'FAIL' }
  Finish 'NOT RUN'
}




