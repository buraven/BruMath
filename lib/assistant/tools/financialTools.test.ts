import assert from "node:assert/strict";
import test from "node:test";
import { createFinancialContextProvider } from "../context/createFinancialContextProvider";
import type { FinancialDataSnapshot } from "../context/FinancialDataSource";
import type { FinancialScope } from "../context/FinancialContextProvider";
import {
  createFinancialToolRegistry,
  createFinancialTools,
} from "./financialTools";
import type { ReadOnlyTool, ToolExecutionContext } from "./ToolRegistry";

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
      title: "Gasolina",
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
      amount: 500,
      date: "2026-08-03",
    },
  ],
  incomeEntries: [
    {
      id: 1,
      title: "Freela",
      amount: 50,
      who: "Bruna",
      date: "2026-09-01",
      destination: "conta",
      note: "",
    },
    {
      id: 2,
      title: "Cartão",
      amount: 25,
      who: "Matheus",
      date: "2026-09-01",
      destination: "cartao",
      note: "",
    },
  ],
  debts: [
    {
      id: 1,
      person: "Ana",
      amount: 300,
      paid: 100,
      destination: "bruna",
      note: "",
      month: "2026-09",
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
  ],
  budgets: { Casa: 500, Carro: 400, Alimentação: 300 },
  limits: { Bruna: 350, Matheus: 450 },
};

function createContext(scope: FinancialScope): ToolExecutionContext {
  return {
    scope,
    financialContext: createFinancialContextProvider({
      read: async () => snapshot,
    }),
  };
}

function tool<TInput, TOutput>(name: string): ReadOnlyTool<TInput, TOutput> {
  const found = createFinancialTools().find(
    (candidate) => candidate.definition.name === name,
  );
  if (!found) throw new Error(`Tool ${name} was not registered.`);
  return found as ReadOnlyTool<TInput, TOutput>;
}

test("reads summary, available balance and extra income deterministically", async () => {
  const context = createContext({ profile: "Casal", month: "2026-09" });
  const summary = await tool<
    Record<string, never>,
    {
      data: { available: number; expenses: number };
      provenance: { source?: string }[];
    }
  >("getFinancialSummary").execute({}, context);
  const available = await tool<
    Record<string, never>,
    { data: { available: number } }
  >("getAvailableBalance").execute({}, context);
  const income = await tool<Record<string, never>, { data: { total: number } }>(
    "getExtraIncome",
  ).execute({}, context);

  assert.equal(summary.ok, true);
  assert.equal(available.ok, true);
  assert.equal(income.ok, true);
  if (!summary.ok || !available.ok || !income.ok) return;
  assert.equal(summary.value.data.expenses, 600);
  assert.equal(summary.value.data.available, 450);
  assert.equal(available.value.data.available, 450);
  assert.equal(income.value.data.total, 50);
  assert.equal(summary.value.provenance.at(-1)?.source, "assistant-tools");
});

test("applies profile, month and category filters without mixing values", async () => {
  const brunaFood = await tool<
    { category?: string },
    { data: { description: string }[] }
  >("getExpenses").execute(
    { category: "Alimentação" },
    createContext({ profile: "Bruna", month: "2026-09" }),
  );
  const matheusCategory = await tool<
    { category: string },
    { data: { total: number } }
  >("getCategorySpending").execute(
    { category: "Carro" },
    createContext({ profile: "Matheus", month: "2026-09" }),
  );
  const august = await tool<
    { category?: string },
    { data: { description: string }[] }
  >("getExpenses").execute(
    {},
    createContext({ profile: "Bruna", month: "2026-08" }),
  );

  assert.equal(brunaFood.ok, true);
  assert.equal(matheusCategory.ok, true);
  assert.equal(august.ok, true);
  if (!brunaFood.ok || !matheusCategory.ok || !august.ok) return;
  assert.deepEqual(
    brunaFood.value.data.map((expense) => expense.description),
    ["Mercado"],
  );
  assert.equal(matheusCategory.value.data.total, 200);
  assert.deepEqual(
    august.value.data.map((expense) => expense.description),
    ["Agosto"],
  );
});

test("keeps limits separate and returns installments and receivables", async () => {
  const context = createContext({ profile: "Casal", month: "2026-09" });
  const limits = await tool<
    { category?: string },
    { data: { kind: string; id: string }[] }
  >("getLimits").execute({}, context);
  const installments = await tool<
    { dueInSelectedMonth?: boolean },
    { data: { title: string }[] }
  >("getInstallments").execute({ dueInSelectedMonth: true }, context);
  const receivables = await tool<
    Record<string, never>,
    { data: { outstanding: number }[] }
  >("getReceivables").execute({}, context);

  assert.equal(limits.ok, true);
  assert.equal(installments.ok, true);
  assert.equal(receivables.ok, true);
  if (!limits.ok || !installments.ok || !receivables.ok) return;
  assert.equal(
    limits.value.data.filter((limit) => limit.kind === "personal").length,
    2,
  );
  assert.equal(
    limits.value.data.filter((limit) => limit.kind === "category").length,
    3,
  );
  assert.deepEqual(
    installments.value.data.map((installment) => installment.title),
    ["Carro"],
  );
  assert.equal(receivables.value.data[0]?.outstanding, 200);
});

test("rejects a category query without a category and never mutates the snapshot", async () => {
  const before = structuredClone(snapshot);
  const result = await tool<{ category: string }, unknown>(
    "getCategorySpending",
  ).execute(
    { category: "" },
    createContext({ profile: "Casal", month: "2026-09" }),
  );

  assert.deepEqual(result, {
    ok: false,
    code: "invalid-input",
    message: "Informe uma categoria para consultar.",
  });
  assert.deepEqual(snapshot, before);
});

test("registers the deterministic financial capabilities once", () => {
  const registry = createFinancialToolRegistry();

  assert.deepEqual(
    registry.list().map((definition) => definition.name),
    [
      "getFinancialSummary",
      "getExpenses",
      "getCategorySpending",
      "getAvailableBalance",
      "getLimits",
      "getInstallments",
      "getReceivables",
      "getExtraIncome",
    ],
  );
  assert.throws(() => registry.require("missingTool"), /not found/);
});
