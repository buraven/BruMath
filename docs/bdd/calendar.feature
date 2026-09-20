# Calendário e compromissos

Funcionalidade: CAL - Calendário projeta dados financeiros existentes

  Cenário: CAL-001 A projeção não persiste eventos paralelos
    Quando o calendário é montado a partir dos dados financeiros
    Então seus itens são derivados de gastos, entradas, parcelas e faturas
    E nenhum evento financeiro paralelo é persistido

  Cenário: CAL-002 O mês selecionado limita a projeção
    Quando a pessoa troca o mês ativo
    Então o grid e a agenda mostram somente itens datados naquele mês

  Cenário: CAL-003 O calendário respeita o escopo de perfil
    Quando Bruna, Matheus ou Casal é selecionado
    Então o calendário usa a mesma regra de escopo financeiro vigente

  Cenário: CAL-004 Parcela sem cartão aparece em seu próximo vencimento
    Dado um parcelamento ativo sem cartão associado
    Então ele é projetado na data de nextDue
    E sua quantidade restante continua sendo derivada do parcelamento original

  Cenário: CAL-016 Parcela vinculada a cartão compõe somente a fatura
    Dado um parcelamento ativo associado a um cartão
    Então o calendário mostra o vencimento da fatura do ciclo correto
    E não projeta a parcela como compromisso individual

  Cenário: CAL-005 Vencimento de fatura atravessa competência corretamente
    Dado um cartão cujo fechamento e vencimento ficam em meses distintos
    Então o calendário do mês do vencimento encontra a fatura do ciclo adjacente

  Cenário: CAL-006 Ciclo vazio não vira dívida
    Dado um cartão sem compras no ciclo
    Então seu fechamento pode aparecer como marco operacional
    Mas não existe compromisso de pagamento

  Cenário: CAL-007 Agenda do dia reconcilia com o grid
    Quando um dia com itens é selecionado
    Então a agenda mostra os mesmos itens sinalizados no grid

  Cenário: CAL-008 Mês sem itens tem estado vazio claro
    Dado um mês sem transações ou compromissos projetáveis
    Então o calendário não inventa eventos

  Cenário: CAL-009 Pagamento de fatura muda somente o status projetado
    Dado uma fatura paga
    Então o vencimento indica status pago quando exibido
    E as compras originais não são duplicadas

  Cenário: CAL-010 Ações de parcela reutilizam o domínio existente
    Quando uma ação de parcela é iniciada pelo calendário
    Então ela usa os mesmos fluxos de pagar, adiantar, quitar, editar ou excluir

  Cenário: CAL-011 Transação histórica não vira compromisso futuro
    Quando um gasto ou entrada é exibido em sua data real
    Então ele é identificado como histórico
    E não integra o total de compromissos a pagar

  Cenário: CAL-012 Fechamento é marco, não dívida
    Quando um cartão fecha no mês visualizado
    Então o fechamento é identificado como marco operacional
    E não cria saída, pagamento ou despesa

  Cenário: CAL-013 Previsão de saldo usa somente valores conhecidos
    Quando existe saldo base e compromissos futuros conhecidos
    Então a previsão considera somente entradas e saídas datadas/projetáveis
    E considera faturas abertas sem repetir compras já refletidas no saldo base
    E não assume recorrências não modeladas

  Cenário: CAL-014 Compra e vencimento não duplicam despesa
    Dado um gasto associado a cartão e o vencimento de sua fatura
    Então ambos podem aparecer como fatos distintos
    Mas o total financeiro não soma a compra duas vezes

  Cenário: CAL-015 Virada de ano preserva projeções
    Quando fechamento ou vencimento atravessa dezembro e janeiro
    Então a data projetada permanece no ano correto
