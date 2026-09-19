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

  Cenário: AST-009 - Resultado financeiro tem proveniência determinística
    Quando o Assistente responde uma consulta financeira
    Então os valores confirmados vêm de fatos ou cálculos determinísticos do BruMath
    E a formulação do provider é identificada como inferência

  Cenário: AST-010 - Plano inválido do provider falha com segurança
    Quando o provider solicita uma tool desconhecida ou argumentos inválidos
    Então o BruMath rejeita o plano
    E nenhuma consulta ou mutação parecida é executada por adivinhação

  Cenário: AST-011 - Provider não sobrescreve resultado financeiro
    Quando uma tool determinística retorna um resultado financeiro
    Então o provider recebe apenas esse resultado autorizado para formular a resposta
    E não pode promovê-lo a um novo fato ou cálculo

  Cenário: AST-012 - Simulação permanece não persistente
    Quando a pessoa pede uma simulação suportada
    Então a resposta é classificada como simulação
    E nenhuma action financeira é executada

  Cenário: AST-013 - Saída malformada preserva os dados financeiros
    Quando o provider retorna uma saída estruturada malformada
    Então o Assistente retorna um fallback seguro
    E os dados financeiros permanecem inalterados
