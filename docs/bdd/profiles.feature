# Perfis e escopo financeiro

Funcionalidade: PERF - O perfil ativo determina o recorte dos dados financeiros

  Cenário: PERF-001 Bruna vê somente registros de Bruna
    Dado gastos de Bruna, Matheus e Casal no mesmo mês
    Quando o perfil ativo for Bruna
    Então apenas gastos cujo responsável é Bruna entram em totais, categorias e limites pessoais dela

  Cenário: PERF-002 Matheus vê somente registros de Matheus
    Dado gastos de Bruna, Matheus e Casal no mesmo mês
    Quando o perfil ativo for Matheus
    Então apenas gastos cujo responsável é Matheus entram em totais, categorias e limites pessoais dele

  Cenário: PERF-003 Casal é a visão consolidada
    Dado gastos de Bruna, Matheus e Casal no mesmo mês
    Quando o perfil ativo for Casal
    Então os três responsáveis entram uma única vez na consolidação

  Cenário: PERF-004 A troca de perfil não mantém valores do perfil anterior
    Dado a mesma competência com dados para Bruna e Matheus
    Quando a pessoa trocar o perfil ativo
    Então Home, Categorias, Limites, Entradas, Recebíveis, Parcelas, Faturas e Calendário recalculam pelo novo escopo
