# Navegação

Funcionalidade: Navegação dá acesso às experiências existentes

  Cenário: NAV-001 - A navegação principal está disponível
    Quando o BruMath é carregado
    Então a navegação principal permite alcançar as telas implementadas

  Cenário: NAV-002 - Faturas abre sem erro fatal
    Quando a pessoa navega para Faturas
    Então a tela de cartões e faturas é renderizada

  Cenário: NAV-003 - Detalhe mantém o contexto de origem
    Quando a pessoa abre o detalhe de uma categoria ou fatura
    Então o mês e o perfil ativos permanecem aplicados ao retorno

  Cenário: NAV-004 - Ações destrutivas pedem confirmação
    Quando a interface oferece excluir ou pagar uma operação destrutiva
    Então a confirmação real da interface é exigida antes da mutação
