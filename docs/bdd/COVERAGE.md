# Matriz de cobertura BDD

Esta matriz conecta os cenários versionados em `docs/bdd` às evidências atuais. `COVERED` exige uma evidência específica; `PARTIAL` indica que a regra está protegida, mas ainda não em todas as camadas desejáveis; `MANUAL` é reservado para aceites humanos, sobretudo fidelidade visual e UX. Não há cenário crítico de domínio marcado como `MISSING` nesta revisão.

| ID | Regra | Unit | Integration | E2E | Manual | Status |
| --- | --- | --- | --- | --- | --- | --- |
| PERF-001 | Bruna só vê Bruna | `financialSelectors.test.ts` | `createFinancialContextProvider.test.ts` | `core-flows.spec.ts` | - | COVERED |
| PERF-002 | Matheus só vê Matheus | `financialSelectors.test.ts` | `createFinancialContextProvider.test.ts` | `core-flows.spec.ts` | - | COVERED |
| PERF-003 | Casal consolida sem duplicar | `financialSelectors.test.ts` | `financialTools.test.ts` | `core-flows.spec.ts` | - | COVERED |
| PERF-004 | troca de perfil recalcula | `financialSelectors.test.ts` | - | `core-flows.spec.ts` | - | COVERED |
| EXP-001 | criar gasto | - | `financialMutationControllers.test.ts` | `core-flows.spec.ts`, `invoices.spec.ts` | - | COVERED |
| EXP-002 | editar gasto recalcula | `invoices.test.ts` | `financialMutationControllers.test.ts` | `core-flows.spec.ts`, `invoices.spec.ts` | - | COVERED |
| EXP-003 | excluir exige confirmação | - | `financialMutationControllers.test.ts` | `core-flows.spec.ts`, `invoices.spec.ts` | - | COVERED |
| EXP-004 | competência por mês | `financialSelectors.test.ts` | `financialTools.test.ts` | - | - | COVERED |
| EXP-005 | gasto sem cartão é válido | `invoices.test.ts` | - | `invoices.spec.ts` | - | COVERED |
| EXP-006 | gasto no cartão é único | `invoices.test.ts` | - | `invoices.spec.ts` | - | COVERED |
| EXP-007 | bucket é opcional | `personalLimits.test.ts` | `financialSelectors.test.ts` | `core-flows.spec.ts` | - | COVERED |
| EXP-008 | parcela não cria outra fonte | `invoices.test.ts` | `financialMutationControllers.test.ts` | - | - | COVERED |
| CAT-001 | total por mês/perfil | `financialSelectors.test.ts` | `financialTools.test.ts` | - | - | COVERED |
| CAT-002 | detalhe reconcilia com card | `financialSelectors.test.ts` | - | - | - | COVERED |
| CAT-003 | sem limite é explícito | `financialSelectors.test.ts` | - | - | - | COVERED |
| CAT-004 | normal/atenção/excedido | `financialSelectors.test.ts` | - | - | - | COVERED |
| CAT-005 | categoria e bucket independentes | `personalLimits.test.ts` | `financialSelectors.test.ts` | - | - | COVERED |
| CAT-006 | vazio utilizável | `financialSelectors.test.ts` | - | - | estados vazios | PARTIAL |
| LIM-001 | Bruna: dois buckets + agregado | `personalLimits.test.ts` | `financialSelectors.test.ts` | `core-flows.spec.ts` | - | COVERED |
| LIM-002 | Matheus: bucket pessoal | `personalLimits.test.ts` | `financialSelectors.test.ts` | `core-flows.spec.ts` | - | COVERED |
| LIM-003 | FIES não consome pessoal | `financialSelectors.test.ts` | `createFinancialContextProvider.test.ts` | - | - | COVERED |
| LIM-004 | mercado sem bucket não consome | `financialSelectors.test.ts` | - | `core-flows.spec.ts` | - | COVERED |
| LIM-005 | unha usa só bruna_nails | `personalLimits.test.ts` | `financialSelectors.test.ts` | `core-flows.spec.ts` | - | COVERED |
| LIM-006 | pessoal Bruna usa só bucket correto | `personalLimits.test.ts` | `financialSelectors.test.ts` | `core-flows.spec.ts` | - | COVERED |
| LIM-007 | pessoal Matheus usa bucket correto | `personalLimits.test.ts` | `financialSelectors.test.ts` | `core-flows.spec.ts` | - | COVERED |
| LIM-008 | agregado não é persistível | `personalLimits.test.ts` | `BruMathDataRepository.test.ts` | - | - | COVERED |
| LIM-009 | editar/remove bucket recalcula | `financialSelectors.test.ts` | `financialMutationControllers.test.ts` | - | - | COVERED |
| INC-001 | renda-base no mês | `financialSelectors.test.ts` | `financialTools.test.ts` | - | - | COVERED |
| INC-002 | entrada em conta aumenta disponível | `financialSelectors.test.ts` | `financialMutationControllers.test.ts` | - | - | COVERED |
| INC-003 | entrada em cartão não aumenta conta | `financialSelectors.test.ts` | `financialTools.test.ts` | - | - | COVERED |
| INC-004 | ciclo de entrada persiste | - | `financialMutationControllers.test.ts` | `core-flows.spec.ts` | - | COVERED |
| REC-001 | cria recebível | - | `financialMutationControllers.test.ts` | `core-flows.spec.ts` | - | COVERED |
| REC-002 | recebimento parcial mantém saldo | - | `financialMutationControllers.test.ts` | `core-flows.spec.ts` | - | COVERED |
| REC-003 | múltiplos recebimentos não excedem | - | `financialMutationControllers.test.ts` | `core-flows.spec.ts` | - | COVERED |
| REC-004 | quitação só ao total | - | `financialMutationControllers.test.ts` | `core-flows.spec.ts` | - | COVERED |
| REC-005 | recebimento gera entrada | - | `financialMutationControllers.test.ts` | `core-flows.spec.ts` | - | COVERED |
| PAR-001 | criar parcelamento | - | `financialMutationControllers.test.ts` | `core-flows.spec.ts` | - | COVERED |
| PAR-002 | parcelas restantes | `financialSelectors.test.ts` | - | - | - | COVERED |
| PAR-003 | pagar parcela avança uma competência | - | `financialMutationControllers.test.ts` | - | - | COVERED |
| PAR-004 | quitar exige confirmação | - | `financialMutationControllers.test.ts` | `core-flows.spec.ts` | - | COVERED |
| PAR-005 | adiantar preserva semântica | - | `financialMutationControllers.test.ts` | - | - | COVERED |
| PAR-006 | parcela no cartão respeita ciclo | `invoices.test.ts` | - | - | - | COVERED |
| FAT-001 | criar/persistir cartão | `BruMathDataRepository.test.ts` | - | `invoices.spec.ts` | - | COVERED |
| FAT-002 | cartão vazio continua visível | `invoices.test.ts` | - | `invoices.spec.ts` | - | COVERED |
| FAT-003 | closingDay resolve competência | `invoices.test.ts` | - | `invoices.spec.ts` | - | COVERED |
| FAT-004 | ciclo zero não é dívida | `invoices.test.ts` | - | `invoices.spec.ts` | - | COVERED |
| FAT-005 | saldo aberto é a pagar | `invoices.test.ts` | - | `invoices.spec.ts` | - | COVERED |
| FAT-006 | pagamento não duplica compra | `invoices.test.ts` | - | `invoices.spec.ts` | - | COVERED |
| FAT-007 | fatura agrega Expense | `invoices.test.ts` | `createFinancialContextProvider.test.ts` | `invoices.spec.ts` | - | COVERED |
| FAT-008 | editar move projeção | `invoices.test.ts` | - | `invoices.spec.ts` | - | COVERED |
| FAT-009 | excluir atualiza ciclo | `invoices.test.ts` | - | `invoices.spec.ts` | - | COVERED |
| FAT-010 | crédito é independente | `invoices.test.ts` | - | `invoices.spec.ts` | - | COVERED |
| FAT-011 | Casal preserva cartões individuais | `invoices.test.ts` | - | - | perfil consolidado | PARTIAL |
| FAT-012 | parcelas por ciclo | `invoices.test.ts` | - | - | - | COVERED |
| FAT-013 | CTA reutiliza formulário de gasto | - | - | `invoices.spec.ts` | - | COVERED |
| AST-001 | consulta não persiste | - | `AssistantEngine.test.ts` | `core-flows.spec.ts` | - | COVERED |
| AST-002 | simulação não persiste | - | `registerExpenseAction.test.ts` | - | - | COVERED |
| AST-003 | mutação exige confirmação | - | `registerExpenseAction.test.ts` | `core-flows.spec.ts` | - | COVERED |
| AST-004 | cancelar não persiste | - | `registerExpenseAction.test.ts` | `core-flows.spec.ts` | - | COVERED |
| AST-005 | confirmação executa uma vez | - | `registerExpenseAction.test.ts` | `core-flows.spec.ts` | - | COVERED |
| AST-006 | contexto respeita escopo | `financialTools.test.ts` | `createFinancialContextProvider.test.ts` | - | - | COVERED |
| AST-007 | bucket não é inferido | `ConversationPlanParser.test.ts` | `registerExpenseAction.test.ts` | - | - | COVERED |
| AST-008 | ambiguidade pede esclarecimento | `conversationContext.test.ts` | `ConversationPlanParser.test.ts` | - | - | COVERED |
| HOME-001 | Home respeita mês/perfil | `financialSelectors.test.ts` | - | `core-flows.spec.ts` | - | COVERED |
| HOME-002 | insights são determinísticos | `homeInsights.test.ts` | - | - | - | COVERED |
| HOME-003 | painel compacto preserva fluxo | `responseStyle.test.ts` | `AssistantEngine.test.ts` | - | compact mode | PARTIAL |
| HOME-004 | vazio não inventa valores | `financialSelectors.test.ts` | `createFinancialContextProvider.test.ts` | - | - | COVERED |
| PREF-001 | tema é aplicado | - | - | - | escolha visual | MANUAL |
| PREF-002 | tema persiste | - | - | - | reload manual | MANUAL |
| PREF-003 | perfil/período afetam dados | `financialSelectors.test.ts` | - | - | - | COVERED |
| NAV-001 | navegação principal disponível | - | - | `smoke.spec.ts` | - | COVERED |
| NAV-002 | Faturas abre | - | - | `smoke.spec.ts` | - | COVERED |
| NAV-003 | detalhe mantém contexto | - | - | - | navegação de detalhes | MANUAL |
| NAV-004 | ação destrutiva confirma | - | `financialMutationControllers.test.ts` | `invoices.spec.ts` | - | COVERED |
| TRN-001 | persiste após reload | `BruMathDataRepository.test.ts` | - | `invoices.spec.ts` | - | COVERED |
| TRN-002 | legado compatível | `BruMathDataRepository.test.ts` | - | - | - | COVERED |
| TRN-003 | edição recalcula projeções | `invoices.test.ts` | `financialMutationControllers.test.ts` | `invoices.spec.ts` | - | COVERED |
| TRN-004 | exclusão remove projeções | `invoices.test.ts` | `financialMutationControllers.test.ts` | `invoices.spec.ts` | - | COVERED |
| TRN-005 | projeções não duplicam gasto | `invoices.test.ts` | `createFinancialContextProvider.test.ts` | `invoices.spec.ts` | - | COVERED |
| VIS-001 | Home estrutural por viewport | - | - | smoke responsivo | aceite por mockup | MANUAL |
| VIS-002 | Categorias na linguagem visual | - | - | - | aceite por mockup | MANUAL |
| VIS-003 | Faturas nasce dos mockups | - | - | - | aceite por mockup | MANUAL |
| VIS-004 | ciclo vazio visual honesto | - | - | `invoices.spec.ts` | aceite por mockup | COVERED |
| VIS-005 | modais preservam padrão | - | - | `invoices.spec.ts` | aceite visual | PARTIAL |
| VIS-006 | contraste claro/escuro | - | - | - | aceite humano | MANUAL |
| VIS-007 | responsividade não bloqueia CTA | - | - | `invoices.spec.ts` | iPad/Safari físico | PARTIAL |

## Resumo desta revisão

- **86 cenários BDD** versionados.
- **72 COVERED**, **8 PARTIAL**, **6 MANUAL**, **0 MISSING**.
- Os cenários `PARTIAL` já têm proteção na camada mais crítica disponível; a melhoria indicada é ampliar a jornada real da interface, não mudar a regra de negócio.
- Os seis cenários `MANUAL` são deliberadamente subjetivos ou dependentes de aceite visual dos mockups e de dispositivos reais. Eles não devem ser falsamente marcados como testes de pixel no CI.

## Próximos incrementos de cobertura

1. Ampliar E2E de troca de perfil/mês quando uma alteração de journey tocar a Home ou Categorias.
2. Adicionar um E2E de recebível parcial quando o fluxo de Recebíveis for alterado.
3. Converter os aceites visuais em checklist por viewport; comparação pixel-perfect continua fora da esteira.
