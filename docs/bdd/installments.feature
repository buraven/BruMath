# Parcelamentos e Futuro

Funcionalidade: PAR - Parcelamentos preservam quantidade, vencimento e projeções

  Cenário: PAR-001 Criar parcelamento registra quantidade total e vencimento
    Quando um parcelamento válido for salvo
    Então ele aparece como ativo enquanto houver parcelas restantes

  Cenário: PAR-002 Parcelas restantes são total menos parcelas pagas
    Dado um parcelamento com parcelas já pagas
    Então a quantidade restante é calculada deterministicamente

  Cenário: PAR-003 Pagar uma parcela avança somente uma competência
    Quando uma parcela for marcada como paga
    Então parcelas pagas aumenta em um
    E o próximo vencimento avança um mês quando ainda houver saldo

  Cenário: PAR-004 Quitar exige confirmação e encerra todas as restantes
    Dado um parcelamento ativo
    Quando a pessoa confirmar quitação
    Então todas as parcelas restantes passam a pagas

  Cenário: PAR-005 Adiantar preserva a semântica existente do produto
    Quando a pessoa confirmar adiantamento de parcelas
    Então a quantidade solicitada é limitada às parcelas restantes
    E o vencimento é recalculado pela regra existente

  Cenário: PAR-006 Parcelamento vinculado a cartão é projetado no ciclo correto
    Dado parcelamento ativo com creditCardId
    Então a parcela atual entra na fatura do ciclo correspondente
    E não é convertida em Expense artificial
