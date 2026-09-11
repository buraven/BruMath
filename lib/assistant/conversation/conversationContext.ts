import type { ConversationContext, PendingExpenseIntent } from "./contracts";

export function contextSummary(
  context: ConversationContext | undefined,
): string | undefined {
  if (!context) return undefined;
  if (context.pendingIntent?.kind === "register-expense") {
    const intent = context.pendingIntent;
    return [
      "Há um cadastro de gasto pendente.",
      intent.amount !== undefined
        ? `Valor já informado: ${intent.amount}.`
        : "",
      intent.description ? `Descrição: ${intent.description}.` : "",
      intent.category ? `Categoria: ${intent.category}.` : "",
      `Faltam apenas: ${intent.missingFields.join(" e ") || "nenhum campo"}.`,
      "Use a nova mensagem somente para completar ou cancelar este cadastro.",
    ]
      .filter(Boolean)
      .join(" ");
  }
  if (context.lastQuery) {
    return `A última consulta financeira foi ${context.lastQuery.toolName} com o escopo já informado. Em follow-up claramente relacionado, mantenha a consulta e o período, alterando apenas o filtro explicitamente pedido.`;
  }
  return undefined;
}

export function completeExpenseIntent(intent: PendingExpenseIntent): boolean {
  return Boolean(intent.amount && intent.description && intent.category);
}
