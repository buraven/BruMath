# Contrato funcional BDD do BruMath

Este diretório é a fonte versionada das regras funcionais já existentes no
BruMath. Os arquivos `.feature` usam Gherkin em português para explicar **o
que** o produto deve fazer; eles não prescrevem componente, API, banco ou
estratégia de teste.

## Convenção de identificadores

Cada cenário começa com um identificador estável por domínio, por exemplo
`EXP-003`, `LIM-005` ou `FAT-011`. O identificador não deve mudar quando o
texto do cenário é refinado. A matriz em [COVERAGE.md](./COVERAGE.md) liga
cada identificador aos testes que o protegem.

## Camadas de qualidade

| Camada | Responsabilidade |
| --- | --- |
| Unit | Cálculos puros, filtros, ciclos e invariantes financeiros. |
| Integration | Colaboração entre selectors, controllers, ações, repositórios e persistência. |
| E2E | Journey real pela UI: UI → domínio → persistência → UI. |
| Manual | Fidelidade visual, UX, Safari e iPad físico. |

Um cenário pode ter mais de uma camada quando o risco justificar. Não é
necessário reproduzir todas as regras unitárias em Playwright.

## Política para novos PRs

- Nova ou alterada regra de negócio: criar ou atualizar cenário BDD e matriz.
- Bug funcional: adicionar cenário/regressão quando representar uma regra
  duradoura.
- Mudança de cálculo: atualizar unit ou integration correspondente.
- Mudança de jornada: atualizar o E2E correspondente.
- Nenhum PR é considerado pronto se introduzir regra crítica com status
  `MISSING`, salvo justificativa explícita registrada na matriz.

## Contrato visual derivado dos mockups

Os mockups em `assets/mockups` também são referência BDD para a estrutura das
telas: regiões, conteúdo obrigatório, estados vazios, CTAs, navegação e
breakpoints. O mapeamento explícito por imagem está em
[MOCKUP_INVENTORY.md](./MOCKUP_INVENTORY.md). Esses cenários usam o prefixo `VIS` e ficam em
`mockups.feature`. Eles são validados manualmente enquanto não existe
infraestrutura de regressão visual.

BDD não tenta automatizar preferência estética ou pixel-perfect. Fidelidade aos
mockups, sensação de uso e Safari/iPad físico continuam sendo aceite humano,
mas deixam de ser requisitos implícitos: a matriz registra a referência e o
estado da validação.
