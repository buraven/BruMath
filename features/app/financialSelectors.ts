import type {
  Category,
  Debt,
  Expense,
  IncomeEntry,
  Installment,
  Person,
} from "../../lib/app/AppTypes";
import {
  isReceivableWithinProfileScope,
  isWithinProfileScope,
} from "../../lib/finance/profileScope";
import {
  calculatePersonalLimitUsages,
  resolvePersonalLimits,
  type PersonalLimitConfiguration,
} from "../../lib/finance/personalLimits";

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
  categoryBudgets = {},
  categories = [],
  profile,
}: {
  expenses: readonly Expense[];
  budgets: Readonly<Record<string, number>>;
  categoryBudgets?: Readonly<Record<string, number>>;
  categories?: readonly Category[];
  profile: Person;
}): readonly CategoryDetail[] {
  const scopedExpenses = filterExpensesForProfile(expenses, profile);
  const categoryById = new Map(
    categories.map((category) => [category.id, category]),
  );
  const legacyKey = (name: string) => name;
  const expenseKey = (expense: Expense) =>
    expense.categoryId && categoryById.has(expense.categoryId)
      ? expense.categoryId
      : legacyKey(expense.cat);
  const spendingByCategory = new Map<string, number>();
  for (const expense of scopedExpenses) {
    const key = expenseKey(expense);
    spendingByCategory.set(
      key,
      (spendingByCategory.get(key) ?? 0) + expense.amount,
    );
  }
  const items = new Map<string, { label: string; configuredLimit?: number }>();
  for (const category of categories) {
    items.set(category.id, {
      label: category.name,
      configuredLimit: categoryBudgets[category.id],
    });
  }
  for (const [name, amount] of Object.entries(budgets)) {
    // V4 hydration leaves only unresolved legacy values in this map. Do not
    // infer an ID here: equivalent legacy spellings may be intentionally
    // unresolved and must never be merged into an identity budget.
    const key = legacyKey(name);
    if (!items.has(key))
      items.set(key, { label: name, configuredLimit: amount });
  }
  for (const expense of scopedExpenses) {
    const key = expenseKey(expense);
    if (!items.has(key)) items.set(key, { label: expense.cat });
  }

  return [...items.entries()]
    .map(([id, item]) => {
      const spent = spendingByCategory.get(id) ?? 0;
      const configuredLimit = item.configuredLimit;
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
        category: item.label,
        spent,
        limit,
        remaining,
        percentage,
        status,
        expenses: scopedExpenses
          .filter((expense) => expenseKey(expense) === id)
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
  categoryBudgets?: Record<string, number>;
  categories?: Category[];
  personalLimits?: PersonalLimitConfiguration;
  /** Legacy input retained while existing callers migrate to bucket limits. */
  limits?: Record<"Bruna" | "Matheus", number>;
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
  categoryBudgets = {},
  categories = [],
  personalLimits,
  limits,
  viewMonth,
  profile,
}: FinancialSelectorsInput) {
  const monthExpenses = filterExpensesForProfile(
    expenses.filter((expense) => expense.date.startsWith(viewMonth)),
    profile,
  );
  const categoryById = new Map(
    categories.map((category) => [category.id, category]),
  );
  const expenseKey = (expense: Expense) =>
    expense.categoryId && categoryById.has(expense.categoryId)
      ? expense.categoryId
      : expense.cat;
  const limitCategories = new Map<string, { label: string; budget: number }>();
  for (const category of categories) {
    limitCategories.set(category.id, {
      label: category.name,
      budget: categoryBudgets[category.id] ?? 0,
    });
  }
  for (const [name, budget] of Object.entries(budgets)) {
    const key = name;
    if (!limitCategories.has(key))
      limitCategories.set(key, { label: name, budget });
  }
  const categoryLimits = [...limitCategories.entries()].map(([id, item]) => {
    const spent = monthExpenses
      .filter((expense) => expenseKey(expense) === id)
      .reduce((sum, expense) => sum + expense.amount, 0);
    return {
      id,
      label: item.label,
      budget: item.budget,
      spent,
      percent: item.budget ? Math.min(100, (spent / item.budget) * 100) : 0,
    };
  });
  const limitItems = [
    ...calculatePersonalLimitUsages(
      resolvePersonalLimits(personalLimits, limits),
      monthExpenses,
    ).filter((limit) => profile === "Casal" || limit.owner === profile),
    ...categoryLimits.map((item) => ({
      id: `category:${item.id}`,
      label: item.label,
      amount: item.budget,
      spent: item.spent,
    })),
  ];
  const monthIncome = incomeEntries.filter(
    (entry) =>
      entry.date.startsWith(viewMonth) &&
      entry.destination === "conta" &&
      isWithinProfileScope(entry.who, profile),
  );
  const totalSpent = monthExpenses.reduce(
    (sum, expense) => sum + expense.amount,
    0,
  );
  const extraIncome = monthIncome.reduce((sum, entry) => sum + entry.amount, 0);
  const monthIncomeTotal = income + extraIncome;
  const available = monthIncomeTotal - totalSpent;
  const monthDebts = debts.filter((debt) => {
    if (!isReceivableWithinProfileScope(debt.destination, profile))
      return false;
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
      installment.paidInstallments < installment.totalInstallments &&
      isWithinProfileScope(installment.who, profile),
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
