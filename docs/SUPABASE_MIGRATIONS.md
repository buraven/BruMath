# Migrations do Supabase

As duas migrations iniciais do PR #57 foram aplicadas externamente antes de o
repositório ser ligado a um projeto Supabase. O histórico remoto registrou os
timestamps `20260919230603` e `20260919230631`.

Para manter o histórico local compatível com o remoto sem reaplicar SQL, os
arquivos versionados foram renomeados para esses mesmos timestamps, preservando
integralmente o conteúdo já aplicado:

- `20260919230603_financial_persistence_foundation.sql`
- `20260919230631_import_financial_snapshot_rpc.sql`

Não execute `db push`, `migration repair` ou `supabase link` para essa
reconciliação. A próxima migration permanece local e precisa de revisão e
autorização antes de qualquer aplicação remota.

O índice de `households(owner_id)` também foi aplicado externamente e o
histórico remoto registrou `20260919231621`. O arquivo local correspondente
usa esse mesmo timestamp, sem mudança do SQL.

## Escrita remota do app

`20260920102209_replace_financial_snapshot.sql` permanece somente versionada
até revisão e aplicação externa. Ela adiciona a RPC autenticada
`replace_financial_snapshot`, usada pelo app depois de uma migração local
confirmada. A RPC delega a validação existente, substitui o snapshot de forma
atômica e não cria marcadores em `local_imports` — esses continuam reservados
para a migração explícita de `brumath-data`.

## Harness remoto sintético

`pnpm test:supabase:e2e` não faz parte da suíte local comum. Ele exige duas
contas descartáveis já autenticáveis por e-mail/senha e usa exclusivamente a
publishable key e o papel `authenticated`:

- `SUPABASE_E2E_USER_A_EMAIL` / `SUPABASE_E2E_USER_A_PASSWORD`
- `SUPABASE_E2E_USER_B_EMAIL` / `SUPABASE_E2E_USER_B_PASSWORD`

As variáveis públicas do projeto também devem estar disponíveis no ambiente.
O harness nunca cria contas, não usa `service_role` e não lê `brumath-data`.
Ele exercita bootstrap, importação idempotente, reconciliação, RLS entre A/B e
rollback de um snapshot sintético inválido.

Para executar, use apenas um ambiente de teste controlado que injete as quatro
credenciais sintéticas no processo. `vercel env run` não injeta variáveis
marcadas como Secret e não é um mecanismo válido para esse harness. A
confirmação por e-mail, se estiver habilitada no projeto, deve ser concluída
manualmente antes do teste.
