# Roadmap de evolução do BruMath

## Estado atual

- #35 integrado: Home e mockups oficiais.
- #36 integrado: navegação.
- #37 integrado: gastos e responsividade.
- #38 integrado: Futuro e parcelas.
- #39 integrado: dívidas, recebimentos, entradas e campos formatados.
- #40 integrado na main (`eede6b7`).
- #41 integrado: fase A, UX/Chat e integração Home → Assistente, com sugestões persistentes. Fase B permanece planejada para depois.
- #42 integrado: Preferências.
- #43 integrado: QA responsivo global.
- #44 integrado: estabilização visual e limpeza conservadora da arquitetura legada.
- #45 integrado: QA final de regressão, fluxos, persistência, responsividade e readiness de produção.

## PR #40 — entrega e validação

Branch: `feature/limits-layout-pr40`, baseada no merge do #39 (`d925f0d`).

Tela de limites e categorias, popup de configuração com salvar/cancelar, consumo
mensal e alertas. Home integrada aos limites salvos, resumo com Bruna, Matheus e
até três categorias prioritárias. Acabamentos autorizados de Home, navegação,
identidade, assistente compacto e espaçamento/cores de entradas e recebimentos.
Configuração de limites global; gastos filtrados pelo mês selecionado.
Nenhuma migração de dados ou mudança de modelos nesta finalização.

Lint aprovado. Verificação local de tablet portrait/landscape, desktop e mobile,
além de salvar/cancelar/Escape no popup. O typecheck permanece com dois erros
**preexistentes**, presentes na base em `lib/finance/limitsService.test.ts`:
TS2307 (dependência `vitest` ausente) e TS2345 (`owner` inferido como `string`,
incompatível com `LimitOwner`). Não são regressões do #40 e não foram corrigidos.
Isso não equivale a typecheck global aprovado. Conferir preview Vercel do último
commit antes do merge. Emulação Chromium não substitui Safari/safe-area no iPad real.

## Próximos PRs

### #41 — Assistente financeiro

Branch: `feature/financial-assistant-pr41`. Integrado. Duas fases
conceituais no planejamento:

