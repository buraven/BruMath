# Quem me deve

Funcionalidade: REC - Valores a receber preservam saldo até a quitação

  Cenário: REC-001 Criar valor a receber registra total e competência
    Quando um devedor e valor forem salvos
    Então o recebível aparece no recorte aplicável

  Cenário: REC-002 Recebimento parcial mantém saldo restante
    Dado um recebível de R$ 300
    Quando for registrado recebimento de R$ 100
    Então o saldo restante é R$ 200
    E o recebível não é considerado quitado

  Cenário: REC-003 Múltiplos recebimentos não ultrapassam o valor devido
    Dado um recebível parcialmente pago
    Quando outro recebimento for registrado
    Então o valor pago é limitado ao total devido

  Cenário: REC-004 Quitação ocorre somente quando o total é alcançado
    Dado um recebível em aberto
    Quando a soma recebida alcançar o valor devido
    Então o saldo é zero e a competência de recebimento é registrada

  Cenário: REC-005 Recebimento gera entrada no destino existente
    Quando um recebimento for registrado
    Então uma entrada correspondente é criada na conta ou cartão conforme o destino
