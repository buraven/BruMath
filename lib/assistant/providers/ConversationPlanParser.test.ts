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

test("keeps an incomplete expense as a typed clarification instead of a generic message", () => {
  assert.deepEqual(
    parseFunctionPlan("clarify_register_expense", {
      amount: 35,
      description: null,
      category: "Pets",
      owner: null,
      date: "2026-09-09",
    }),
    {
      kind: "register-expense-clarification",
      intent: {
        kind: "register-expense",
        amount: 35,
        category: "Pets",
        date: "2026-09-09",
        missingFields: ["description", "owner"],
      },
    },
  );
});

test("represents cancellation as a non-mutating typed plan", () => {
  assert.deepEqual(parseFunctionPlan("cancel_pending_intent", {}), {
    kind: "cancel-pending-intent",
  });
});
