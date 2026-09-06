# Roadmap de evolução visual — BruMath

## Estado atual

- PR #35 foi integrado à `main` em 6 de setembro de 2026.
- PRs #36, #37 e #38 integrados; PR #39 em implementação sobre o merge `2716edd`.
- A Home usa a estrutura em `features/home` e os mockups oficiais vivem em
  `assets/mockups`.
- Tokens, ESLint e Prettier estão configurados. Mudanças novas devem reutilizar
  tokens em vez de introduzir cores, sombras ou espaçamentos soltos em classes.
- Cada PR deve preservar regras financeiras, dados em `localStorage`, edição,
  exclusão, recebimentos parciais, seletor de mês e tema.

## Como vamos trabalhar

1. Um PR por tela ou experiência visual completa.
2. Primeiro reproduzir a composição do mockup; depois refinar componentes.
3. Não alterar regra financeira por causa de uma mudança visual, salvo quando o
   escopo do PR declarar isso explicitamente.
4. Antes do merge: lint, formatação, revisão do diff e teste no preview da
   Vercel em desktop e mobile.
5. A branch acompanha o PR: `feature/<assunto>-prNN`.

## Próximos PRs

| PR  | Branch                                   | Escopo visual e funcional                                                                                                                                                  | Referência principal                                          |
| --- | ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| #36 | `feature/navigation-pr36`                | Casca de navegação: barra lateral em tablet/desktop, navegação inferior no mobile, ação `+` central e transição entre as telas existentes. Sem mudar cálculos financeiros. | `01-home-tablet-mobile.png`, `02-dashboard-tablet-mobile.png` |
| #37 | `feature/expenses-layout-pr37`           | Tela de lançamentos/gastos: lista, agrupamentos, filtros, edição e exclusão no padrão visual novo.                                                                         | `07-faturas.png` (padrão de lista)                            |
| #38 | `feature/future-layout-pr38`             | Futuro: parcelas, contas e próximos compromissos, com visão de impacto no saldo.                                                                                           | `06-calendario.png`                                           |
| #39 | `feature/debts-layout-pr39`              | Valores a receber, recebimentos parciais e entradas/extras no padrão novo.                                                                                                 | `01-home-tablet-mobile.png`, `03-home-dark-mobile.png`        |
| #40 | `feature/limits-layout-pr40`             | Limites e categorias: configuração, consumo por categoria e alertas.                                                                                                       | `01-home-tablet-mobile.png`, `04-home-dark-dashboard.png`     |
| #41 | `feature/financial-assistant-pr41`       | Assistente financeiro: conversa, sugestões, atalhos e insights no padrão dos mockups.                                                                                      | `02-dashboard-tablet-mobile.png`, `03-home-dark-mobile.png`   |
| #42 | `feature/preferences-pr42`               | Perfil, tema e preferências, mantendo as escolhas existentes.                                                                                                              | `01-home-tablet-mobile.png`                                   |
| #43 | `feature/responsive-qa-pr43`             | Ajuste final de responsividade para iPhone, tablet/iPad e desktop.                                                                                                         | Todos os mockups de Home                                      |
| #44 | `chore/legacy-architecture-cleanup-pr44` | Remover a arquitetura visual antiga que não for mais usada, sem alterar comportamento.                                                                                     | —                                                             |
| #45 | `chore/final-qa-pr45`                    | QA de fluxos, correções finais e preparação para produção.                                                                                                                 | Todos                                                         |

## Agora: PR #40

PR #39 integrado na main (`d925f0d`). O #40 adiciona a tela de limites e
categorias, configuração com valores formatados e alertas de consumo. A Home
passa a usar os mesmos limites salvos e gastos do mês que a tela completa.
Os limites são globais; os gastos são filtrados pelo mês selecionado.
Após o #40, seguir para o #41: assistente financeiro.

### Entrega anterior: PR #39

Valores a receber e entradas/extras seguem os cards dos mockups oficiais:

- resumo de pendências, recebimentos acumulados e total das cobranças listadas;
- valor total, recebido, saldo em aberto e progresso por cobrança;
- entradas com data, pessoa, destino, valor e ações de edição/exclusão;
- tokens compartilhados e composição adaptada à largura disponível;
- preservar callbacks, recebimentos parciais, filtro mensal e persistência.

Depois da aprovação do #39, o próximo é o #40: limites e categorias.
