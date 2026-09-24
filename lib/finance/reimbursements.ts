import type { Debt, InstallmentReimbursementAllocation } from "../app/AppTypes";

export type ReimbursementProjection = {
  due: readonly InstallmentReimbursementAllocation[];
  future: readonly InstallmentReimbursementAllocation[];
  currentAmount: number;
  futureAmount: number;
};

/**
 * Debt remains the source of truth for money currently receivable. An
 * allocation in `due` therefore needs a linked debt; allocations in `future`
 * are only a traceable projection and are never added to current receivables.
 */
export function deriveReimbursementProjection(
  allocations: readonly InstallmentReimbursementAllocation[],
  debts: readonly Debt[],
): ReimbursementProjection {
  const debtById = new Map(debts.map((debt) => [debt.id, debt]));
  const due = allocations.filter((allocation) => {
    if (allocation.status !== "due" || allocation.debtId === undefined)
      return false;
    const debt = debtById.get(allocation.debtId);
    return Boolean(debt && debt.paid < debt.amount);
  });
  const future = allocations.filter(
    (allocation) => allocation.status === "future",
  );
  return {
    due,
    future,
    currentAmount: due.reduce((sum, allocation) => sum + allocation.amount, 0),
    futureAmount: future.reduce(
      (sum, allocation) => sum + allocation.amount,
      0,
    ),
  };
}

/** Explicit, idempotent state transition; creating the associated Debt is a
 * caller-owned action, so future agreements are never materialized blindly. */
export function markReimbursementDue(
  allocation: InstallmentReimbursementAllocation,
  debtId: number,
): InstallmentReimbursementAllocation {
  if (allocation.status === "received" || allocation.status === "cancelled")
    return allocation;
  if (allocation.status === "due" && allocation.debtId === debtId)
    return allocation;
  return { ...allocation, status: "due", debtId };
}
