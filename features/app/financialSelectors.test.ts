import assert from "node:assert/strict";
import test from "node:test";
import { deriveFinancialSelectors } from "./financialSelectors";

test("derives the existing month, limit and receivable values without mixing periods", () => {
  const result = deriveFinancialSelectors({
    expenses: [
      {
        id: 1,
        title: "Mercado",
        cat: "Alimentação",
        who: "Bruna",
        amount: 100,
        date: "2026-09-02",
      },
      {
        id: 2,
        title: "Antigo",
        cat: "Alimentação",
        who: "Matheus",
        amount: 50,
        date: "2026-08-30",
      },
    ],
    installments: [
      {
        id: 1,
        title: "Notebook",
        category: "Trabalho",
        who: "Bruna",
        amount: 200,
        totalInstallments: 3,
        paidInstallments: 1,
        nextDue: "2026-09-10",
      },
    ],
    debts: [
      {
        id: 1,
        person: "João",
        amount: 300,
        paid: 100,
        destination: "bruna",
        note: "",
        month: "2026-09",
      },
    ],
    incomeEntries: [
      {
        id: 1,
        title: "Reembolso",
        amount: 50,
        who: "Bruna",
        date: "2026-09-03",
        destination: "conta",
        note: "",
      },
      {
        id: 2,
        title: "Cartão",
        amount: 70,
        who: "Bruna",
        date: "2026-09-03",
        destination: "cartao",
        note: "",
      },
    ],
    income: 1_000,
    budgets: { Alimentação: 400 },
    limits: { Bruna: 350, Matheus: 350 },
    viewMonth: "2026-09",
  });

  assert.equal(result.totalSpent, 100);
  assert.equal(result.extraIncome, 50);
  assert.equal(result.monthIncomeTotal, 1_050);
  assert.equal(result.available, 950);
  assert.equal(result.debtTotal, 200);
  assert.equal(result.remaining, 2);
  assert.deepEqual(result.limitItems, [
    { id: "Bruna", label: "Gastos de Bruna", amount: 350, spent: 100 },
    { id: "Matheus", label: "Gastos de Matheus", amount: 350, spent: 0 },
    {
      id: "category:Alimentação",
      label: "Alimentação",
      amount: 400,
      spent: 100,
    },
  ]);
});
