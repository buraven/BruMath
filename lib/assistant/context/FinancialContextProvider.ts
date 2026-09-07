import type { CategoryLimit } from "../../finance/limits";
import type { AssistantMonth, AssistantProfile } from "../contracts";

export type FinancialScope = {
  profile: AssistantProfile;
  month: AssistantMonth;
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
};

export type InstallmentContextItem = {
  id: string;
  title: string;
  amount: number;
  owner: AssistantProfile;
  payer?: AssistantProfile;
  remainingInstallments: number;
  nextDue: string;
};

export type ReceivableContextItem = {
  id: string;
  person: string;
  outstanding: number;
  received: number;
  destination: "conta" | "cartao";
};

export type IncomeContextItem = {
  id: string;
  description: string;
  amount: number;
  owner: AssistantProfile;
  date: string;
  destination: "conta" | "cartao";
};

export interface FinancialContextProvider {
  getSummary(scope: FinancialScope): Promise<FinancialSummary>;
  getExpenses(scope: FinancialScope): Promise<readonly ExpenseContextItem[]>;
  getLimits(scope: FinancialScope): Promise<readonly LimitContextItem[]>;
  getInstallments(
    scope: FinancialScope,
  ): Promise<readonly InstallmentContextItem[]>;
  getReceivables(
    scope: FinancialScope,
  ): Promise<readonly ReceivableContextItem[]>;
  getIncome(scope: FinancialScope): Promise<readonly IncomeContextItem[]>;
}
