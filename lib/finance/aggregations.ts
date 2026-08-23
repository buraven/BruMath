import type { Transaction, TransactionOwner } from "./transactions";
import { isExpense, normalizeTransactionAmount } from "./transactions";

export type SpendingSummary = {
  byCategory: Record<string, number>;
  byOwner: Record<TransactionOwner, number>;
};

export function aggregateExpenses(transactions: Transaction[]): SpendingSummary {
  const byCategory: Record<string, number> = {};
  const byOwner: Record<TransactionOwner, number> = {
    Bruna: 0,
    Matheus: 0,
    Casal: 0,
  };

  for (const transaction of transactions) {
    if (!isExpense(transaction)) continue;

    const amount = normalizeTransactionAmount(transaction);
    byCategory[transaction.category] = (byCategory[transaction.category] ?? 0) + amount;
    byOwner[transaction.owner] += amount;
  }

  return { byCategory, byOwner };
}

export function getCategorySpending(
  summary: SpendingSummary,
  category: string,
): number {
  return summary.byCategory[category] ?? 0;
}

export function getOwnerSpending(
  summary: SpendingSummary,
  owner: TransactionOwner,
): number {
  return summary.byOwner[owner];
}
