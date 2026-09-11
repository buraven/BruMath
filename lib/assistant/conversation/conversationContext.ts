import type { ConversationContext, PendingExpenseIntent } from "./contracts";

export type PendingExpenseResolution =
  | { kind: "cancelled" }
  | { kind: "clarifying"; intent: PendingExpenseIntent; question: string }
  | { kind: "complete"; intent: CompletedExpenseIntent };

export type CompletedExpenseIntent = PendingExpenseIntent & {
  amount: number;
  description: string;
  category: string;
};

function normalize(value: string) {
  return value
    .trim()
    .toLocaleLowerCase("pt-BR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

const semanticCategories: Readonly<Record<string, string>> = {
  mercado: "Alimentação",
  supermercado: "Alimentação",
  alimentacao: "Alimentação",
  pet: "Pets",
  pets: "Pets",
  gato: "Pets",
  gatos: "Pets",
};

function resolveCategory(value: string, categories: readonly string[]) {
  const normalized = normalize(value);
  const exactCategory = categories.find(
    (category) => normalize(category) === normalized,
  );
  if (exactCategory) return exactCategory;

  const semanticCategory = semanticCategories[normalized];
  return categories.find((category) => category === semanticCategory);
}

function questionFor(intent: PendingExpenseIntent) {
  if (intent.missingFields.includes("category")) {
    return intent.missingFields.includes("description")
      ? "Qual foi a descrição e a categoria desse gasto?"
      : "Qual foi a categoria desse gasto?";
  }
  return "Qual foi a descrição desse gasto?";
}

export function resolvePendingExpenseReply(
  pending: PendingExpenseIntent,
  reply: string,
  categories: readonly string[],
): PendingExpenseResolution {
  const value = reply.trim();
  if (
    ["cancela", "cancelar", "deixa", "esquece", "não quero mais"].includes(
      normalize(value),
    )
  ) {
    return { kind: "cancelled" };
  }
  const category = pending.category ?? resolveCategory(value, categories);
  const description =
    pending.description ?? (category ? undefined : value || undefined);
  const missingFields = [
    ...(description ? [] : (["description"] as const)),
    ...(category ? [] : (["category"] as const)),
  ];
  const intent: PendingExpenseIntent = {
    ...pending,
    ...(description ? { description } : {}),
    ...(category ? { category } : {}),
    missingFields,
  };
  if (completeExpenseIntent(intent)) {
    return { kind: "complete", intent: intent as CompletedExpenseIntent };
  }
  if (
    pending.missingFields.includes("category") &&
    pending.description &&
    !category
  ) {
    return {
      kind: "clarifying",
      intent: pending,
      question: `${value || "Esse valor"} não é uma categoria cadastrada. Informe uma das categorias disponíveis.`,
    };
  }
  return { kind: "clarifying", intent, question: questionFor(intent) };
}

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
