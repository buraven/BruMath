# Roadmap de evolução visual — BruMath

## Estado atual

- PR #35 foi integrado à `main` em 6 de setembro de 2026.
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

| PR | Branch | Escopo visual e funcional | Referência principal |
| --- | --- | --- | --- |
| #36 | `feature/navigation-pr36` | Casca de navegação: barra lateral em tablet/desktop, navegação inferior no mobile, ação `+` central e transição entre as telas existentes. Sem mudar cálculos financeiros. | `01-home-tablet-mobile.png`, `02-dashboard-tablet-mobile.png` |
| #37 | `feature/expenses-layout-pr37` | Tela de lançamentos/gastos: lista, agrupamentos, filtros, edição e exclusão no padrão visual novo. | `07-faturas.png` (padrão de lista) |
| #38 | `feature/future-layout-pr38` | Futuro: parcelas, contas e próximos compromissos, com visão de impacto no saldo. | `06-calendario.png` |
| #39 | `feature/debts-layout-pr39` | Valores a receber, recebimentos parciais e entradas/extras no padrão novo. | `01-home-tablet-mobile.png`, `03-home-dark-mobile.png` |
| #40 | `feature/limits-layout-pr40` | Limites e categorias: configuração, consumo por categoria e alertas. | `01-home-tablet-mobile.png`, `04-home-dark-dashboard.png` |
| #41 | `feature/financial-assistant-pr41` | Assistente financeiro: conversa, sugestões, atalhos e insights no padrão dos mockups. | `02-dashboard-tablet-mobile.png`, `03-home-dark-mobile.png` |
| #42 | `feature/preferences-pr42` | Perfil, tema e preferências, mantendo as escolhas existentes. | `01-home-tablet-mobile.png` |
| #43 | `feature/responsive-qa-pr43` | Ajuste final de responsividade para iPhone, tablet/iPad e desktop. | Todos os mockups de Home |
| #44 | `chore/legacy-architecture-cleanup-pr44` | Remover a arquitetura visual antiga que não for mais usada, sem alterar comportamento. | — |
| #45 | `chore/final-qa-pr45` | QA de fluxos, correções finais e preparação para produção. | Todos |

## Agora: PR #36

O próximo passo é a navegação. O objetivo é fazer a estrutura da aplicação se
parecer com os mockups, antes de redesenhar cada tela individualmente:

- desktop/tablet: barra lateral persistente;
- mobile: navegação inferior com o botão `+` central;
- manter as telas e ações que já existem acessíveis durante a transição;
- preparar espaços para Faturas e Calendário, sem fingir que as funcionalidades
  já existem;
- manter o seletor de mês e o tema funcionando em todos os tamanhos.

O PR #36 não cria Faturas ou Calendário completos. Essas telas entram apenas
quando houver escopo funcional próprio, depois da navegação.
