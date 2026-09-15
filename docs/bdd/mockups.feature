# Contrato visual dos mockups

Funcionalidade: As telas preservam a estrutura visual definida para o BruMath

  Contexto:
    Dado que os mockups oficiais em assets/mockups são a referência visual do produto
    E que cenários visuais são validados por aceite humano, não por comparação pixel a pixel no CI

  Esquema do Cenário: VIS-001 - Home preserva as regiões estruturais do dashboard
    Quando a Home é aberta em <viewport>
    Então header, período, perfil, cards-resumo e dashboard têm composição reconhecível
    E a apresentação respeita a densidade e a hierarquia dos mockups Home

    Exemplos:
      | viewport |
      | 1440x1024 |
      | 1180x820 |
      | 820x1180 |
      | 390x844 |

  Cenário: VIS-002 - Categorias usa a linguagem visual aprovada
    Quando a pessoa abre Categorias e seu detalhamento
    Então cards, barras, ícones, estados vazios e CTAs usam a linguagem dos mockups Home
    E a composição aproveita desktop, tablet paisagem, tablet retrato e mobile sem overflow horizontal

  Cenário: VIS-003 - Faturas nasce do mockup de faturas
    Quando a pessoa abre Faturas
    Então título, CTA, resumo, filtros, card de cartão, ciclo e detalhamento seguem a composição de 05-faturas-calendario.png e 07-faturas.png
    E nenhum elemento de Calendário é apresentado como funcional enquanto estiver fora do escopo

  Cenário: VIS-004 - Ciclo vazio tem estado visual honesto
    Dado um cartão sem lançamentos no ciclo atual
    Quando a pessoa visualiza Faturas
    Então o cartão continua visível
    E o ciclo é apresentado como "Em andamento", sem aparência de dívida

  Cenário: VIS-005 - Modais mantêm o padrão de formulário do produto
    Quando a pessoa cria ou edita gasto e cartão
    Então campos, validações, ações de cancelar/salvar e confirmações preservam os padrões visuais existentes

  Cenário: VIS-006 - Tema claro e escuro preservam contraste funcional
    Quando a pessoa alterna entre tema claro e escuro
    Então textos, barras, ícones, badges e CTAs permanecem legíveis e distinguíveis

  Cenário: VIS-007 - Responsividade não bloqueia ações principais
    Quando uma tela é aberta em tablet ou mobile
    Então não há overflow horizontal grave
    E CTAs, modais e navegação necessários para o fluxo permanecem acessíveis
