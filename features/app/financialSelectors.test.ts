import assert from "node:assert/strict";
import test from "node:test";
import {
  deriveCategoryDetails,
  deriveCategorySpending,
  deriveFinancialSelectors,
} from "./financialSelectors";
import { DEFAULT_BUDGETS, INITIAL_EXPENSES } from "./defaultFinancialData";

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
    profile: "Casal",
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

test("derives category distribution only from the selected expenses", () => {
  const result = deriveCategorySpending([
    {
      id: 1,
      title: "Mercado",
      cat: "Alimentação",
      who: "Bruna",
      amount: 75,
      date: "2026-09-02",
    },
    {
      id: 2,
      title: "Uber",
      cat: "Transporte",
      who: "Matheus",
      amount: 25,
      date: "2026-09-03",
    },
    {
      id: 3,
      title: "Restaurante",
      cat: "Alimentação",
      who: "Casal",
      amount: 50,
      date: "2026-09-04",
    },
  ]);

  assert.deepEqual(result, [
    { category: "Alimentação", amount: 125, percentage: 83.33333333333334 },
    { category: "Transporte", amount: 25, percentage: 16.666666666666664 },
  ]);
  assert.deepEqual(deriveCategorySpending([]), []);
});

test("derives category detail with profile scope and explicit no-limit states", () => {
  const expenses = [
    {
      id: 1,
      title: "Mercado",
      cat: "Alimentação",
      who: "Bruna" as const,
      amount: 90,
      date: "2026-09-02",
    },
    {
      id: 2,
      title: "Uber",
      cat: "Transporte",
      who: "Matheus" as const,
      amount: 130,
      date: "2026-09-03",
    },
    {
      id: 3,
      title: "Cinema",
      cat: "Lazer",
      who: "Bruna" as const,
      amount: 20,
      date: "2026-09-04",
    },
  ];

  const bruna = deriveCategoryDetails({
    expenses,
    budgets: { Alimentação: 100, Transporte: 100, Saúde: 0 },
    profile: "Bruna",
  });

  assert.deepEqual(
    bruna.map(({ category, spent, status }) => ({ category, spent, status })),
    [
      { category: "Alimentação", spent: 90, status: "warning" },
      { category: "Lazer", spent: 20, status: "unlimited" },
      { category: "Saúde", spent: 0, status: "unlimited" },
      { category: "Transporte", spent: 0, status: "normal" },
    ],
  );
  assert.equal(bruna[0]?.remaining, 10);
  assert.equal(bruna[1]?.limit, null);

  const casal = deriveCategoryDetails({
    expenses,
    budgets: { Alimentação: 100, Transporte: 100 },
    profile: "Casal",
  });
  assert.equal(
    casal.find((item) => item.category === "Transporte")?.status,
    "exceeded",
  );
});

test("reconciles August expenses and limits for every official profile scope", () => {
  const baseInput = {
    expenses: INITIAL_EXPENSES,
    installments: [],
    debts: [],
    incomeEntries: [],
    income: 13_000,
    budgets: DEFAULT_BUDGETS,
    limits: { Bruna: 350, Matheus: 350 },
    viewMonth: "2026-08",
  };
  const bruna = deriveFinancialSelectors({ ...baseInput, profile: "Bruna" });
  const matheus = deriveFinancialSelectors({
    ...baseInput,
    profile: "Matheus",
  });
  const casal = deriveFinancialSelectors({ ...baseInput, profile: "Casal" });

  assert.equal(bruna.totalSpent, 603.2);
  assert.deepEqual(
    bruna.monthExpenses.map((expense) => expense.title),
    ["FIES", "Mercado"],
  );
  assert.deepEqual(
    bruna.limitItems.find((item) => item.id === "Bruna"),
    { id: "Bruna", label: "Gastos de Bruna", amount: 350, spent: 603.2 },
  );
  assert.equal(
    bruna.limitItems.some((item) => item.id === "Matheus"),
    false,
  );
  assert.equal(
    bruna.limitItems.find((item) => item.id === "category:Pessoal")?.spent,
    553.2,
  );
  assert.equal(
    bruna.limitItems.find((item) => item.id === "category:Alimentação")?.spent,
    50,
  );

  assert.equal(matheus.totalSpent, 0);
  assert.deepEqual(matheus.monthExpenses, []);
  assert.deepEqual(
    matheus.limitItems.find((item) => item.id === "Matheus"),
    { id: "Matheus", label: "Gastos de Matheus", amount: 350, spent: 0 },
  );

  assert.equal(casal.totalSpent, 3883.2);
  assert.equal(casal.monthExpenses.length, INITIAL_EXPENSES.length);
  assert.deepEqual(
    casal.monthExpenses.map((expense) => expense.title),
    INITIAL_EXPENSES.map((expense) => expense.title),
  );

  const categories = deriveCategoryDetails({
    expenses: casal.monthExpenses,
    budgets: DEFAULT_BUDGETS,
    profile: "Casal",
  });
  assert.equal(
    categories.find((category) => category.category === "Carro")?.spent,
    2180,
  );
  assert.equal(
    categories.find((category) => category.category === "Casa")?.spent,
    1090,
  );
  assert.equal(
    categories.find((category) => category.category === "Pessoal")?.spent,
    553.2,
  );
  assert.equal(
    categories.find((category) => category.category === "Alimentação")?.spent,
    50,
  );
  assert.equal(
    categories.find((category) => category.category === "Pets")?.spent,
    10,
  );
});
