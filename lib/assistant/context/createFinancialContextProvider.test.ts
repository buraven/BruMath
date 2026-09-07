import assert from "node:assert/strict";
import test from "node:test";
import type { FinancialDataSnapshot } from "./FinancialDataSource";
import { createFinancialContextProvider } from "./createFinancialContextProvider";

const snapshot: FinancialDataSnapshot = {
  income: 1000,
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
      title: "Combustível",
      cat: "Carro",
      who: "Matheus",
      amount: 200,
      date: "2026-09-03",
    },
    {
      id: 3,
      title: "Condomínio",
      cat: "Casa",
      who: "Casal",
      amount: 300,
      date: "2026-09-04",
    },
    {
      id: 4,
      title: "Agosto",
      cat: "Casa",
      who: "Bruna",
      amount: 999,
      date: "2026-08-01",
    },
  ],
  incomeEntries: [
    {
      id: 1,
      title: "Freela",
      amount: 50,
      who: "Bruna",
      date: "2026-09-05",
      destination: "conta",
      note: "",
    },
    {
      id: 2,
      title: "Reembolso",
      amount: 25,
      who: "Matheus",
      date: "2026-09-06",
      destination: "cartao",
      note: "",
    },
    {
      id: 3,
      title: "Agosto",
      amount: 500,
      who: "Bruna",
      date: "2026-08-01",
      destination: "conta",
      note: "",
    },
  ],
  debts: [
    {
      id: 1,
      person: "Ana",
      amount: 200,
      paid: 50,
      destination: "bruna",
      note: "",
      month: "2026-09",
    },
    {
      id: 2,
      person: "Beto",
      amount: 100,
      paid: 100,
      destination: "matheus",
      note: "",
      month: "2026-09",
      receivedMonth: "2026-09",
    },
    {
      id: 3,
      person: "Caio",
      amount: 80,
      paid: 0,
      destination: "cartao",
      note: "",
      month: "2026-10",
    },
  ],
  installments: [
    {
      id: 1,
      title: "Carro",
      category: "Carro",
      who: "Casal",
      amount: 250,
      totalInstallments: 10,
      paidInstallments: 2,
      nextDue: "2026-09-10",
    },
    {
      id: 2,
      title: "Curso",
      category: "Pessoal",
      who: "Bruna",
      amount: 75,
      totalInstallments: 4,
      paidInstallments: 1,
      nextDue: "2026-10-10",
    },
    {
      id: 3,
      title: "Encerrada",
      category: "Casa",
      who: "Matheus",
      amount: 60,
      totalInstallments: 2,
      paidInstallments: 2,
      nextDue: "2026-09-10",
    },
  ],
  budgets: { Casa: 500, Carro: 400, Alimentação: 300 },
  limits: { Bruna: 350, Matheus: 450 },
};

const provider = createFinancialContextProvider({ read: async () => snapshot });

test("builds a deterministic household context for a month", async () => {
  const context = await provider.getContext({
    profile: "Casal",
    month: "2026-09",
  });

  assert.deepEqual(context.value.summary, {
    baseIncome: 1000,
    extraIncome: 50,
    expenses: 600,
    available: 450,
    receivablesOutstanding: 150,
  });
  assert.equal(context.value.expenses.length, 3);
  assert.equal(context.value.income.length, 2);
  assert.equal(context.value.installments.length, 2);
  assert.equal(context.value.installments[0]?.dueInSelectedMonth, true);
  assert.equal(context.value.limits.length, 5);
  assert.equal(context.provenance[0]?.kind, "fact");
  assert.equal(context.provenance.at(-1)?.kind, "calculation");
});

test("filters context by Bruna and preserves the global base income", async () => {
  const summary = await provider.getSummary({
    profile: "Bruna",
    month: "2026-09",
  });
  const limits = await provider.getLimits({
    profile: "Bruna",
    month: "2026-09",
  });

  assert.deepEqual(summary.value, {
    baseIncome: 1000,
    extraIncome: 50,
    expenses: 100,
    available: 950,
    receivablesOutstanding: 150,
  });
  assert.equal(
    limits.value.some((limit) => limit.id === "gastos-bruna"),
    true,
  );
  assert.equal(
    limits.value.some((limit) => limit.id === "gastos-matheus"),
    false,
  );
});

test("filters context by Matheus, including only his receivables and income", async () => {
  const context = await provider.getContext({
    profile: "Matheus",
    month: "2026-09",
  });

  assert.equal(context.value.expenses[0]?.description, "Combustível");
  assert.equal(context.value.income[0]?.description, "Reembolso");
  assert.equal(context.value.summary.extraIncome, 0);
  assert.equal(context.value.summary.receivablesOutstanding, 0);
  assert.equal(
    context.value.limits.some((limit) => limit.id === "gastos-matheus"),
    true,
  );
});

test("supports category filtering for expenses and category limits", async () => {
  const context = await provider.getContext({
    profile: "Casal",
    month: "2026-09",
    category: "Casa",
  });

  assert.equal(context.value.expenses.length, 1);
  assert.equal(context.value.expenses[0]?.amount, 300);
  assert.deepEqual(
    context.value.limits.map((limit) => limit.id),
    ["category:Casa"],
  );
  assert.equal(context.scope.category, "Casa");
  assert.equal(
    context.provenance.some((item) => item.label.includes("Casa")),
    true,
  );
});

test("returns a zero-activity month with deterministic totals", async () => {
  const context = await provider.getContext({
    profile: "Casal",
    month: "2026-07",
  });

  assert.deepEqual(context.value.summary, {
    baseIncome: 1000,
    extraIncome: 0,
    expenses: 0,
    available: 1000,
    receivablesOutstanding: 0,
  });
  assert.deepEqual(context.value.expenses, []);
  assert.deepEqual(context.value.income, []);
  assert.equal(context.value.installments.length, 2);
});
