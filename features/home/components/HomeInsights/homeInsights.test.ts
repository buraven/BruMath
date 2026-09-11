import assert from "node:assert/strict";
import test from "node:test";
import { deriveHomeInsights } from "./radarInsights";

const formatMoney = (value: number) => `R$ ${value.toFixed(2)}`;

test("derives a single deterministic installment insight without inventing others", () => {
  const insights = deriveHomeInsights({
    limitItems: [],
    remainingInstallments: 4,
    activeInstallmentCount: 2,
    receivableTotal: 0,
    formatMoney,
  });

  assert.deepEqual(insights, [
    {
      id: "installments",
      title: "4 parcelas restantes",
      detail: "2 compromissos ativos.",
      tone: "info",
    },
  ]);
});

test("renders multiple supported signals in deterministic priority order", () => {
  const insights = deriveHomeInsights({
    limitItems: [
      {
        id: "category:Alimentação",
        label: "Alimentação",
        amount: 100,
        spent: 90,
      },
    ],
    remainingInstallments: 2,
    activeInstallmentCount: 1,
    receivableTotal: 50,
    formatMoney,
  });

  assert.deepEqual(
    insights.map((insight) => insight.id),
    ["limit", "installments", "receivable"],
  );
});

test("uses the supported empty state when the data has no Home signal", () => {
  const insights = deriveHomeInsights({
    limitItems: [],
    remainingInstallments: 0,
    activeInstallmentCount: 0,
    receivableTotal: 0,
    formatMoney,
  });

  assert.equal(insights[0]?.id, "empty");
});
