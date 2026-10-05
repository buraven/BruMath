# Migrations do Supabase

## Estado de produção

Após o PR #68, o histórico está reconciliado: **15 migrations locais e 15
remotas**, sem pendências. Quatro arquivos de schedule/settlement foram
renomeados para os timestamps já registrados em produção; seu SQL não foi
reaplicado.

`20261001110000_v4_public_write_boundary.sql` está aplicada e validada. V4 é a
fronteira pública autenticada de escrita; V1/V2/V3 não oferecem bypass externo
e as implementações ficam no schema privado `brumath_internal`.

Antes de migration futura: confirmar histórico local/remoto, revisar o diff,
ter autorização explícita, validar leitura pós-aplicação e nunca usar repair,
backfill ou alteração manual de fatos financeiros como atalho.

## Contratos atuais

- `installment_schedule_items` representa planejamento X/Y, com RLS e FKs por
  household;
- `installment_settlement_events` é append-only: `authenticated` tem `SELECT`
  e `INSERT`; `anon` e `PUBLIC` não têm acesso;
- o banco atual aceita apenas `scheduled` em `installment_schedule_items`; o
  código de lifecycle que introduz `cancelled` não pode ser usado em produção
  até receber migration incremental, revisão V4 e rollout autorizado;
- snapshots antigos sem extensões V4 preservam extensões persistidas; campo
  explicitamente presente participa de replace/reconciliação;
- nenhuma migration atual cria backfill especulativo de parcelamentos legados.

## Autenticação e harness

O BruMath é privado: usuários autorizados existem previamente no Supabase Auth;
o app usa Magic Link com `shouldCreateUser: false`. No browser, use somente
`NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`; nunca
`service_role`.

`pnpm test:supabase:e2e` exige ambiente de teste controlado e contas sintéticas.
O gate PostgreSQL local V4 usa apenas banco local, fixtures sintéticas e rollback.
