import assert from "node:assert/strict";
import test from "node:test";
import {
  contextSummary,
  completeExpenseIntent,
  createPendingExpenseIntent,
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
      missingFields: ["description", "category", "owner"],
    },
    "Pets",
    ["Pets", "Alimentação"],
  );
  assert.equal(first.kind, "clarifying");
  if (first.kind !== "clarifying") return;
  assert.equal(first.intent.category, "Pets");
  assert.deepEqual(first.intent.missingFields, ["description", "owner"]);

  const second = resolvePendingExpenseReply(first.intent, "Areia dos gatos", [
    "Pets",
    "Alimentação",
  ]);
  assert.equal(second.kind, "clarifying");
  if (second.kind !== "clarifying") return;
  assert.equal(second.intent.description, "Areia dos gatos");
  assert.deepEqual(second.intent.missingFields, ["owner"]);

  const third = resolvePendingExpenseReply(second.intent, "Casal", [
    "Pets",
    "Alimentação",
  ]);
  assert.equal(third.kind, "complete");
  if (third.kind !== "complete") return;
  assert.equal(third.intent.amount, 35);
  assert.equal(third.intent.category, "Pets");
  assert.equal(third.intent.description, "Areia dos gatos");
  assert.equal(third.intent.owner, "Casal");
});

test("uses an exact category or a safe catalog alias without looping", () => {
  const pending = {
    kind: "register-expense" as const,
    amount: 100,
    description: "Mercado",
    owner: "Casal" as const,
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
      owner: "Casal",
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
      owner: "Casal",
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
      owner: "Casal",
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

test("lists configured categories as help without discarding the pending expense", () => {
  const pending = {
    kind: "register-expense" as const,
    amount: 100,
    description: "Mercado",
    owner: "Casal" as const,
    missingFields: ["category"] as const,
  };
  const result = resolvePendingExpenseReply(pending, "Quais categorias?", [
    "Alimentação",
    "Pets",
  ]);

  assert.equal(result.kind, "clarifying");
  if (result.kind !== "clarifying") return;
  assert.equal(result.intent, pending);
  assert.match(result.question, /Alimentação/);
  assert.match(result.question, /Pets/);
});

test("requires an explicit responsible party before completing a mutation", () => {
  const result = resolvePendingExpenseReply(
    {
      kind: "register-expense",
      amount: 50,
      description: "Ração",
      category: "Pets",
      missingFields: ["owner"],
    },
    "Casal",
    ["Pets"],
  );

  assert.equal(result.kind, "complete");
  if (result.kind !== "complete") return;
  assert.equal(result.intent.owner, "Casal");
});

test("keeps an explicit date while waiting for the responsible party", () => {
  const pending = createPendingExpenseIntent({
    amount: 100,
    description: "Mercado",
    category: "Alimentação",
    date: "2026-09-09",
  });

  assert.deepEqual(pending.missingFields, ["owner"]);
  assert.equal(pending.date, "2026-09-09");
  assert.equal(completeExpenseIntent(pending), false);
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
