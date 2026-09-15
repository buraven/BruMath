# Regras transversais

Funcionalidade: Integridade entre features

  Cenário: TRN-001 - Persistência sobrevive ao reload
    Quando uma mutação válida é salva
    Então o estado é restaurado após recarregar a página

  Cenário: TRN-002 - Dados antigos continuam compatíveis
    Dado um snapshot legado sem campos recentes opcionais
    Quando ele é carregado
    Então o BruMath preserva seus dados e aplica defaults compatíveis

  Cenário: TRN-003 - Edição recalcula todas as projeções afetadas
    Quando uma despesa é editada
    Então totais, categorias, limites e faturas derivadas são atualizados conforme aplicável

  Cenário: TRN-004 - Exclusão remove projeções afetadas
    Quando uma despesa é excluída com confirmação
    Então ela deixa de participar de todas as projeções derivadas

  Cenário: TRN-005 - Nenhuma projeção duplica uma despesa
    Quando uma despesa participa de categoria, bucket pessoal, cartão ou parcela
    Então o total geral do período continua contando-a uma única vez
