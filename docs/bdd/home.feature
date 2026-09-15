# Home

Funcionalidade: Home apresenta o retrato determinístico do período

  Cenário: HOME-001 - Resumos usam o período e perfil ativos
    Quando o mês ou perfil é alterado
    Então os cards e resumos da Home recalculam com o mesmo escopo

  Cenário: HOME-002 - Insights da Home são determinísticos
    Quando há sinais financeiros suportados
    Então a Home apresenta insights derivados localmente
    E eles não dependem do provider de IA

  Cenário: HOME-003 - Assistente compacto não altera sua fonte financeira
    Quando o painel compacto é exibido na Home
    Então suas ações e CTA preservam o fluxo do Assistente completo
    E não persistem dados sem confirmação

  Cenário: HOME-004 - Estado sem dados continua informativo
    Dado um mês sem gastos ou recebíveis
    Então a Home exibe estados vazios sem inventar valores
