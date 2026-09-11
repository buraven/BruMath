import assert from "node:assert/strict";
import test from "node:test";
import { parseFunctionPlan } from "./ConversationPlanParser";

test("rejects category spending without an explicit category", () => {
  assert.equal(parseFunctionPlan("getCategorySpending", {}), null);
});

test("keeps a general summary independent from category", () => {
  assert.deepEqual(parseFunctionPlan("getFinancialSummary", {}), {
    kind: "tool-call",
    toolName: "getFinancialSummary",
    input: {},
  });
});

test("accepts category spending only with an explicit category", () => {
  assert.deepEqual(
    parseFunctionPlan("getCategorySpending", { category: "Alimentação" }),
    {
      kind: "tool-call",
      toolName: "getCategorySpending",
      input: { category: "Alimentação" },
    },
  );
});
