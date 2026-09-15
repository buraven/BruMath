# Preferências

Funcionalidade: Preferências persistem escolhas de apresentação

  Cenário: PREF-001 - Tema selecionado é aplicado
    Quando a pessoa escolhe claro, escuro ou sistema
    Então o tema é aplicado à interface

  Cenário: PREF-002 - Tema persiste no dispositivo
    Quando a página é recarregada depois de mudar o tema
    Então a escolha é restaurada

  Cenário: PREF-003 - Perfil e período não são preferências visuais
    Quando perfil ou período é alterado
    Então os dados financeiros são recalculados conforme o escopo ativo
