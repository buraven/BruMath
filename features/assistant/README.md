# Assistente — fase UX/Chat (#41)

Referências visuais: `assets/mockups/03-home-dark-mobile.png` e os mockups de
Home/tablet. `AssistantChat` apresenta as mensagens e chama o envio já existente
em `app/page.tsx`; não implementa interpretação financeira nem armazenamento.

Enter envia; Shift+Enter insere nova linha. Sugestões iniciais usam comandos
existentes, insights aparecem na conversa e o estado permanece na página ao
trocar de aba. A posição de rolagem é restaurada; novas mensagens vão ao fim.

`ActionConfirmation` é um contrato visual reutilizável para Confirmar, Editar e
Cancelar. O chamador futuro fornecerá resumo e callbacks para gastos, entradas,
recebimentos, limites ou parcelas. Não é exibido como uma ação fictícia e ainda
não intercepta os comandos atuais: a confirmação de alterações será integrada
na fase funcional, com escopo explícito. O registro direto de gastos que já
existe permanece nesta fase visual.

Validação: lint e formatação aprovados; Chromium local em 390×844, 834×1194,
1194×834 e 1600×1000 sem overflow horizontal, composer acima da navegação,
consulta/envio por Enter, auto-scroll e retorno à aba com mensagens/posição
preservadas. Typecheck mantém somente TS2307 e TS2345 preexistentes em
`limitsService.test.ts`. Conferir preview final e teclado/Safari no iPad real.
