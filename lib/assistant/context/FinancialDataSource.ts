import type { AssistantProfile } from "../contracts";

export type PersistedExpense = {
  id: number;
  title: string;
  cat: string;
  who: AssistantProfile;
  amount: number;
  date: string;
};

export type PersistedInstallment = {
  id: number;
  title: string;
  category: string;
  who: AssistantProfile;
  amount: number;
  totalInstallments: number;
  paidInstallments: number;
  nextDue: string;
};

export type PersistedDebt = {
  id: number;
  person: string;
  amount: number;
  destination: "cartao" | "bruna" | "matheus" | "casal";
  note: string;
  paid: number;
  month: string;
  receivedMonth?: string;
};

export type PersistedIncomeEntry = {
  id: number;
  title: string;
  amount: number;
  who: AssistantProfile;
  date: string;
  destination: "conta" | "cartao";
  note: string;
};

export type FinancialDataSnapshot = {
  expenses: readonly PersistedExpense[];
  installments: readonly PersistedInstallment[];
  debts: readonly PersistedDebt[];
  incomeEntries: readonly PersistedIncomeEntry[];
  income: number;
  budgets: Readonly<Record<string, number>>;
  limits: Readonly<Record<"Bruna" | "Matheus", number>>;
  /** Whether the persistence source actually contained a BruMath dataset. */
  hasStoredData?: boolean;
};

export interface FinancialDataSource {
  read(): Promise<FinancialDataSnapshot>;
}
