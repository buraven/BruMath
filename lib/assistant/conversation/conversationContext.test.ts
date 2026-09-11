import assert from "node:assert/strict";
import test from "node:test";
import { contextSummary, completeExpenseIntent } from "./conversationContext";

test("keeps a typed pending expense until its missing fields are complete", () => {
  const intent = {
    kind: "register-expense" as const,
    amount: 35,
    category: "Pets",
    missingFields: ["description"] as const,
  };

  assert.equal(completeExpenseIntent(intent), false);
  assert.match(contextSummary({ pendingIntent: intent }) ?? "", /35/);
  assert.match(contextSummary({ pendingIntent: intent }) ?? "", /description/);
});

test("preserves the last deterministic query for a scoped follow-up", () => {
  const summary = contextSummary({
    lastQuery: {
      toolName: "getFinancialSummary",
      input: { profile: "Bruna", month: "2026-08" },
    },
  });

  assert.match(summary ?? "", /getFinancialSummary/);
  assert.match(summary ?? "", /período/i);
});
