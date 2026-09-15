# Inventário de contrato visual

Os mockups não substituem as regras de domínio. Eles definem a estrutura visual,
hierarquia, estados e responsividade que os cenários `VIS-*` usam como aceite
humano. Esta tabela explicita o que cada imagem contrata e evita transformar uma
tela nova em uma interface genérica para depois aproximá-la do desenho.

| Mockup oficial | Contrato visual atual | Cenários BDD | Situação / dono |
| --- | --- | --- | --- |
| `01-home-tablet-mobile.png` | Home em tablet e mobile: header, cards-resumo, dashboard e navegação responsiva. | VIS-001, VIS-007 | Home; fidelidade final permanece pendência explícita. |
| `02-dashboard-tablet-mobile.png` | Linguagem de dashboard: grid, densidade, cards, CTAs, estados e adaptação tablet/mobile. | VIS-001, VIS-002, VIS-003, VIS-007 | Referência transversal para Home, Categorias e Faturas. |
| `03-home-dark-mobile.png` | Home em tema escuro e contraste de componentes. | VIS-001, VIS-006 | Aceite humano em tema escuro. |
| `04-home-dark-dashboard.png` | Dashboard escuro em tela ampla: contraste, agrupamento e hierarquia. | VIS-001, VIS-006 | Aceite humano em tema escuro. |
| `05-faturas-calendario.png` | Cabeçalho, resumo, filtros, cards e detalhes de **Faturas**. Elementos de calendário não são implementados no #54. | VIS-003, VIS-004, VIS-005, VIS-007 | Faturas #54; calendário reservado ao #55. |
| `06-calendario.png` | Calendário e compromissos. | — | Reservado ao #55; não deve ser simulado em Faturas. |
| `07-faturas.png` | Detalhe de Faturas: ciclo, limite, categorias, lançamentos, ações e estados vazios. | VIS-003, VIS-004, VIS-005 | Faturas #54. |

## Como usar no aceite

Para uma tela nova, primeiro identificar o mockup e os cenários `VIS-*` que
se aplicam; depois construir a estrutura e os componentes; por fim, comparar a
implementação nos viewports 1440, 1180, 820 e 390. A comparação classifica cada
bloco como **fiel**, **diferença intencional** ou **divergente**. Uma divergência
relevante não pode ser declarada fiel apenas porque os testes funcionais passaram.
