import type {
  InstallmentInvoiceEvent,
  InstallmentReimbursementAllocation,
  InstallmentScheduleItem,
  InstallmentSettlementEvent,
} from "../app/AppTypes";
import {
  isInstallmentScheduleItemHistorical,
  type InstallmentScheduleHistoryFacts,
} from "./installmentScheduleHistory";

export type InstallmentScheduleLifecycle =
  | "historical"
  | "current_open_invoice"
  | "future"
  | "cancelled";

/**
 * Classifies a planned X/Y without ever promoting a date or legacy counter to
 * a financial fact. Explicit settlements/events always win over presentation
 * state (the currently open invoice).
 */
export function classifyInstallmentScheduleItem(
  item: InstallmentScheduleItem,
  facts: InstallmentScheduleHistoryFacts & {
    openInvoiceReferenceMonth?: string;
  },
): InstallmentScheduleLifecycle {
  if (item.status === "cancelled") return "cancelled";
  if (isInstallmentScheduleItemHistorical(item, facts)) return "historical";
  if (
    item.creditCardId !== undefined &&
    item.invoiceReferenceMonth === facts.openInvoiceReferenceMonth
  )
    return "current_open_invoice";
  return "future";
}

export function isProtectedInstallmentScheduleItem(
  item: Pick<InstallmentScheduleItem, "installmentId" | "installmentNumber">,
  facts: {
    installmentInvoiceEvents?: readonly InstallmentInvoiceEvent[];
    installmentSettlementEvents?: readonly InstallmentSettlementEvent[];
  },
) {
  return isInstallmentScheduleItemHistorical(item, facts);
}

/** Allocations with a debt or lifecycle state are financial facts, not draft data. */
export function isProtectedInstallmentReimbursement(
  allocation: InstallmentReimbursementAllocation,
) {
  return (
    allocation.debtId !== undefined ||
    allocation.status === "received" ||
    allocation.status === "cancelled" ||
    allocation.status === "due"
  );
}
