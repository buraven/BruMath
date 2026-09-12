import type { AppFinancialData, Debt } from "../app/AppTypes";

const STORAGE_KEY = "brumath-data";

export type AppFinancialDataDefaults = Pick<
  AppFinancialData,
  | "expenses"
  | "installments"
  | "debts"
  | "incomeEntries"
  | "income"
  | "budgets"
  | "limits"
  | "activeProfile"
  | "viewMonth"
>;

/**
 * Browser-only repository for the existing app snapshot. It intentionally
 * preserves the `brumath-data` schema while keeping storage details out of UI.
 */
export class BruMathDataRepository {
  load(defaults: AppFinancialDataDefaults): AppFinancialData {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaults;

    const data = JSON.parse(raw) as Partial<AppFinancialData>;
    return {
      expenses: Array.isArray(data.expenses)
        ? data.expenses
        : defaults.expenses,
      installments: Array.isArray(data.installments)
        ? data.installments
        : defaults.installments,
      debts: Array.isArray(data.debts)
        ? data.debts.map((debt: Debt) => ({
            ...debt,
            month: debt.month || data.viewMonth || defaults.viewMonth,
          }))
        : defaults.debts,
      incomeEntries: Array.isArray(data.incomeEntries)
        ? data.incomeEntries
        : defaults.incomeEntries,
      income: typeof data.income === "number" ? data.income : defaults.income,
      budgets: data.budgets
        ? { ...defaults.budgets, ...data.budgets }
        : defaults.budgets,
      limits: data.limits
        ? { ...defaults.limits, ...data.limits }
        : defaults.limits,
      activeProfile: data.activeProfile ?? defaults.activeProfile,
      viewMonth: data.viewMonth ?? defaults.viewMonth,
    };
  }

  save(data: AppFinancialData) {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }
}
