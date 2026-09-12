import type {
  Debt,
  Expense,
  IncomeEntry,
  Installment,
} from "../../lib/app/AppTypes";

type FinancialSelectorsInput = {
  expenses: Expense[];
  installments: Installment[];
  debts: Debt[];
  incomeEntries: IncomeEntry[];
  income: number;
  budgets: Record<string, number>;
  limits: Record<"Bruna" | "Matheus", number>;
  viewMonth: string;
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
}: FinancialSelectorsInput) {
  const monthExpenses = expenses.filter((expense) =>
    expense.date.startsWith(viewMonth),
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
    ...(["Bruna", "Matheus"] as const).map((person) => ({
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
