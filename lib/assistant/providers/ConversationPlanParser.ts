import type { AssistantProfile } from "../contracts";
import type {
  ConversationPlan,
  ConversationToolInput,
  RegisterExpensePlan,
} from "../conversation/contracts";
import type { FinancialToolName } from "../tools/financialTools";
import { isPersonalLimitBucket } from "../../finance/personalLimits";

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

function hasOnlyKeys(value: Record<string, unknown>, keys: readonly string[]) {
  return Object.keys(value).every((key) => keys.includes(key));
}

function isValidMonth(value: string) {
  const match = /^(\d{4})-(\d{2})$/.exec(value);
  return Boolean(match && Number(match[2]) >= 1 && Number(match[2]) <= 12);
}

function isValidDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const [year, month, day] = match.slice(1).map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function isOptionalNullOr<T>(
  value: unknown,
  predicate: (candidate: unknown) => candidate is T,
): boolean {
  return value === undefined || value === null || predicate(value);
}

function isOptionalCategory(value: unknown): boolean {
  return (
    value === undefined ||
    value === null ||
    (typeof value === "string" && Boolean(value.trim()))
  );
}

export function parseToolInput(value: unknown): ConversationToolInput | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  if (
    !hasOnlyKeys(input, [
      "profile",
      "month",
      "category",
      "dueInSelectedMonth",
    ]) ||
    !isOptionalNullOr(input.profile, isProfile) ||
    !isOptionalNullOr(
      input.month,
      (candidate): candidate is string =>
        typeof candidate === "string" && isValidMonth(candidate),
    ) ||
    !isOptionalCategory(input.category) ||
    !isOptionalNullOr(
      input.dueInSelectedMonth,
      (candidate): candidate is boolean => typeof candidate === "boolean",
    )
  ) {
    return null;
  }
  return {
    ...(isProfile(input.profile) ? { profile: input.profile } : {}),
    ...(typeof input.month === "string" && isValidMonth(input.month)
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
    !hasOnlyKeys(input, [
      "description",
      "amount",
      "category",
      "owner",
      "date",
      "personalLimitBucket",
    ]) ||
    typeof input.description !== "string" ||
    !input.description.trim() ||
    typeof input.amount !== "number" ||
    !Number.isFinite(input.amount) ||
    input.amount <= 0 ||
    typeof input.category !== "string" ||
    !input.category.trim() ||
    !isOptionalNullOr(input.owner, isProfile) ||
    !isOptionalNullOr(input.personalLimitBucket, isPersonalLimitBucket) ||
    !isOptionalNullOr(
      input.date,
      (candidate): candidate is string =>
        typeof candidate === "string" && isValidDate(candidate),
    )
  )
    return null;
  return {
    description: input.description.trim(),
    amount: input.amount,
    category: input.category.trim(),
    ...(isProfile(input.owner) ? { owner: input.owner } : {}),
    ...(isPersonalLimitBucket(input.personalLimitBucket)
      ? { personalLimitBucket: input.personalLimitBucket }
      : {}),
    ...(typeof input.date === "string" && isValidDate(input.date)
      ? { date: input.date }
      : {}),
  };
}

function parseExpenseClarification(value: unknown): ConversationPlan | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  if (
    !hasOnlyKeys(input, [
      "amount",
      "description",
      "category",
      "owner",
      "date",
      "personalLimitBucket",
    ]) ||
    !isOptionalNullOr(
      input.amount,
      (candidate): candidate is number =>
        typeof candidate === "number" &&
        Number.isFinite(candidate) &&
        candidate > 0,
    ) ||
    !isOptionalCategory(input.description) ||
    !isOptionalCategory(input.category) ||
    !isOptionalNullOr(input.owner, isProfile) ||
    !isOptionalNullOr(input.personalLimitBucket, isPersonalLimitBucket) ||
    !isOptionalNullOr(
      input.date,
      (candidate): candidate is string =>
        typeof candidate === "string" && isValidDate(candidate),
    )
  ) {
    return null;
  }
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
  const owner = isProfile(input.owner) ? input.owner : undefined;
  const personalLimitBucket = isPersonalLimitBucket(input.personalLimitBucket)
    ? input.personalLimitBucket
    : undefined;
  const date =
    typeof input.date === "string" && isValidDate(input.date)
      ? input.date
      : undefined;
  const missingFields = [
    ...(description ? [] : (["description"] as const)),
    ...(category ? [] : (["category"] as const)),
    ...(owner ? [] : (["owner"] as const)),
  ];
  if (missingFields.length === 0) return null;
  return {
    kind: "register-expense-clarification",
    intent: {
      kind: "register-expense",
      ...(amount !== undefined ? { amount } : {}),
      ...(description ? { description } : {}),
      ...(category ? { category } : {}),
      ...(owner ? { owner } : {}),
      ...(personalLimitBucket ? { personalLimitBucket } : {}),
      ...(date ? { date } : {}),
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
  if (
    name === "cancel_pending_intent" &&
    value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    hasOnlyKeys(value as Record<string, unknown>, [])
  )
    return { kind: "cancel-pending-intent" };
  return null;
}
