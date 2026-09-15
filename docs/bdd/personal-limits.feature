# Limites pessoais

Funcionalidade: LIM - Limites pessoais usam buckets explícitos

  Cenário: LIM-001 Bruna possui dois buckets e um agregado visual
    Então Unha possui limite de R$ 150
    E Pessoal possui limite de R$ 350
    E Total pessoal de R$ 500 é somente a soma dos dois buckets

  Cenário: LIM-002 Matheus possui somente o bucket Pessoal
    Então Matheus Pessoal possui limite de R$ 350

  Cenário: LIM-003 FIES não consome limite pessoal
    Dado FIES de Bruna na categoria Educação sem bucket
    Então ele não consome Unha nem Pessoal de Bruna

  Cenário: LIM-004 Mercado da casa não consome limite pessoal sem bucket
    Dado Mercado na categoria Alimentação sem bucket
    Então ele não consome franquia pessoal por causa de categoria ou responsável

  Cenário: LIM-005 Unha consome somente bruna_nails
    Dado um gasto com bucket bruna_nails
    Então somente Unha de Bruna aumenta

  Cenário: LIM-006 Consumo cotidiano de Bruna usa bruna_personal
    Dado almoço individual da Bruna com bucket bruna_personal
    Então somente Pessoal de Bruna aumenta

  Cenário: LIM-007 Consumo pessoal de Matheus usa matheus_personal
    Dado gasto pessoal de Matheus com bucket matheus_personal
    Então somente Pessoal de Matheus aumenta

  Cenário: LIM-008 O agregado de Bruna não é persistível
    Então bruna_total não é um personalLimitBucket válido
    E nenhum gasto pode consumir um terceiro limite de R$ 500

  Cenário: LIM-009 Edição pode trocar ou remover bucket
    Dado um gasto com bucket pessoal
    Quando o bucket for alterado ou removido
    Então somente o consumo da franquia é recalculado
    E o gasto e a categoria permanecem
