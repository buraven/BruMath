import assert from "node:assert/strict";
import test from "node:test";
import {
  contextSummary,
  completeExpenseIntent,
  resolvePendingExpenseReply,
} from "./conversationContext";

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

test("consumes category then description and completes the same pending expense", () => {
  const first = resolvePendingExpenseReply(
    {
      kind: "register-expense",
      amount: 35,
      missingFields: ["description", "category"],
    },
    "Pets",
    ["Pets", "Alimentação"],
  );
  assert.equal(first.kind, "clarifying");
  if (first.kind !== "clarifying") return;
  assert.equal(first.intent.category, "Pets");
  assert.deepEqual(first.intent.missingFields, ["description"]);

  const second = resolvePendingExpenseReply(first.intent, "Areia dos gatos", [
    "Pets",
    "Alimentação",
  ]);
  assert.equal(second.kind, "complete");
  if (second.kind !== "complete") return;
  assert.equal(second.intent.amount, 35);
  assert.equal(second.intent.category, "Pets");
  assert.equal(second.intent.description, "Areia dos gatos");
});

test("uses an exact category or a safe catalog alias without looping", () => {
  const pending = {
    kind: "register-expense" as const,
    amount: 100,
    description: "Mercado",
    missingFields: ["category"] as const,
  };
  const resolved = resolvePendingExpenseReply(pending, "Mercado", [
    "Alimentação",
    "Pets",
  ]);
  assert.equal(resolved.kind, "complete");
  if (resolved.kind !== "complete") return;
  assert.equal(resolved.intent.category, "Alimentação");
});

test("keeps a description when both fields are pending, then asks only for category", () => {
  const resolved = resolvePendingExpenseReply(
    {
      kind: "register-expense",
      amount: 100,
      missingFields: ["description", "category"],
    },
    "Compras da feira",
    ["Alimentação", "Pets"],
  );

  assert.equal(resolved.kind, "clarifying");
  if (resolved.kind !== "clarifying") return;
  assert.equal(resolved.intent.description, "Compras da feira");
  assert.deepEqual(resolved.intent.missingFields, ["category"]);
});

test("only resolves a semantic category when it exists in the configured catalog", () => {
  const resolved = resolvePendingExpenseReply(
    {
      kind: "register-expense",
      amount: 100,
      description: "Mercado",
      missingFields: ["category"],
    },
    "Mercado",
    ["Pets"],
  );

  assert.equal(resolved.kind, "clarifying");
  if (resolved.kind !== "clarifying") return;
  assert.match(resolved.question, /não é uma categoria cadastrada/i);
});

test("keeps the pending data and asks specifically when the category is invalid", () => {
  const result = resolvePendingExpenseReply(
    {
      kind: "register-expense",
      amount: 100,
      description: "Mercado",
      missingFields: ["category"],
    },
    "Qualquer coisa",
    ["Alimentação", "Pets"],
  );
  assert.equal(result.kind, "clarifying");
  if (result.kind !== "clarifying") return;
  assert.equal(result.intent.description, "Mercado");
  assert.match(result.question, /não é uma categoria cadastrada/i);
});

test("cancels a pending expense before any proposal can exist", () => {
  assert.deepEqual(
    resolvePendingExpenseReply(
      { kind: "register-expense", amount: 40, missingFields: ["category"] },
      "Cancela",
      ["Pets"],
    ),
    { kind: "cancelled" },
  );
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
