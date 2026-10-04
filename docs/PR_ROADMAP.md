# Roadmap BruMath — Uso real

Este roadmap prioriza a confiança da Bruna nos números do dia a dia. Decisões
técnicas existem para proteger dados, histórico e sincronização; não definem a
ordem de produto por si só.

## Estado atual

Produção está na `main` após os PRs #67 e #68. Há 15 migrations locais e 15
remotas, sem pendências. `20261001110000_v4_public_write_boundary.sql` está
aplicada e validada em produção.

Entregue e em produção:

- persistência Supabase, Magic Link, household/membership, RLS e read-back;
- V4 como única fronteira pública autenticada de escrita, com reconciliação
  fail-closed; V1/V2/V3 não são bypass e as implementações ficam em
  `brumath_internal`;
- categorias dinâmicas e budgets por identidade;
- renda-base, entradas extras, gastos, recebíveis e recebimentos parciais;
- cartões, faturas, pagamentos, ajustes e histórico de fatura;
- calendário/compromissos sem duplicar parcela de cartão e fatura;
- compras à vista com competência explícita e compras parceladas novas com
  cronograma X/Y, centavos determinísticos e sem Expense duplicada;
- schedules, settlement events append-only e edição prospectiva que preserva
  histórico para cronogramas já suportados pelo banco;
- journeys de fatura/parcelamento validados em desktop, celular e iPad.

Ainda não é promessa de produto: o limite disponível do cartão não considera
todo comprometimento futuro; legados sem cronograma completo não recebem edição
financeira automática; e o lifecycle `cancelled` do PR #67 ainda não possui a
migration correspondente no histórico de produção. Portanto, ações de excluir
ou encerrar parcelamento não estão liberadas como operação real até que a
persistência V4 possa gravar esse estado de forma reconciliada.

## Marco 1 — Parcelamentos reais confiáveis

**Resultado:** administrar parcelamentos existentes sem apagar passado,
duplicar faturas ou criar compromissos fantasmas.

Reutilizar o que já existe: classificação X/Y (`historical`,
`current_open_invoice`, `future`, `cancelled`), fatos explícitos por invoice ou
settlement, cronograma completo como fonte de verdade, fallback legado,
histórico não contíguo, edição prospectiva, exclusão segura, encerramento de
futuro e revisão determinística de legado. A classificação e a UI já existem;
a persistência SQL de `cancelled` ainda precisa ser entregue antes de expor as
ações como seguras em produção.

Falta transformar isso em um journey operacional completo para planos
existentes. Legados ambíguos ficam em fallback com “revisar para editar”; nunca
se inventa fato histórico ou materialização automática sem prova canônica.

**Aceite:** entender o que foi consolidado, o que está na fatura aberta e o que
é futuro; excluir plano sem histórico ou encerrar futuro de plano com histórico
sem ele ressurgir após login.

## Marco 2 — Limite real dos cartões

**Resultado:** responder “quanto ainda posso gastar?” em Nubank e Mercado Pago
considerando parcelas futuras, canceladas, liquidadas e antecipadas.

Depende do Marco 1: o comprometimento por cartão só é confiável quando cada
parcela existente tem lifecycle seguro.

## Marco 3 — Conciliação dos dados financeiros reais

**Resultado:** confirmar posição inicial real de faturas, parcelas, pagamentos
e recebíveis. A revisão assistida mostra fatos conhecidos, exige confirmação
para fatos faltantes e só persiste schedule completo reconciliado. Sem backfill
especulativo ou alteração de Expense/eventos/ajustes/reembolsos históricos.

## Marco 4 — BruMath no uso diário

**Resultado:** registrar, editar, pagar, receber e consultar com confiança no
celular/iPad. Inclui aceite de gastos, renda, recebimentos parciais, faturas,
parcelas, logout/login e projeções de compromissos conhecidos.

Saldo disponível e saldo projetado continuam sendo projeções dos fatos
cadastrados, não uma conciliação bancária automática.

## Depois do uso diário

Não bloqueiam o uso seguro: refinamentos de UX, relatórios, automações,
assistente/IA, WhatsApp, Open Finance, importação e conciliação bancária
automática, e evolução multiusuário de responsável/pagador/autor.

## Segurança e evolução técnica

- Extensões V4 ficam fora da projeção legada e participam da reconciliação V4.
- RLS, membership e household isolation são obrigatórios.
- Fato consolidado não é reescrito; correção futura exige compensação/reversão
  explícita quando o domínio a suportar.
- Calendário é projeção, não fonte de verdade.
- Nova regra financeira exige unit/integration/BDD; journey crítico exige
  Playwright e, quando houver UX, aceite em iPad/Safari.

## Histórico útil

- #35–#45: base visual, navegação, gastos, parcelas, recebíveis e QA.
- #47–#56: assistente e guardrails determinísticos.
- #57: Supabase; #62–#64: categorias V4; #65–#66: compras/faturas/schedules;
  #67: código de lifecycle aguardando persistência `cancelled`; #68:
  reconciliação de migrations e fronteira V4 em produção.

Os números são registro histórico, não uma fila automática de implementação.
