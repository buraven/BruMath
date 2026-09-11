import assert from "node:assert/strict";
import test from "node:test";
import type { ConversationPlan } from "./contracts";
import {
  deduplicateToolCalls,
  isWithinToolBudget,
  MAX_ASSISTANT_TOOL_CALLS,
  type PlannedToolCall,
  toolBudgetUserMessage,
} from "./toolPlanning";

const defaults = { activeProfile: "Bruna" as const, selectedMonth: "2026-09" };

function calls(...items: PlannedToolCall[]) {
  return items;
}

test("reuses an already planned deterministic query with the same effective scope", () => {
  const plan = deduplicateToolCalls(
    calls(
      { kind: "tool-call", toolName: "getFinancialSummary", input: {} },
      {
        kind: "tool-call",
        toolName: "getFinancialSummary",
        input: { profile: "Bruna", month: "2026-09" },
      },
      { kind: "tool-call", toolName: "getLimits", input: {} },
    ),
    defaults,
  );

  assert.equal(plan.duplicatesRemoved, 1);
  assert.deepEqual(
    plan.calls.map((call) => call.toolName),
    ["getFinancialSummary", "getLimits"],
  );
});

test("a general insight plan fits the protected tool budget", () => {
  const insightPlan = calls(
    { kind: "tool-call", toolName: "getFinancialSummary", input: {} },
    { kind: "tool-call", toolName: "getLimits", input: {} },
    { kind: "tool-call", toolName: "getInstallments", input: {} },
    { kind: "tool-call", toolName: "getReceivables", input: {} },
  );

  assert.equal(isWithinToolBudget(insightPlan), true);
});

test("an abnormal plan remains blocked without exposing a technical error", () => {
  const excessive = calls(
    { kind: "tool-call", toolName: "getFinancialSummary", input: {} },
    { kind: "tool-call", toolName: "getLimits", input: {} },
    { kind: "tool-call", toolName: "getInstallments", input: {} },
    { kind: "tool-call", toolName: "getReceivables", input: {} },
    { kind: "tool-call", toolName: "getExpenses", input: {} },
    { kind: "tool-call", toolName: "getExtraIncome", input: {} },
  );

  assert.equal(excessive.length, MAX_ASSISTANT_TOOL_CALLS + 1);
  assert.equal(isWithinToolBudget(excessive), false);
  assert.doesNotMatch(toolBudgetUserMessage, /consulta.*demais/i);
});
