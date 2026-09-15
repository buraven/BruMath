# Faturas e cartões

Funcionalidade: Cartões e faturas derivadas de gastos reais

  Cenário: FAT-001 - Criar e persistir um cartão
    Quando a pessoa cadastra um cartão com titular, limite, fechamento e vencimento válidos
    Então o cartão é persistido como uma configuração independente
    E permanece visível após recarregar a aplicação

  Cenário: FAT-002 - Cartão sem compras continua visível
    Dado um cartão sem gastos associados
    Quando a pessoa abre Faturas
    Então o cartão e seu ciclo atual são exibidos com valor R$ 0,00
    E a ausência de compras não remove o cartão

  Esquema do Cenário: FAT-003 - O fechamento determina a competência da fatura
    Dado um cartão com fechamento no dia 20
    Quando uma compra é registrada no dia <dia>
    Então a competência da fatura é <competencia>

    Exemplos:
      | dia | competencia |
      | 20  | mês atual   |
      | 21  | mês seguinte |

  Cenário: FAT-004 - Ciclo zerado não é uma dívida
    Dado um ciclo de cartão sem lançamentos
    Então seu estado é "Em andamento"
    E ele pode aparecer no filtro Todas
    Mas não aparece em Abertas nem A vencer
    E não aumenta Total a pagar, a quantidade de faturas abertas ou o próximo vencimento
    E não oferece pagamento

  Cenário: FAT-005 - Fatura com saldo é aberta e a pagar
    Dado uma fatura não paga com total maior que zero
    Então ela tem estado aberta
    E participa de Total a pagar, da contagem de faturas abertas e do filtro Abertas

  Cenário: FAT-006 - Fatura paga não duplica compras
    Dado uma fatura aberta com total maior que zero
    Quando a pessoa confirma seu pagamento total
    Então seu estado passa a pago
    E Total a pagar é atualizado
    E Total pago é atualizado
    E as compras originais continuam existindo uma única vez

  Cenário: FAT-007 - A fatura agrega Expense sem criar item financeiro paralelo
    Dado um gasto associado a um cartão
    Quando a fatura do ciclo é consultada
    Então ela contém esse gasto uma única vez
    E o gasto preserva categoria, responsável e bucket pessoal
    E o total geral de gastos não é duplicado

  Cenário: FAT-008 - Editar data ou cartão move a projeção
    Dado uma compra vinculada a uma fatura
    Quando a pessoa altera sua data ou cartão
    Então a compra sai da fatura anterior
    E aparece na fatura determinada pelos novos dados
    E não é criada uma segunda despesa

  Cenário: FAT-009 - Excluir compra atualiza a fatura
    Dado uma fatura cuja única compra é vinculada a um cartão
    Quando a exclusão é confirmada
    Então a compra deixa de aparecer na fatura
    E o ciclo volta a Em andamento quando seu total chega a zero

  Cenário: FAT-010 - Limite de crédito é independente dos outros limites
    Dado uma compra de cartão de R$ 100,00 em um cartão com limite de R$ 1.000,00
    Então o limite usado é R$ 100,00
    E o limite disponível é R$ 900,00
    E limites de categoria e pessoais não são reinterpretados como limite de crédito

  Cenário: FAT-011 - Perfil consolidado mostra cartões sem criar cartão fictício
    Dado cartões individuais de Bruna e Matheus
    Quando o perfil Casal é selecionado
    Então os cartões elegíveis são mostrados separadamente
    E nenhum cartão consolidado artificial é criado

  Cenário: FAT-012 - Parcelas aparecem no ciclo correto
    Dado um parcelamento associado a um cartão
    Então cada parcela integra somente a fatura do seu próprio ciclo
    E Futuro, quitar e adiantar continuam usando o parcelamento original

  Cenário: FAT-013 - O detalhe da fatura reutiliza o fluxo de gastos
    Quando a pessoa usa "Adicionar compra" no detalhe de uma fatura
    Então o formulário de gasto é aberto com o cartão pré-selecionado
    E a pessoa ainda informa descrição, valor, data, categoria e responsável
    E a compra aparece imediatamente no detalhe após salvar
