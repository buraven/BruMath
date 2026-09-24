import type { AppFinancialData, Debt } from "../app/AppTypes";
import { hydrateCategoryCatalog } from "../finance/categoryCatalog";
import { resolvePersonalLimits } from "../finance/personalLimits";

const STORAGE_KEY = "brumath-data";

export type BruMathStoredData = Partial<AppFinancialData> & {
  expenses?: AppFinancialData["expenses"];
  incomeEntries?: AppFinancialData["incomeEntries"];
};

export type AppFinancialDataDefaults = Pick<
  AppFinancialData,
  | "expenses"
  | "categories"
  | "installments"
  | "debts"
  | "incomeEntries"
  | "income"
  | "budgets"
  | "limits"
  | "personalLimits"
  | "creditCards"
  | "invoicePayments"
  | "invoiceAdjustments"
  | "installmentInvoiceEvents"
  | "installmentReimbursementAllocations"
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
    if (Object.keys(data).length === 0) {
      return hydrateCategoryCatalog({
        ...defaults,
        categories: defaults.categories ?? [],
      });
    }
    return hydrateCategoryCatalog({
      categories: Array.isArray(data.categories) ? data.categories : [],
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
      personalLimits: resolvePersonalLimits(
        data.personalLimits,
        data.limits,
        defaults.personalLimits,
      ),
      creditCards: Array.isArray(data.creditCards)
        ? data.creditCards
        : defaults.creditCards,
      invoicePayments: Array.isArray(data.invoicePayments)
        ? data.invoicePayments
        : defaults.invoicePayments,
      // These collections were added after the first local snapshot schema.
      // Empty arrays keep an old snapshot semantically equivalent while making
      // every newer snapshot explicit and round-trippable.
      invoiceAdjustments: Array.isArray(data.invoiceAdjustments)
        ? data.invoiceAdjustments
        : (defaults.invoiceAdjustments ?? []),
      installmentInvoiceEvents: Array.isArray(data.installmentInvoiceEvents)
        ? data.installmentInvoiceEvents
        : (defaults.installmentInvoiceEvents ?? []),
      installmentReimbursementAllocations: Array.isArray(
        data.installmentReimbursementAllocations,
      )
        ? data.installmentReimbursementAllocations
        : (defaults.installmentReimbursementAllocations ?? []),
      activeProfile: data.activeProfile ?? defaults.activeProfile,
      viewMonth: data.viewMonth ?? defaults.viewMonth,
    });
  }

  save(data: AppFinancialData) {
    this.saveStoredData(data);
  }
}
