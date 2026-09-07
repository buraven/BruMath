import type { CategoryLimit } from "../../finance/limits";
import type {
  AssistantMonth,
  AssistantProfile,
  ResponseProvenance,
} from "../contracts";

export type FinancialScope = {
  profile: AssistantProfile;
  month: AssistantMonth;
  category?: string;
};

export type FinancialContextResult<T> = {
  value: T;
  scope: FinancialScope;
  provenance: readonly ResponseProvenance[];
};

export type FinancialSummary = {
  baseIncome: number;
  extraIncome: number;
  expenses: number;
  available: number;
  receivablesOutstanding: number;
};

export type ExpenseContextItem = {
  id: string;
  description: string;
  amount: number;
  category: string;
  owner: AssistantProfile;
  date: string;
};

export type LimitContextItem = CategoryLimit & {
  spent: number;
  remaining: number;
  percentage: number;
  exceeded: boolean;
  kind: "personal" | "category";
};

export type InstallmentContextItem = {
  id: string;
  title: string;
  category: string;
  amount: number;
  owner: AssistantProfile;
  payer?: AssistantProfile;
  remainingInstallments: number;
  nextDue: string;
  dueInSelectedMonth: boolean;
};

export type ReceivableContextItem = {
  id: string;
  person: string;
  outstanding: number;
  received: number;
  destination: "cartao" | AssistantProfile;
};

export type IncomeContextItem = {
  id: string;
  description: string;
  amount: number;
  owner: AssistantProfile;
  date: string;
  destination: "conta" | "cartao";
};

export type FinancialContext = {
  summary: FinancialSummary;
  expenses: readonly ExpenseContextItem[];
  limits: readonly LimitContextItem[];
  installments: readonly InstallmentContextItem[];
  receivables: readonly ReceivableContextItem[];
  income: readonly IncomeContextItem[];
};

export interface FinancialContextProvider {
  getContext(
    scope: FinancialScope,
  ): Promise<FinancialContextResult<FinancialContext>>;
  getSummary(
    scope: FinancialScope,
  ): Promise<FinancialContextResult<FinancialSummary>>;
  getExpenses(
    scope: FinancialScope,
  ): Promise<FinancialContextResult<readonly ExpenseContextItem[]>>;
  getLimits(
    scope: FinancialScope,
  ): Promise<FinancialContextResult<readonly LimitContextItem[]>>;
  getInstallments(
    scope: FinancialScope,
  ): Promise<FinancialContextResult<readonly InstallmentContextItem[]>>;
  getReceivables(
    scope: FinancialScope,
  ): Promise<FinancialContextResult<readonly ReceivableContextItem[]>>;
  getIncome(
    scope: FinancialScope,
  ): Promise<FinancialContextResult<readonly IncomeContextItem[]>>;
}
