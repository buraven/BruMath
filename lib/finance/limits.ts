export type LimitOwner = "Bruna" | "Matheus" | "Casal";

export type CategoryLimit = {
  id: string;
  label: string;
  owner: LimitOwner;
  amount: number;
};

export type LimitUsage = CategoryLimit & {
  spent: number;
  remaining: number;
  percentage: number;
  exceeded: boolean;
};

export function calculateLimitUsage(limit: CategoryLimit, spent: number): LimitUsage {
  const safeSpent = Math.max(0, spent);
  const safeAmount = Math.max(0, limit.amount);
  const percentage = safeAmount > 0 ? (safeSpent / safeAmount) * 100 : 0;

  return {
    ...limit,
    spent: safeSpent,
    remaining: Math.max(0, safeAmount - safeSpent),
    percentage,
    exceeded: safeSpent > safeAmount,
  };
}

export function calculateLimitUsages(
  limits: CategoryLimit[],
  spentByLimit: Record<string, number>,
): LimitUsage[] {
  return limits.map((limit) => calculateLimitUsage(limit, spentByLimit[limit.id] ?? 0));
}
