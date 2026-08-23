import type { CategoryLimit, LimitUsage } from "./limits";
import { calculateIntegratedLimitUsages } from "./limitIntegration";
import { aggregateExpenses } from "./aggregations";
import type { TransactionRepository } from "./TransactionRepository";

export async function getLimitUsages(
  repository: TransactionRepository,
  limits: CategoryLimit[],
): Promise<LimitUsage[]> {
  const transactions = await repository.getAll();
  const spending = aggregateExpenses(transactions);

  return calculateIntegratedLimitUsages(limits, spending);
}

export async function getLimitUsagesForMonth(
  repository: TransactionRepository,
  limits: CategoryLimit[],
  month: string,
): Promise<LimitUsage[]> {
  const transactions = await repository.getAll();
  const monthTransactions = transactions.filter((transaction) => transaction.date.startsWith(month));
  const spending = aggregateExpenses(monthTransactions);

  return calculateIntegratedLimitUsages(limits, spending);
}
