import type { CategoryLimit, LimitUsage } from "./limits";
import { calculateLimitUsages } from "./limits";
import type { SpendingSummary } from "./aggregations";
import { getCategorySpending, getOwnerSpending } from "./aggregations";

const OWNER_LIMIT_IDS = new Set(["gastos-bruna", "gastos-matheus"]);

export function calculateIntegratedLimitUsages(
  limits: CategoryLimit[],
  spending: SpendingSummary,
): LimitUsage[] {
  return calculateLimitUsages(
    limits,
    Object.fromEntries(
      limits.map((limit) => [
        limit.id,
        OWNER_LIMIT_IDS.has(limit.id)
          ? getOwnerSpending(spending, limit.owner)
          : getCategorySpending(spending, limit.label),
      ]),
    ),
  );
}
