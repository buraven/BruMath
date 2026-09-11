import type { AssistantProfile } from "../contracts";
import type {
  ConversationPlan,
  ConversationToolInput,
  RegisterExpensePlan,
} from "../conversation/contracts";
import type { FinancialToolName } from "../tools/financialTools";

export const financialToolNames = [
  "getFinancialSummary",
  "getExpenses",
  "getExpenseRanking",
  "getCategorySpending",
  "getAvailableBalance",
  "getLimits",
  "getInstallments",
  "getReceivables",
  "getExtraIncome",
] as const satisfies readonly FinancialToolName[];

export const profiles = ["Bruna", "Matheus", "Casal"] as const;

export function isProfile(value: unknown): value is AssistantProfile {
  return profiles.includes(value as AssistantProfile);
}

export function parseToolInput(value: unknown): ConversationToolInput | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  return {
    ...(isProfile(input.profile) ? { profile: input.profile } : {}),
    ...(typeof input.month === "string" && /^\d{4}-\d{2}$/.test(input.month)
      ? { month: input.month }
      : {}),
    ...(typeof input.category === "string" && input.category.trim()
      ? { category: input.category.trim() }
      : {}),
    ...(typeof input.dueInSelectedMonth === "boolean"
      ? { dueInSelectedMonth: input.dueInSelectedMonth }
      : {}),
  };
}

export function parseRegisterExpense(
  value: unknown,
): RegisterExpensePlan | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  if (
    typeof input.description !== "string" ||
    !input.description.trim() ||
    typeof input.amount !== "number" ||
    !Number.isFinite(input.amount) ||
    input.amount <= 0 ||
    typeof input.category !== "string" ||
    !input.category.trim()
  )
    return null;
  return {
    description: input.description.trim(),
    amount: input.amount,
    category: input.category.trim(),
    ...(isProfile(input.owner) ? { owner: input.owner } : {}),
    ...(typeof input.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(input.date)
      ? { date: input.date }
      : {}),
  };
}

function parseExpenseClarification(value: unknown): ConversationPlan | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  const amount =
    typeof input.amount === "number" &&
    Number.isFinite(input.amount) &&
    input.amount > 0
      ? input.amount
      : undefined;
  const description =
    typeof input.description === "string" && input.description.trim()
      ? input.description.trim()
      : undefined;
  const category =
    typeof input.category === "string" && input.category.trim()
      ? input.category.trim()
      : undefined;
  const missingFields = [
    ...(description ? [] : (["description"] as const)),
    ...(category ? [] : (["category"] as const)),
  ];
  if (missingFields.length === 0) return null;
  return {
    kind: "register-expense-clarification",
    intent: {
      kind: "register-expense",
      ...(amount !== undefined ? { amount } : {}),
      ...(description ? { description } : {}),
      ...(category ? { category } : {}),
      missingFields,
    },
  };
}

export function parseFunctionPlan(
  name: string,
  value: unknown,
): ConversationPlan | null {
  if ((financialToolNames as readonly string[]).includes(name)) {
    const input = parseToolInput(value);
    if (name === "getCategorySpending" && !input?.category) return null;
    return input
      ? { kind: "tool-call", toolName: name as FinancialToolName, input }
      : null;
  }
  if (name === "propose_register_expense") {
    const input = parseRegisterExpense(value);
    return input ? { kind: "register-expense", input } : null;
  }
  if (name === "clarify_register_expense")
    return parseExpenseClarification(value);
  if (name === "cancel_pending_intent")
    return { kind: "cancel-pending-intent" };
  return null;
}
