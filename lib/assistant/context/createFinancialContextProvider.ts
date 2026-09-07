import { aggregateExpenses } from "../../finance/aggregations";
import { calculateIntegratedLimitUsages } from "../../finance/limitIntegration";
import type { CategoryLimit } from "../../finance/limits";
import {
  normalizeTransactionAmount,
  type Transaction,
} from "../../finance/transactions";
import type { ResponseProvenance } from "../contracts";
import type {
  FinancialContext,
  FinancialContextProvider,
  FinancialContextResult,
  FinancialScope,
  FinancialSummary,
  IncomeContextItem,
  InstallmentContextItem,
  LimitContextItem,
  ReceivableContextItem,
  ExpenseContextItem,
} from "./FinancialContextProvider";
import type {
  FinancialDataSnapshot,
  FinancialDataSource,
  PersistedDebt,
} from "./FinancialDataSource";

const PERSONAL_LIMIT_IDS = new Set(["gastos-bruna", "gastos-matheus"]);

function belongsToProfile(
  owner: string,
  profile: FinancialScope["profile"],
): boolean {
  return profile === "Casal" || owner === profile;
}

function belongsToReceivableProfile(
  debt: PersistedDebt,
  profile: FinancialScope["profile"],
): boolean {
  if (profile === "Casal") return true;
  return debt.destination === profile.toLowerCase();
}

function matchesMonth(date: string, month: string): boolean {
  return date.startsWith(month);
}

function toExpenseTransaction(expense: ExpenseContextItem): Transaction {
  return {
    id: expense.id,
    description: expense.description,
    amount: expense.amount,
    category: expense.category,
    owner: expense.owner,
    type: "expense",
    date: expense.date,
  };
}

function normalizeExpenses(
  data: FinancialDataSnapshot,
  scope: FinancialScope,
): readonly ExpenseContextItem[] {
  return data.expenses
    .filter(
      (expense) =>
        matchesMonth(expense.date, scope.month) &&
        belongsToProfile(expense.who, scope.profile) &&
        (!scope.category || expense.cat === scope.category),
    )
    .map((expense) => ({
      id: `expense:${expense.id}`,
      description: expense.title,
      amount: normalizeTransactionAmount({
        id: String(expense.id),
        description: expense.title,
        amount: expense.amount,
        category: expense.cat,
        owner: expense.who,
        type: "expense",
        date: expense.date,
      }),
      category: expense.cat,
      owner: expense.who,
      date: expense.date,
    }));
}

function normalizeIncome(
  data: FinancialDataSnapshot,
  scope: FinancialScope,
): readonly IncomeContextItem[] {
  return data.incomeEntries
    .filter(
      (income) =>
        matchesMonth(income.date, scope.month) &&
        belongsToProfile(income.who, scope.profile),
    )
    .map((income) => ({
      id: `income:${income.id}`,
      description: income.title,
      amount: Math.max(0, income.amount),
      owner: income.who,
      date: income.date,
      destination: income.destination,
    }));
}

function normalizeInstallments(
  data: FinancialDataSnapshot,
  scope: FinancialScope,
): readonly InstallmentContextItem[] {
  return data.installments
    .filter(
      (installment) =>
        installment.paidInstallments < installment.totalInstallments &&
        belongsToProfile(installment.who, scope.profile) &&
        (!scope.category || installment.category === scope.category),
    )
    .map((installment) => ({
      id: `installment:${installment.id}`,
      title: installment.title,
      category: installment.category,
      amount: Math.max(0, installment.amount),
      owner: installment.who,
      remainingInstallments: Math.max(
        0,
        installment.totalInstallments - installment.paidInstallments,
      ),
      nextDue: installment.nextDue,
      dueInSelectedMonth: matchesMonth(installment.nextDue, scope.month),
    }));
}

function isVisibleDebt(debt: PersistedDebt, month: string): boolean {
  const debtMonth = debt.month || month;
  if (debtMonth > month) return false;
  if (debt.paid >= debt.amount) {
    return debt.receivedMonth === month || debtMonth === month;
  }
  return true;
}

function normalizeReceivables(
  data: FinancialDataSnapshot,
  scope: FinancialScope,
): readonly ReceivableContextItem[] {
  return data.debts
    .filter(
      (debt) =>
        isVisibleDebt(debt, scope.month) &&
        belongsToReceivableProfile(debt, scope.profile),
    )
    .map((debt) => ({
      id: `receivable:${debt.id}`,
      person: debt.person,
      outstanding: Math.max(0, debt.amount - debt.paid),
      received: Math.max(0, debt.paid),
      destination:
        debt.destination === "cartao"
          ? "cartao"
          : debt.destination === "bruna"
            ? "Bruna"
            : debt.destination === "matheus"
              ? "Matheus"
              : "Casal",
    }));
}

