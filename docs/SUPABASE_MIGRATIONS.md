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

Para executar: crie duas contas descartáveis no Supabase Auth, guarde as
credenciais somente no gerenciador de secrets do ambiente de teste e execute
`vercel env run -e preview --git-branch feature/supabase-persistence-pr57 -- pnpm test:supabase:e2e`.
O Vercel CLI injeta os valores apenas no processo, sem criar `.env.local`.
A confirmação por e-mail, se estiver habilitada no projeto, deve ser concluída
manualmente antes do teste.
