# Categorias e detalhamento

Funcionalidade: CAT - Categorias agrupam gastos reais pelo escopo selecionado

  Cenário: CAT-001 Total por categoria usa somente gastos do mês e perfil ativos
    Dado gastos em categorias, meses e perfis distintos
    Quando a tela de Categorias for aberta
    Então cada total mostra somente o recorte ativo

  Cenário: CAT-002 Detalhamento reconcilia com o card da categoria
    Dada uma categoria com gastos
    Quando a pessoa abrir seu detalhamento
    Então a lista contém os gastos daquela categoria
    E a soma dos itens é igual ao valor do card

  Cenário: CAT-003 Categoria sem limite tem estado explícito
    Dada uma categoria sem orçamento configurado
    Então ela informa que não há limite definido
    E não apresenta percentual ou restante artificial

  Cenário: CAT-004 Estados de categoria usam o limite configurado
    Dada uma categoria com limite
    Então abaixo de 80% ela está normal
    E a partir de 80% sem exceder ela está em atenção
    E acima do limite ela está excedida

  Cenário: CAT-005 Categoria e limite pessoal são dimensões independentes
    Dado um almoço na categoria Alimentação com bucket bruna_personal
    Então ele entra em Alimentação e no bucket pessoal
    E o total geral não é duplicado

  Cenário: CAT-006 Mês ou perfil sem gastos mantém a tela utilizável
    Dado um recorte sem gastos
    Então categorias configuradas podem continuar visíveis
    E o detalhamento mostra estado vazio em vez de registros de outro recorte
