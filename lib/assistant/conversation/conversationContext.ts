import type { AssistantProfile } from "../contracts";
import type {
  ConversationContext,
  PendingExpenseIntent,
  RegisterExpensePlan,
} from "./contracts";

export type PendingExpenseResolution =
  | { kind: "cancelled" }
  | { kind: "clarifying"; intent: PendingExpenseIntent; question: string }
  | { kind: "complete"; intent: CompletedExpenseIntent };

export type CompletedExpenseIntent = PendingExpenseIntent & {
  amount: number;
  description: string;
  category: string;
  owner: AssistantProfile;
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

function resolveOwner(value: string): AssistantProfile | undefined {
  const normalized = normalize(value);
  if (normalized === "bruna") return "Bruna";
  if (normalized === "matheus") return "Matheus";
  if (normalized === "casal" || normalized === "como casal") return "Casal";
  return undefined;
}

function isCategoryHelpQuestion(value: string) {
  return [
    "quais categorias",
    "quais opcoes",
    "o que tem",
    "quais sao as categorias",
  ].includes(normalize(value).replace(/[?!.]/g, ""));
}

export function pendingExpenseQuestion(intent: PendingExpenseIntent) {
  if (intent.missingFields.includes("description")) {
    return intent.missingFields.includes("category")
      ? "Qual foi a descrição e a categoria desse gasto?"
      : "Qual foi a descrição desse gasto?";
  }
  if (intent.missingFields.includes("category")) {
    return "Qual foi a categoria desse gasto?";
  }
  return "Esse gasto é da Bruna, do Matheus ou do Casal?";
}

export function createPendingExpenseIntent(
  input: Partial<RegisterExpensePlan> & Pick<RegisterExpensePlan, "amount">,
): PendingExpenseIntent {
  const missingFields = [
    ...(input.description ? [] : (["description"] as const)),
    ...(input.category ? [] : (["category"] as const)),
    ...(input.owner ? [] : (["owner"] as const)),
  ];
  return {
    kind: "register-expense",
    amount: input.amount,
    ...(input.description ? { description: input.description } : {}),
    ...(input.category ? { category: input.category } : {}),
    ...(input.owner ? { owner: input.owner } : {}),
    ...(input.date ? { date: input.date } : {}),
    missingFields,
  };
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
  if (
    pending.missingFields.includes("category") &&
    isCategoryHelpQuestion(value)
  ) {
    return {
      kind: "clarifying",
      intent: pending,
      question: `As categorias disponíveis são: ${categories.join(", ")}. Qual você quer usar?`,
    };
  }

  const needsDescription = pending.missingFields.includes("description");
  const needsCategory = pending.missingFields.includes("category");
  const needsOwner = pending.missingFields.includes("owner");
  const resolvedCategory = needsCategory
    ? resolveCategory(value, categories)
    : undefined;
  const resolvedOwner = needsOwner ? resolveOwner(value) : undefined;
  const category = pending.category ?? resolvedCategory;
  const owner = pending.owner ?? resolvedOwner;
  const description =
    pending.description ??
    (needsDescription && !resolvedCategory && !resolvedOwner
      ? value || undefined
      : undefined);
  const missingFields = [
    ...(description ? [] : (["description"] as const)),
    ...(category ? [] : (["category"] as const)),
    ...(owner ? [] : (["owner"] as const)),
  ];
  const intent: PendingExpenseIntent = {
    ...pending,
    ...(description ? { description } : {}),
    ...(category ? { category } : {}),
    ...(owner ? { owner } : {}),
    missingFields,
  };
  if (completeExpenseIntent(intent)) {
    return { kind: "complete", intent: intent as CompletedExpenseIntent };
  }
  if (needsCategory && !needsDescription && !category) {
    return {
      kind: "clarifying",
      intent: pending,
      question: `${value || "Esse valor"} não é uma categoria cadastrada. Informe uma das categorias disponíveis.`,
    };
  }
  return {
    kind: "clarifying",
    intent,
    question: pendingExpenseQuestion(intent),
  };
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

export function completeExpenseIntent(
  intent: PendingExpenseIntent,
): intent is CompletedExpenseIntent {
  return Boolean(
    intent.amount && intent.description && intent.category && intent.owner,
  );
}
