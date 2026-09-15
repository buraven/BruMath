# Entradas

Funcionalidade: INC - Entradas compõem a renda disponível sem confundir destino

  Cenário: INC-001 Renda base participa do mês selecionado
    Quando uma competência for selecionada
    Então a renda base configurada compõe o total de entradas do mês

  Cenário: INC-002 Entrada extra em conta aumenta o disponível
    Dada uma entrada extra destinada à conta no mês ativo
    Então ela aumenta entradas extras e saldo disponível

  Cenário: INC-003 Entrada destinada ao cartão não aumenta disponível em conta
    Dada uma entrada destinada ao cartão
    Então ela não é incluída nas entradas extras da conta

  Cenário: INC-004 Criar, editar e excluir entrada preserva persistência
    Quando uma entrada for salva, editada ou excluída com confirmação
    Então a projeção correspondente é atualizada e permanece após recarregar
