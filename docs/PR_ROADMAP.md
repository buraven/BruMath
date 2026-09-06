# Roadmap de evolução do BruMath

## Estado atual

- #35 integrado: Home e mockups oficiais.
- #36 integrado: navegação.
- #37 integrado: gastos e responsividade.
- #38 integrado: Futuro e parcelas.
- #39 integrado: dívidas, recebimentos, entradas e campos formatados.
- #40 integrado na main (`eede6b7`).
- #41 em implementação: fase A, UX/Chat. Fase B permanece planejada para depois.

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

Branch: `feature/financial-assistant-pr41`. Em implementação. Duas fases
conceituais no planejamento:

**A — UX/Chat:** seguir os mockups oficiais; conversa ocupando a área útil,
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

Branch: `feature/preferences-pr42`. Manter perfil, tema e preferências
existentes, seguindo mockups e tokens. Não misturar com QA responsivo global.

### #43 — Responsive QA

Branch: `feature/responsive-qa-pr43`. Pente-fino global de iPhone, iPad/tablet e
desktop em todas as telas: breakpoints, bottom navigation, sidebar, safe-area,
sticky elements, grids e overflows. Não transformar PRs anteriores em refactors
responsivos intermináveis.

### #44 — Legacy cleanup

Branch: `chore/legacy-architecture-cleanup-pr44`. Remover somente arquitetura
visual antiga realmente não utilizada, sem mudar comportamento.

### #45 — Final QA

Branch: `chore/final-qa-pr45`. Validar fluxos completos, regressões, regras
financeiras, persistência, responsividade final e preparação para produção.

## Regras de trabalho

- Mockups em `assets/mockups` são a principal referência visual.
- Um PR por tela/experiência completa.
- Mudanças funcionais novas devem ser declaradas explicitamente no escopo do PR.
- Reutilizar tokens existentes e preservar regras financeiras e dados.
- Antes do merge: revisar diff, lint/formatação/typecheck/build conforme aplicável e preview Vercel do último commit.
- Separar problemas preexistentes de bloqueadores introduzidos pelo PR.
- Não iniciar o próximo PR nem fazer merge sem a decisão da usuária.
