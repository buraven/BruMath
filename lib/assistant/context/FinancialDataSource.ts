import type { AssistantProfile } from "../contracts";
import type { PersonalLimitBucket } from "../../finance/personalLimitBuckets";
import type { PersonalLimitConfiguration } from "../../finance/personalLimits";
import type { Person } from "../../app/AppTypes";

export type PersistedExpense = {
  id: number;
  title: string;
  cat: string;
  who: AssistantProfile;
  amount: number;
  date: string;
  personalLimitBucket?: PersonalLimitBucket;
  creditCardId?: number;
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
  creditCardId?: number;
};

export type PersistedCreditCard = {
  id: number;
  name: string;
  issuer?: string;
  owner: AssistantProfile;
  creditLimit: number;
  closingDay: number;
  dueDay: number;
  appearance?: "purple" | "orange" | "blue";
  active: boolean;
};

export type PersistedInvoicePayment = {
  id: number;
  cardId: number;
  referenceMonth: string;
  paidAt: string;
  amount: number;
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
  personalLimits?: PersonalLimitConfiguration;
  creditCards?: readonly PersistedCreditCard[];
  invoicePayments?: readonly PersistedInvoicePayment[];
  activeProfile?: Person;
  viewMonth?: string;
  /** Whether the persistence source actually contained a BruMath dataset. */
  hasStoredData?: boolean;
};

export interface FinancialDataSource {
  read(): Promise<FinancialDataSnapshot>;
}
