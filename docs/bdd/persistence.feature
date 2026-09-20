# Persistência centralizada

Funcionalidade: Persistência financeira centralizada segura

  Cenário: PST-001 - Preview local não altera dados
    Quando a pessoa visualiza a migração do brumath-data
    Então o snapshot local permanece inalterado

  Cenário: PST-002 - Importação é idempotente
    Quando o mesmo snapshot local é importado duas vezes
    Então os registros financeiros não são duplicados

  Cenário: PST-003 - Migração só é marcada após reconciliação
    Quando a importação termina
    Então a marca de importação só é persistida após a reconciliação completa

  Cenário: PST-004 - Falha remota não cria fallback silencioso
    Quando a persistência centralizada falha
    Então o BruMath informa o erro sem escrever uma segunda fonte automaticamente

  Cenário: PST-005 - Dados financeiros exigem identidade autenticada
    Quando não existe sessão autenticada
    Então nenhuma leitura ou escrita financeira centralizada é autorizada

  Cenário: PST-006 - Fonte remota ativa não volta ao armazenamento local
    Dado que a migração local foi reconciliada com sucesso
    Quando uma gravação remota falha
    Então o BruMath informa o erro sem sobrescrever o brumath-data local

  Cenário: PST-007 - Sessão pendente não expõe dados financeiros
    Dado que o Supabase está configurado
    Quando a sessão está ausente ou sendo restaurada
    Então somente o gate de autenticação é renderizado

  Cenário: PST-008 - Magic Link não cria contas pelo app
    Quando uma pessoa solicita um Magic Link
    Então o BruMath solicita acesso sem permitir criação automática de usuário

  Cenário: PST-009 - Logout aguarda gravações remotas pendentes
    Dado que existe uma alteração financeira ainda sendo salva remotamente
    Quando a pessoa tenta sair do BruMath
    Então o logout só é concluído depois que a gravação remota for confirmada

  Cenário: PST-010 - Snapshot local já importado não repete a migração
    Dado que o mesmo brumath-data preservado já foi importado e reconciliado
    Quando a pessoa inicia uma nova sessão autenticada
    Então o BruMath ativa a fonte remota sem oferecer uma nova migração
