import type { AppFinancialData, Debt } from "../app/AppTypes";

const STORAGE_KEY = "brumath-data";

export type BruMathStoredData = Partial<AppFinancialData> & {
  expenses?: AppFinancialData["expenses"];
  incomeEntries?: AppFinancialData["incomeEntries"];
};

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
  readStoredData(): BruMathStoredData {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    try {
      const data = JSON.parse(raw) as BruMathStoredData;
      return data && typeof data === "object" ? data : {};
    } catch {
      return {};
    }
  }

  saveStoredData(data: BruMathStoredData) {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }

  load(defaults: AppFinancialDataDefaults): AppFinancialData {
    const data = this.readStoredData();
    if (Object.keys(data).length === 0) return defaults;
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
    this.saveStoredData(data);
  }
}
