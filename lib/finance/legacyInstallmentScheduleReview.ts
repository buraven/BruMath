import type {
  Installment,
  InstallmentInvoiceEvent,
  InstallmentReimbursementAllocation,
  InstallmentScheduleItem,
  InstallmentSettlementEvent,
} from "../app/AppTypes";
import { generateInstallmentSchedule } from "./installmentSchedule";

export type LegacyInstallmentScheduleClassification =
  | { kind: "materializable"; schedule: InstallmentScheduleItem[] }
  | {
      kind: "review_required";
      reason: "ambiguous_history" | "insufficient_structure";
    };

function shiftMonth(month: string, offset: number) {
  const match = /^(\d{4})-(\d{2})$/.exec(month);
  if (!match) return undefined;
  const date = new Date(Number(match[1]), Number(match[2]) - 1 + offset, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function shiftDate(dateValue: string, offset: number) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateValue);
  if (!match) return undefined;
  const sourceDay = Number(match[3]);
  const date = new Date(Number(match[1]), Number(match[2]) - 1 + offset, 1);
  const last = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(Math.min(sourceDay, last)).padStart(2, "0")}`;
}

/**
 * Classifies only plans whose entire schedule can be reconstructed from plan
 * structure plus explicit X/Y card events. Counters are consistency checks,
 * never historical proof. Anything else remains legacy and review-required.
 */
export function classifyLegacyInstallmentForMaterialization({
  installment,
  invoiceEvents = [],
  firstInvoiceReferenceMonth,
}: {
  installment: Installment;
  invoiceEvents?: readonly InstallmentInvoiceEvent[];
  firstInvoiceReferenceMonth?: string;
}): LegacyInstallmentScheduleClassification {
  if (
    !Number.isInteger(installment.totalInstallments) ||
    installment.totalInstallments < 1
  )
    return { kind: "review_required", reason: "insufficient_structure" };
  const planEvents = invoiceEvents.filter(
    (event) => event.installmentId === installment.id,
  );
  const numbers = [
    ...new Set(planEvents.map((event) => event.installmentNumber)),
  ].sort((a, b) => a - b);
  const eventPrefix = numbers.every((number, index) => number === index + 1);
  const eventAmountsMatch = planEvents.every(
    (event) => event.amount === installment.amount,
  );
  const hasOnlyReconciledPrefix =
    planEvents.length > 0 &&
    planEvents.length === installment.paidInstallments &&
    numbers.length === planEvents.length &&
    eventPrefix &&
    eventAmountsMatch;
  const noHistory =
    installment.paidInstallments === 0 && planEvents.length === 0;
  if (!noHistory && !hasOnlyReconciledPrefix)
    return { kind: "review_required", reason: "ambiguous_history" };

  const firstDueDate = shiftDate(
    installment.nextDue,
    -installment.paidInstallments,
  );
  const eventMonth = planEvents.find(
    (event) => event.installmentNumber === 1,
  )?.referenceMonth;
  const referenceMonth = firstInvoiceReferenceMonth ?? eventMonth;
  if (
    !firstDueDate ||
    (installment.creditCardId !== undefined && !referenceMonth)
  )
    return { kind: "review_required", reason: "insufficient_structure" };
  if (referenceMonth && !shiftMonth(referenceMonth, 0))
    return { kind: "review_required", reason: "insufficient_structure" };

  return {
    kind: "materializable",
    schedule: generateInstallmentSchedule({
      installmentId: installment.id,
      totalAmount: installment.amount * installment.totalInstallments,
      totalInstallments: installment.totalInstallments,
      firstDueDate,
      ...(referenceMonth ? { firstInvoiceReferenceMonth: referenceMonth } : {}),
      ...(installment.creditCardId !== undefined
        ? { creditCardId: installment.creditCardId }
        : {}),
    }),
  };
}

/** Future manual review may persist only a complete, non-contradictory plan. */
export function assertManualScheduleReviewComplete(
  installment: Installment,
  schedule: readonly InstallmentScheduleItem[],
  events: readonly InstallmentInvoiceEvent[],
  settlements: readonly InstallmentSettlementEvent[] = [],
  reimbursements: readonly InstallmentReimbursementAllocation[] = [],
) {
  if (schedule.length !== installment.totalInstallments)
    throw new Error("A revisão precisa informar todas as parcelas X/Y.");
  const byNumber = new Map(
    schedule.map((item) => [item.installmentNumber, item]),
  );
  if (byNumber.size !== installment.totalInstallments)
    throw new Error("A revisão contém parcelas duplicadas.");
  for (let number = 1; number <= installment.totalInstallments; number += 1) {
    const item = byNumber.get(number);
    if (
      !item ||
      item.installmentId !== installment.id ||
      item.totalInstallments !== installment.totalInstallments
    )
      throw new Error(
        "A revisão precisa conter cada parcela X/Y exatamente uma vez.",
      );
  }
  for (const event of events.filter(
    (candidate) => candidate.installmentId === installment.id,
  )) {
    const item = byNumber.get(event.installmentNumber);
    if (
      !item ||
      item.amount !== event.amount ||
      item.creditCardId !== event.cardId ||
      item.invoiceReferenceMonth !== event.referenceMonth
    )
      throw new Error("A revisão contradiz um fato histórico já registrado.");
  }
  for (const settlement of settlements.filter(
    (candidate) => candidate.installmentId === installment.id,
  )) {
    const item = byNumber.get(settlement.installmentNumber);
    if (!item || item.amount !== settlement.amount)
      throw new Error("A revisão contradiz uma liquidação já registrada.");
  }
  for (const reimbursement of reimbursements.filter(
    (candidate) => candidate.installmentId === installment.id,
  )) {
    if (!byNumber.has(reimbursement.installmentNumber))
      throw new Error("A revisão contradiz um reembolso já registrado.");
  }
}

export type LegacyScheduleMaterializationReport = {
  materializable: number;
  reviewRequired: number;
  alreadyScheduled: number;
  applied: number;
  scheduleItems: InstallmentScheduleItem[];
};

/**
 * Controlled local operation for a future explicitly-authorized write. The
 * default `apply` is false, making this usable as a dry-run. It only appends a
 * complete Class-A schedule for plans that have no schedule rows at all.
 */
export function materializeDeterministicLegacySchedules({
  installments,
  scheduleItems,
  invoiceEvents = [],
  firstInvoiceReferenceMonth,
  apply = false,
}: {
  installments: readonly Installment[];
  scheduleItems: readonly InstallmentScheduleItem[];
  invoiceEvents?: readonly InstallmentInvoiceEvent[];
  firstInvoiceReferenceMonth?: (installment: Installment) => string | undefined;
  apply?: boolean;
}): LegacyScheduleMaterializationReport {
  let materializable = 0;
  let reviewRequired = 0;
  let alreadyScheduled = 0;
  const additions: InstallmentScheduleItem[] = [];
  for (const installment of installments) {
    if (scheduleItems.some((item) => item.installmentId === installment.id)) {
      alreadyScheduled += 1;
      continue;
    }
    const classification = classifyLegacyInstallmentForMaterialization({
      installment,
      invoiceEvents,
      firstInvoiceReferenceMonth: firstInvoiceReferenceMonth?.(installment),
    });
    if (classification.kind === "review_required") {
      reviewRequired += 1;
      continue;
    }
    materializable += 1;
    if (apply) additions.push(...classification.schedule);
  }
  return {
    materializable,
    reviewRequired,
    alreadyScheduled,
    applied: additions.length ? additions.length : 0,
    scheduleItems: apply
      ? [...scheduleItems, ...additions]
      : [...scheduleItems],
  };
}
