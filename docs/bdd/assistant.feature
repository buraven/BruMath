# Assistente

Funcionalidade: Assistente financeiro com dados determinísticos e ações confirmadas

  Cenário: AST-001 - Consulta não persiste alterações
    Quando a pessoa faz uma pergunta financeira
    Então a resposta usa ferramentas determinísticas quando necessário
    E nenhum dado financeiro é persistido apenas pela consulta

  Cenário: AST-002 - Simulação não persiste alterações
    Quando a pessoa pede uma simulação
    Então a simulação não altera o snapshot financeiro

  Cenário: AST-003 - Mutação exige confirmação explícita
    Dado uma proposta de registrar gasto
    Quando a pessoa ainda não confirmou
    Então nenhuma despesa é persistida

  Cenário: AST-004 - Cancelamento não persiste
    Dado uma proposta pendente
    Quando a pessoa cancela
    Então a proposta não é executada

  Cenário: AST-005 - Confirmação executa uma única vez
    Dado uma proposta confirmada
    Quando a confirmação é recebida novamente
    Então a mesma proposta não cria uma segunda despesa

  Cenário: AST-006 - Contexto financeiro respeita mês e perfil
    Quando o Assistente consulta dados para um mês e perfil selecionados
    Então os números usam o mesmo escopo exibido na interface

  Cenário: AST-007 - Bucket pessoal é explícito
    Quando uma proposta de gasto não contém bucket pessoal inequívoco
    Então o Assistente não inventa um bucket por categoria ou responsável

  Cenário: AST-008 - Ambiguidade relevante pede esclarecimento
    Quando faltam dados essenciais para uma mutação, como responsável ou categoria
    Então o Assistente pede somente o esclarecimento necessário antes de propor a ação