function normalizeLimits(
  data: FinancialDataSnapshot,
  scope: FinancialScope,
  expenses: readonly ExpenseContextItem[],
): readonly LimitContextItem[] {
  const personalLimits: CategoryLimit[] = [
    {
      id: "gastos-bruna",
      label: "Gastos de Bruna",
      owner: "Bruna",
      amount: data.limits.Bruna,
    },
    {
      id: "gastos-matheus",
      label: "Gastos de Matheus",
      owner: "Matheus",
      amount: data.limits.Matheus,
    },
  ];
  const categoryLimits: CategoryLimit[] = Object.entries(data.budgets).map(
    ([label, amount]) => ({
      id: `category:${label}`,
      label,
      owner: "Casal",
      amount,
    }),
  );
  const includedLimits = [...personalLimits, ...categoryLimits].filter(
    (limit) => {
      if (scope.category) return limit.id === `category:${scope.category}`;
      return (
        scope.profile === "Casal" ||
        !PERSONAL_LIMIT_IDS.has(limit.id) ||
        limit.owner === scope.profile
      );
    },
  );
  const spending = aggregateExpenses(expenses.map(toExpenseTransaction));

  return calculateIntegratedLimitUsages(includedLimits, spending).map(
    (limit) => ({
      ...limit,
      kind: PERSONAL_LIMIT_IDS.has(limit.id) ? "personal" : "category",
    }),
  );
}

function provenanceFor(
  scope: FinancialScope,
  includesCalculation = false,
): readonly ResponseProvenance[] {
  return [
    {
      kind: "fact",
      label: `Dados financeiros de ${scope.month} para ${scope.profile}.`,
      source: "brumath-data",
    },
    ...(scope.category
      ? [
          {
            kind: "fact" as const,
            label: `Filtro de categoria: ${scope.category}.`,
            source: "financial-context-engine",
          },
        ]
      : []),
    ...(includesCalculation
      ? [
          {
            kind: "calculation" as const,
            label: "Totais e limites agregados determinísticamente.",
            source: "financial-context-engine",
          },
        ]
      : []),
  ];
}

function result<T>(
  value: T,
  scope: FinancialScope,
  includesCalculation = false,
): FinancialContextResult<T> {
  return {
    value,
    scope: { ...scope },
    provenance: provenanceFor(scope, includesCalculation),
  };
}

function buildContext(
  data: FinancialDataSnapshot,
  scope: FinancialScope,
): FinancialContext {
  const expenses = normalizeExpenses(data, scope);
  const income = normalizeIncome(data, scope);
  const receivables = normalizeReceivables(data, scope);
  const installments = normalizeInstallments(data, scope);
  const limits = normalizeLimits(data, scope, expenses);
  const extraIncome = income
    .filter((entry) => entry.destination === "conta")
    .reduce((total, entry) => total + entry.amount, 0);
  const totalExpenses = expenses.reduce(
    (total, expense) => total + expense.amount,
    0,
  );
  const baseIncome = Math.max(0, data.income);

  return {
    summary: {
      baseIncome,
      extraIncome,
      expenses: totalExpenses,
      available: baseIncome + extraIncome - totalExpenses,
      receivablesOutstanding: receivables.reduce(
        (total, receivable) => total + receivable.outstanding,
        0,
      ),
    },
    expenses,
    limits,
    installments,
    receivables,
    income,
  };
}

export function createFinancialContextProvider(
  source: FinancialDataSource,
): FinancialContextProvider {
  async function readContext(scope: FinancialScope): Promise<FinancialContext> {
    return buildContext(await source.read(), scope);
  }

  return {
    async getContext(scope) {
      return result(await readContext(scope), scope, true);
    },
    async getSummary(scope) {
      return result((await readContext(scope)).summary, scope, true);
    },
    async getExpenses(scope) {
      return result((await readContext(scope)).expenses, scope);
    },
    async getLimits(scope) {
      return result((await readContext(scope)).limits, scope, true);
    },
    async getInstallments(scope) {
      return result((await readContext(scope)).installments, scope);
    },
    async getReceivables(scope) {
      return result((await readContext(scope)).receivables, scope, true);
    },
    async getIncome(scope) {
      return result((await readContext(scope)).income, scope);
    },
  };
}
