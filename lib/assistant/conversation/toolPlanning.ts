import type { AssistantProfile } from "../contracts";
import type { ConversationPlan, ConversationToolInput } from "./contracts";

export const MAX_ASSISTANT_TOOL_CALLS = 5;

export type PlannedToolCall =
  | Extract<ConversationPlan, { kind: "tool-call" }>
  | Extract<ConversationPlan, { kind: "tool-calls" }>["calls"][number];

type ToolCall = Pick<PlannedToolCall, "toolName" | "input">;

type ToolDefaults = {
  activeProfile: AssistantProfile;
  selectedMonth: string;
};

function normalizedInput(input: ConversationToolInput, defaults: ToolDefaults) {
  return {
    profile: input.profile ?? defaults.activeProfile,
    month: input.month ?? defaults.selectedMonth,
    category: input.category?.trim().toLocaleLowerCase("pt-BR") ?? null,
    dueInSelectedMonth: input.dueInSelectedMonth ?? null,
  };
}

/**
 * Identical queries represent the same deterministic fact for one request.
 * Defaulted and explicitly supplied scope are normalized to the same key.
 */
export function toolCallKey(call: ToolCall, defaults: ToolDefaults): string {
  return `${call.toolName}:${JSON.stringify(normalizedInput(call.input, defaults))}`;
}

export function deduplicateToolCalls<T extends ToolCall>(
  calls: readonly T[],
  defaults: ToolDefaults,
): { calls: readonly T[]; duplicatesRemoved: number } {
  const seen = new Set<string>();
  const unique = calls.filter((call) => {
    const key = toolCallKey(call, defaults);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return { calls: unique, duplicatesRemoved: calls.length - unique.length };
}

export function isWithinToolBudget(calls: readonly ToolCall[]) {
  return calls.length <= MAX_ASSISTANT_TOOL_CALLS;
}

export const toolBudgetUserMessage =
  "Não consegui concluir essa análise agora. Tente novamente.";
