import type { AppFinancialData } from "../../lib/app/AppTypes";

export type AuthenticatedBootstrapDecision =
  | "remote"
  | "migration-required"
  | "remote-error";

function hasConfiguredRemoteFinancialData(snapshot: AppFinancialData) {
  return (
    snapshot.expenses.length > 0 ||
    snapshot.installments.length > 0 ||
    snapshot.debts.length > 0 ||
    snapshot.incomeEntries.length > 0 ||
    snapshot.creditCards.length > 0 ||
    snapshot.invoicePayments.length > 0 ||
    (snapshot.invoiceAdjustments?.length ?? 0) > 0 ||
    (snapshot.installmentInvoiceEvents?.length ?? 0) > 0 ||
    (snapshot.installmentReimbursementAllocations?.length ?? 0) > 0
  );
}

/**
 * Local data is eligible for an explicit migration only after a successful
 * remote read proves the authenticated household has no financial state.
 */
export function decideAuthenticatedBootstrap({
  localExists,
  remote,
  localAlreadyImported,
}: {
  localExists: boolean;
  remote: AppFinancialData | undefined;
  localAlreadyImported: boolean;
}): AuthenticatedBootstrapDecision {
  if (!remote) return "remote-error";
  if (
    hasConfiguredRemoteFinancialData(remote) ||
    !localExists ||
    localAlreadyImported
  ) {
    return "remote";
  }
  return "migration-required";
}
