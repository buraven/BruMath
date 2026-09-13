import { aggregateExpenses } from "../../finance/aggregations";
import { calculateIntegratedLimitUsages } from "../../finance/limitIntegration";
import {
  calculatePersonalLimitUsages,
  resolvePersonalLimits,
} from "../../finance/personalLimits";
import type { CategoryLimit } from "../../finance/limits";
import { isWithinProfileScope } from "../../finance/profileScope";
import { deriveInvoices } from "../../finance/invoices";
import {
  normalizeTransactionAmount,
  type Transaction,
} from "../../finance/transactions";
import type { ResponseProvenance } from "../contracts";
import type {
  FinancialContext,
  FinancialContextProvider,
  FinancialContextResult,
  FinancialDataAvailability,
  FinancialScope,
  FinancialSummary,
  IncomeContextItem,
  InstallmentContextItem,
  LimitContextItem,
  ReceivableContextItem,
  ExpenseContextItem,
  InvoiceContextItem,
} from "./FinancialContextProvider";
import type {
  FinancialDataSnapshot,
  FinancialDataSource,
  PersistedDebt,
} from "./FinancialDataSource";

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
    ...(expense.personalLimitBucket
      ? { personalLimitBucket: expense.personalLimitBucket }
      : {}),
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
        isWithinProfileScope(expense.who, scope.profile) &&
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
      ...(expense.personalLimitBucket
        ? { personalLimitBucket: expense.personalLimitBucket }
        : {}),
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
        isWithinProfileScope(income.who, scope.profile),
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
        isWithinProfileScope(installment.who, scope.profile) &&
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
  const categoryLimits: CategoryLimit[] = Object.entries(data.budgets).map(
    ([label, amount]) => ({
      id: `category:${label}`,
      label,
      owner: "Casal",
      amount,
    }),
  );
  if (scope.category) {
    const limit = categoryLimits.find(
      (item) => item.id === `category:${scope.category}`,
    );
    if (!limit) return [];
    const spending = aggregateExpenses(expenses.map(toExpenseTransaction));
    return calculateIntegratedLimitUsages([limit], spending).map((item) => ({
      ...item,
      kind: "category" as const,
    }));
  }

  const personal = calculatePersonalLimitUsages(
    resolvePersonalLimits(data.personalLimits, data.limits),
    expenses,
  )
    .filter(
      (limit) => scope.profile === "Casal" || limit.owner === scope.profile,
    )
    .map((limit) => ({
      ...limit,
      remaining: Math.max(0, limit.amount - limit.spent),
      percentage: limit.amount > 0 ? (limit.spent / limit.amount) * 100 : 0,
      exceeded: limit.spent > limit.amount,
      kind: "personal" as const,
    }));
  const spending = aggregateExpenses(expenses.map(toExpenseTransaction));
  const categories = calculateIntegratedLimitUsages(
    categoryLimits,
    spending,
  ).map((limit) => ({ ...limit, kind: "category" as const }));
  return [...personal, ...categories];
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
  availability: FinancialDataAvailability,
  includesCalculation = false,
): FinancialContextResult<T> {
  return {
    value,
    scope: { ...scope },
    provenance: provenanceFor(scope, includesCalculation),
    availability,
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
  const invoices: readonly InvoiceContextItem[] = deriveInvoices({
    cards: data.creditCards ?? [],
    expenses: data.expenses,
    installments: data.installments,
    payments: data.invoicePayments ?? [],
    profile: scope.profile,
    referenceMonth: scope.month,
  }).map((invoice) => ({
    id: invoice.id,
    cardName: invoice.card.name,
    owner: invoice.card.owner,
    referenceMonth: invoice.referenceMonth,
    dueDate: invoice.dueDate,
    total: invoice.total,
    availableCredit: invoice.availableCredit,
    status: invoice.status,
  }));

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
    invoices,
  };
}

export function createFinancialContextProvider(
  source: FinancialDataSource,
): FinancialContextProvider {
  async function readContext(scope: FinancialScope): Promise<{
    context: FinancialContext;
    availability: FinancialDataAvailability;
  }> {
    const data = await source.read();
    const context = buildContext(data, scope);
    return {
      context,
      availability: {
        source: "brumath-data",
        hasStoredData: data.hasStoredData ?? true,
        hasRecordsInScope:
          context.expenses.length > 0 ||
          context.income.length > 0 ||
          context.installments.length > 0 ||
          context.receivables.length > 0 ||
          context.invoices.length > 0,
      },
    };
  }

  return {
    async getContext(scope) {
      const { context, availability } = await readContext(scope);
      return result(context, scope, availability, true);
    },
    async getSummary(scope) {
      const { context, availability } = await readContext(scope);
      return result(context.summary, scope, availability, true);
    },
    async getExpenses(scope) {
      const { context, availability } = await readContext(scope);
      return result(context.expenses, scope, availability);
    },
    async getLimits(scope) {
      const { context, availability } = await readContext(scope);
      return result(context.limits, scope, availability, true);
    },
    async getInstallments(scope) {
      const { context, availability } = await readContext(scope);
      return result(context.installments, scope, availability);
    },
    async getReceivables(scope) {
      const { context, availability } = await readContext(scope);
      return result(context.receivables, scope, availability, true);
    },
    async getIncome(scope) {
      const { context, availability } = await readContext(scope);
      return result(context.income, scope, availability);
    },
    async getInvoices(scope) {
      const { context, availability } = await readContext(scope);
      return result(context.invoices, scope, availability, true);
    },
  };
}
