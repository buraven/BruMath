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
