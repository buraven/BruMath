import type {
  Debt,
  Expense,
  IncomeEntry,
  Installment,
  Person,
} from "../../lib/app/AppTypes";
import { isWithinProfileScope } from "../../lib/finance/profileScope";

export type CategorySpending = {
  category: string;
  amount: number;
  percentage: number;
};

export type CategoryLimitStatus =
  | "normal"
  | "warning"
  | "exceeded"
  | "unlimited";

export type CategoryDetail = {
  category: string;
  spent: number;
  limit: number | null;
  remaining: number | null;
  percentage: number | null;
  status: CategoryLimitStatus;
  expenses: readonly Expense[];
};

/**
 * Matches the existing Financial Context semantics: an individual profile sees
 * only its own records, while Casal represents the shared view of all records.
 */
export function filterExpensesForProfile(
  expenses: readonly Expense[],
  profile: Person,
): readonly Expense[] {
  return expenses.filter((expense) =>
    isWithinProfileScope(expense.who, profile),
  );
}

/**
 * Presentation selector for the Categories feature. It only groups the
 * selected-month expenses and exposes the already configured category limits;
 * it does not persist or redefine any financial rule.
 */
export function deriveCategoryDetails({
  expenses,
  budgets,
  profile,
}: {
  expenses: readonly Expense[];
  budgets: Readonly<Record<string, number>>;
  profile: Person;
}): readonly CategoryDetail[] {
  const scopedExpenses = filterExpensesForProfile(expenses, profile);
  const spendingByCategory = new Map(
    deriveCategorySpending(scopedExpenses).map((item) => [
      item.category,
      item.amount,
    ]),
  );
  const categories = new Set([
    ...Object.keys(budgets),
    ...scopedExpenses.map((expense) => expense.cat),
  ]);

  return [...categories]
    .map((category) => {
      const spent = spendingByCategory.get(category) ?? 0;
      const configuredLimit = budgets[category];
      const limit =
        typeof configuredLimit === "number" && configuredLimit > 0
          ? configuredLimit
          : null;
      const percentage = limit === null ? null : (spent / limit) * 100;
      const remaining = limit === null ? null : limit - spent;
      let status: CategoryLimitStatus = "unlimited";
      if (limit !== null) {
        status =
          spent > limit
            ? "exceeded"
            : percentage !== null && percentage >= 80
              ? "warning"
              : "normal";
      }

      return {
        category,
        spent,
        limit,
        remaining,
        percentage,
        status,
        expenses: scopedExpenses
          .filter((expense) => expense.cat === category)
          .slice()
          .sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id),
      };
    })
    .sort((a, b) => b.spent - a.spent || a.category.localeCompare(b.category));
}

/**
 * Presentation-only aggregation for the Home chart. Financial totals continue
 * to be derived from the same selected-month expenses used throughout the app.
 */
export function deriveCategorySpending(
  expenses: readonly Expense[],
): readonly CategorySpending[] {
  const total = expenses.reduce((sum, expense) => sum + expense.amount, 0);
  if (total <= 0) return [];

  const amounts = expenses.reduce<Record<string, number>>((result, expense) => {
    result[expense.cat] = (result[expense.cat] ?? 0) + expense.amount;
    return result;
  }, {});

  return Object.entries(amounts)
    .map(([category, amount]) => ({
      category,
      amount,
      percentage: (amount / total) * 100,
    }))
    .sort(
      (a, b) => b.amount - a.amount || a.category.localeCompare(b.category),
    );
}

type FinancialSelectorsInput = {
  expenses: Expense[];
  installments: Installment[];
  debts: Debt[];
  incomeEntries: IncomeEntry[];
  income: number;
  budgets: Record<string, number>;
  limits: Record<"Bruna" | "Matheus", number>;
  viewMonth: string;
  profile: Person;
};

export function deriveFinancialSelectors({
  expenses,
  installments,
  debts,
  incomeEntries,
  income,
  budgets,
  limits,
  viewMonth,
  profile,
}: FinancialSelectorsInput) {
  const monthExpenses = filterExpensesForProfile(
    expenses.filter((expense) => expense.date.startsWith(viewMonth)),
    profile,
  );
  const categories = Object.entries(budgets).map(([category, budget]) => {
    const spent = monthExpenses
      .filter((expense) => expense.cat === category)
      .reduce((sum, expense) => sum + expense.amount, 0);
    return {
      category,
      budget,
      spent,
      percent: budget ? Math.min(100, (spent / budget) * 100) : 0,
    };
  });
  const limitItems = [
    ...(["Bruna", "Matheus"] as const)
      .filter((person) => profile === "Casal" || person === profile)
      .map((person) => ({
        id: person,
        label: `Gastos de ${person}`,
        amount: limits[person],
        spent: monthExpenses
          .filter((expense) => expense.who === person)
          .reduce((sum, expense) => sum + expense.amount, 0),
      })),
    ...categories.map((item) => ({
      id: `category:${item.category}`,
      label: item.category,
      amount: item.budget,
      spent: item.spent,
    })),
  ];
  const monthIncome = incomeEntries.filter(
    (entry) =>
      entry.date.startsWith(viewMonth) && entry.destination === "conta",
  );
  const totalSpent = monthExpenses.reduce(
    (sum, expense) => sum + expense.amount,
    0,
  );
  const extraIncome = monthIncome.reduce((sum, entry) => sum + entry.amount, 0);
  const monthIncomeTotal = income + extraIncome;
  const available = monthIncomeTotal - totalSpent;
  const monthDebts = debts.filter((debt) => {
    const debtMonth = debt.month || viewMonth;
    if (debtMonth > viewMonth) return false;
    if (debt.paid >= debt.amount)
      return debt.receivedMonth === viewMonth || debtMonth === viewMonth;
    return true;
  });
  const debtTotal = monthDebts.reduce(
    (sum, debt) => sum + Math.max(0, debt.amount - debt.paid),
    0,
  );
  const activeInstallments = installments.filter(
    (installment) =>
      installment.paidInstallments < installment.totalInstallments,
  );
  const remaining = activeInstallments.reduce(
    (sum, installment) =>
      sum + installment.totalInstallments - installment.paidInstallments,
    0,
  );

  return {
    monthExpenses,
    limitItems,
    monthIncome,
    totalSpent,
    extraIncome,
    monthIncomeTotal,
    available,
    monthDebts,
    debtTotal,
    activeInstallments,
    remaining,
  };
}
