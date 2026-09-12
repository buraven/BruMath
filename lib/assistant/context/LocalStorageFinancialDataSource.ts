import type {
  FinancialDataSnapshot,
  FinancialDataSource,
  PersistedDebt,
  PersistedExpense,
  PersistedIncomeEntry,
  PersistedInstallment,
} from "./FinancialDataSource";

const STORAGE_KEY = "brumath-data";

type StoredFinancialData = Partial<FinancialDataSnapshot>;

function assertBrowser() {
  if (typeof window === "undefined") {
    throw new Error("Financial storage is only available in the browser.");
  }
}

function asArray<T>(value: unknown): readonly T[] {
  return Array.isArray(value) ? (value as readonly T[]) : [];
}

function asNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function asNumberRecord(value: unknown): Readonly<Record<string, number>> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};

  return Object.fromEntries(
    Object.entries(value).flatMap(([key, amount]) =>
      typeof amount === "number" && Number.isFinite(amount)
        ? [[key, amount]]
        : [],
    ),
  );
}

function readStoredData(): {
  data: StoredFinancialData;
  hasStoredData: boolean;
} {
  assertBrowser();
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return { data: {}, hasStoredData: false };

  try {
    const parsed = JSON.parse(raw) as unknown;
    return {
      data:
        parsed && typeof parsed === "object"
          ? (parsed as StoredFinancialData)
          : {},
      hasStoredData: true,
    };
  } catch {
    return { data: {}, hasStoredData: false };
  }
}

export class LocalStorageFinancialDataSource implements FinancialDataSource {
  async read(): Promise<FinancialDataSnapshot> {
    const { data, hasStoredData } = readStoredData();
    const limits = asNumberRecord(data.limits);

    return {
      expenses: asArray<PersistedExpense>(data.expenses),
      installments: asArray<PersistedInstallment>(data.installments),
      debts: asArray<PersistedDebt>(data.debts),
      incomeEntries: asArray<PersistedIncomeEntry>(data.incomeEntries),
      income: asNumber(data.income),
      budgets: asNumberRecord(data.budgets),
      limits: {
        Bruna: asNumber(limits.Bruna),
        Matheus: asNumber(limits.Matheus),
      },
      hasStoredData,
    };
  }
}
