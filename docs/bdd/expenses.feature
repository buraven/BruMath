# Gastos

Funcionalidade: EXP - Gastos são a fonte única das projeções financeiras

  Cenário: EXP-001 Criar gasto registra descrição, valor, data, categoria e responsável
    Quando a pessoa salvar um gasto válido
    Então ele aparece no mês, categoria e perfil compatíveis

  Cenário: EXP-002 Editar gasto recalcula suas projeções
    Dado um gasto existente
    Quando seus dados financeiros forem alterados e salvos
    Então os totais, categoria, limite e fatura aplicáveis refletem o novo gasto

  Cenário: EXP-003 Excluir gasto exige confirmação
    Dado um gasto existente
    Quando a pessoa solicitar exclusão e cancelar
    Então o gasto permanece
    Quando a pessoa confirmar a exclusão
    Então o gasto e suas projeções são removidos

  Cenário: EXP-004 O mês do gasto controla sua competência de gasto
    Dado gastos em meses diferentes
    Quando a pessoa selecionar uma competência
    Então somente gastos daquele mês entram nos totais mensais

  Cenário: EXP-005 Gasto sem cartão permanece válido
    Quando um gasto for salvo sem cartão
    Então ele participa dos totais e categorias
    E não entra em uma fatura

  Cenário: EXP-006 Gasto associado ao cartão continua sendo uma única despesa
    Quando um gasto possuir creditCardId
    Então ele aparece uma vez nos totais e categorias
    E é projetado na fatura do ciclo correspondente sem criar outra despesa

  Cenário: EXP-007 Bucket pessoal é opcional e independente do responsável
    Quando um gasto não possuir personalLimitBucket
    Então ele não consome limite pessoal por inferência

  Cenário: EXP-008 Parcelamento não cria uma segunda fonte de gastos
    Quando um compromisso parcelado for associado a cartão
    Então suas parcelas são projetadas nos ciclos aplicáveis
    E o modelo de parcelamento existente continua sendo a fonte de verdade