**A — UX/Chat (concluída no #41):** seguindo os mockups oficiais; conversa ocupando a área útil,
mensagens do BruMath à esquerda e usuário à direita, composer fixo, auto-scroll,
sugestões contextuais, preview/insights em formato de mensagem e nenhuma
sobreposição da navegação. Não implementar nova arquitetura de IA nesta fase visual.

**B — Cérebro/Inteligência:** depois de consolidar o modelo financeiro, evoluir
linguagem natural, contexto conversacional, consultas aos dados reais, simulações,
ações com confirmação e insights proativos. Declarar explicitamente o escopo
funcional dessa evolução antes de implementá-la.

Regras conceituais futuras:

- Home = radar; Assistente = conversa, explicação e ação.
- Insights importantes podem aparecer na Home e virar mensagens/contexto no Assistente, sem simples duplicação.
- Perguntas e simulações nunca alteram dados.
- Toda ação que altera dados exige confirmação antes de salvar.
- Perfil ativo Bruna/Matheus/Casal fornece contexto padrão, mas linguagem natural pode sobrescrever. Em ambiguidade relevante, perguntar.
- Separar responsável pelo gasto de quem pagou: gasto do casal pago por uma pessoa não deve consumir limite pessoal indevidamente. É planejamento futuro, não alteração de modelo no #40.

### #42 — Preferências

Branch: `feature/preferences-pr42`. Integrado. Mantém perfil, tema e preferências
existentes, seguindo mockups e tokens. Não misturar com QA responsivo global.

### #43 — Responsive QA

Branch: `feature/responsive-qa-pr43`. Integrado. Pente-fino global de iPhone, iPad/tablet e
desktop em todas as telas: breakpoints, bottom navigation, sidebar, safe-area,
sticky elements, grids e overflows. Não transformar PRs anteriores em refactors
responsivos intermináveis.

### #44 — Estabilização visual e limpeza legada

Branch: `chore/legacy-architecture-cleanup-pr44`.

**Fase 1 — correções/fidelidade visual:** estabilizar UX/layout persistentes após
validação em Vercel e iPad, usando `assets/mockups` como referência e preservando
regras financeiras e dados.

**Fase 2 — legacy architecture cleanup (concluída, pronta para merge):** remoção
conservadora de componentes, estilos e exports visuais comprovadamente sem uso,
sem mudar comportamento. Serviços financeiros, persistência e componentes ativos
permanecem preservados.

### #45 — Final QA

Branch: `chore/final-qa-pr45`. QA de fluxos completos, regressões, regras
financeiras, persistência, responsividade final e preparação para produção.
Integrado; a sequência visual e estrutural #35–#45 está concluída.

## FASE 2 — Inteligência Financeira

### Objetivo

Evoluir o Assistente BruMath para uma conversa financeira confiável. O LLM interpreta
linguagem e redige respostas; o BruMath continua sendo a fonte de verdade para
consultas, cálculos, validações e mutações. Valores financeiros não devem ser
inventados nem calculados livremente pelo modelo quando houver uma fonte
determinística disponível.

### Princípios e boundaries

- **UI / Chat:** renderiza mensagens, sugestões, estados de confirmação e resultados;
  não consulta `localStorage` nem calcula finanças.
- **Assistant Engine:** recebe uma mensagem e um contexto de sessão mínimo, escolhe o
  caminho determinístico ou o provider futuro e devolve uma resposta estruturada.
- **Financial Context:** monta somente o recorte de dados necessário para a pergunta,
  usando serviços financeiros. Não serializar toda a base para o modelo.
- **Intent / interpretação:** transforma texto em intenção, entidades e ambiguidades;
  o LLM futuro é plugável aqui, sem acesso direto a dados ou mutações.
- **Tools:** consultas determinísticas, tipadas e com retorno estruturado. O modelo
  pode solicitar uma tool, mas não reconstrói totais por texto.
- **Actions:** propostas estruturadas de mutação. Não executam nada até passar pela
  camada de confirmação explícita da UI.
- **Financial Services e Persistence:** permanecem donos das regras, validações e
  compatibilidade de `brumath-data`. O Engine acessa contratos/repositórios, não o
  `localStorage` ou estado React diretamente.
- **Guardrails:** cada trecho de resposta deve poder ser classificado como `fact`
  (dado), `calculation` (serviço determinístico), `simulation` (sem persistência) ou
  `inference` (interpretação/recomendação). `inference` nunca é apresentada como fato.
- **LLM Provider:** adapter futuro opcional, proibido de receber APIs de persistência ou
  callbacks de mutação.

### Contexto, perfil e conversa

O contexto padrão contém perfil ativo, mês selecionado e referência curta de conversa.
Perfil explícito no texto pode sobrescrever o padrão — por exemplo, uma pergunta sobre
Matheus com perfil Bruna consulta Matheus. Quando pessoa, mês, categoria ou ação forem
materialmente ambíguos, o Engine pede esclarecimento.

O contexto financeiro será consultado sob demanda: renda base, entradas extras, gastos,
gastos por categoria/pessoa, limites pessoais/categoria, saldo, parcelas e compromissos,
valores a receber e recebimentos. Histórico conversacional deve ser limitado e resumido;
não enviar mensagens ilimitadas ao provider.

Responsável pelo gasto e pagador são conceitos futuros distintos. O modelo atual tem
somente `who`/proprietário; a evolução deverá introduzir esse segundo atributo via
migração compatível, sem reinterpretar os dados já salvos.

### Tools, actions e confirmação

Tools futuras devem usar nomes e contratos coerentes com os serviços reais, tais como
`getFinancialSummary`, `getExpenses`, `getExpensesByCategory`, `getLimits`,
`getRemainingLimit`, `getInstallments`, `getUpcomingInstallments`, `getReceivables`,
`getIncome` e `simulateInstallmentAdvance`. Cada uma retorna dados estruturados,
proveniência e escopo de perfil/mês.

Perguntas e simulações não persistem nada. Uma ação futura seguirá sempre:

`mensagem → interpretação → proposta tipada → preview → confirmação explícita → execução determinística → resultado`.

Exemplos: criar/editar/excluir gasto ou entrada, registrar recebimento, pagar ou
adiantar parcela. O provider nunca chama uma ação financeira diretamente.

### Token, custo e RAG

Adotar `deterministic-first`: respostas simples podem ser produzidas sem LLM; perguntas
complexas usam tool calling, contexto sob demanda e structured outputs. O desenho prevê
resumo de conversa, limite de histórico, cache apenas de consultas seguras e futura
seleção de modelo por complexidade. Não antecipar otimizações antes de medir.

RAG não é fonte de dados financeiros estruturados. Pode servir futuramente para
documentação, políticas, educação financeira ou conteúdo não estruturado, nunca para
saldo, gasto, limite, parcela, vencimento, dívida ou entrada.

### Roadmap da Fase 2

| PR  | Branch                                  | Entrega                                                                                     |
| --- | --------------------------------------- | ------------------------------------------------------------------------------------------- |
| #46 | `feature/assistant-engine-pr46`         | Contratos e boundaries do Assistant Engine, sem LLM. **Integrado.**                         |
| #47 | `feature/financial-context-engine-pr47` | Contexto financeiro estruturado e consultas confiáveis. **Concluído, pronto para revisão.** |
| #48 | `feature/assistant-tools-actions-pr48`  | Tools determinísticas, propostas de action e fluxo de confirmação.                          |
| #49 | `feature/conversational-ai-pr49`        | Provider LLM, intent e structured outputs.                                                  |
| #50 | `feature/financial-guardrails-pr50`     | Provenance, validação e anti-alucinação financeira.                                         |
| #51 | `feature/conversation-context-pr51`     | Follow-ups, referências conversacionais e memória curta.                                    |
| #52 | `chore/token-cost-optimization-pr52`    | Seleção de contexto, cache, resumos e roteamento de modelo.                                 |
| #53 | `feature/proactive-insights-pr53`       | Motor de insights compartilhado entre Home e Assistente.                                    |

### PR #46 — Assistant Engine Foundation

**Objetivo:** criar uma fundação testável sem mudar a UI atual, adicionar provider de IA
ou executar ações financeiras por conversa.

**Módulos planejados:**

- `features/assistant/engine/contracts`: tipos para `AssistantRequest`,
  `AssistantResponse`, mensagem normalizada, intenção, `ToolRequest`, `ToolResult`,
  `ActionProposal`, `Clarification` e proveniência.
- `features/assistant/engine/AssistantEngine`: orquestrador puro que recebe request e
  dependências por interface; inicialmente pode encaminhar apenas o comportamento
  determinístico já existente, sem alterar a resposta visual.
- `features/assistant/engine/FinancialContextProvider`: contrato de leitura por escopo
  de perfil/mês; implementação real fica para #47.
- `features/assistant/engine/ToolRegistry`: contrato para tools tipadas, sem acesso a
  UI, `localStorage` ou callbacks React.
- `features/assistant/engine/ActionGateway`: contrato para criar propostas, nunca para
  executar sem confirmação. A execução real fica para #48.
- `features/assistant/engine/ProviderAdapter`: porta opcional para LLM, ainda sem SDK,
  chave, rede ou implementação concreta.

**Dependências permitidas:** tipos financeiros estáveis, serviços financeiros puros e
interfaces de repositório. **Proibidas:** imports de `app/page.tsx`, componentes React,
CSS, `window`, `localStorage`, provider concreto, API key e callbacks de `setState`.

**Integração com a UI:** a tela converte estado atual em `AssistantRequest` e chama uma
fachada; recebe `AssistantResponse` estruturada para renderizar texto, tool provenance,
pedido de esclarecimento ou proposta de confirmação. A UI continua dona do modal e da
confirmação visual.

**Testes isolados:** unit tests de contratos, resolução de intenção determinística,
rejeição de mutações sem confirmação e mocks de `FinancialContextProvider`,
`ToolRegistry`, `ActionGateway` e `ProviderAdapter`. Nenhum teste dependerá de React ou
`localStorage`.

### Critérios gerais de conclusão da Fase 2

- Toda resposta financeira traz origem compatível com dado, cálculo, simulação ou
  inferência.
- Nenhuma mutação ocorre sem preview e confirmação explícita.
- Tools produzem resultados determinísticos e tipados.
- Contexto enviado ao provider é mínimo e auditável.
- Dados existentes permanecem compatíveis.
- Perguntas ambíguas são esclarecidas, não adivinhadas.

## Regras de trabalho

- Mockups em `assets/mockups` são a principal referência visual.
- Um PR por tela/experiência completa.
- Mudanças funcionais novas devem ser declaradas explicitamente no escopo do PR.
- Reutilizar tokens existentes e preservar regras financeiras e dados.
- Antes do merge: revisar diff, lint/formatação/typecheck/build conforme aplicável e preview Vercel do último commit.
- Separar problemas preexistentes de bloqueadores introduzidos pelo PR.
- Não iniciar o próximo PR nem fazer merge sem a decisão da usuária.
