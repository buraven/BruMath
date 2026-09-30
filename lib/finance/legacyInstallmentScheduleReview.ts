import type {
  Installment,
  InstallmentInvoiceEvent,
  InstallmentReimbursementAllocation,
  InstallmentScheduleItem,
  InstallmentSettlementEvent,
} from "../app/AppTypes";
import { generateInstallmentSchedule } from "./installmentSchedule";

export type LegacyInstallmentScheduleClassification =
  | {
      kind: "materializable";
      class: "A";
      /** A card plan whose first competence was supplied by an explicit resolver. */
      conditional: boolean;
      schedule: InstallmentScheduleItem[];
    }
  | {
      kind: "review_required";
      class: "A_conditional" | "B" | "C";
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
    return {
      kind: "review_required",
      class: "C",
      reason: "insufficient_structure",
    };
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
  const reviewClassForKnownFacts = planEvents.length > 0 ? "B" : "C";
  if (!noHistory && !hasOnlyReconciledPrefix)
    return {
      kind: "review_required",
      class: reviewClassForKnownFacts,
      reason: "ambiguous_history",
    };

  const firstDueDate = shiftDate(
    installment.nextDue,
    -installment.paidInstallments,
  );
  const eventMonth = planEvents.find(
    (event) => event.installmentNumber === 1,
  )?.referenceMonth;
  const referenceMonth = firstInvoiceReferenceMonth ?? eventMonth;
  if (!firstDueDate)
    return {
      kind: "review_required",
      class: reviewClassForKnownFacts,
      reason: "insufficient_structure",
    };
  if (installment.creditCardId !== undefined && !referenceMonth)
    return {
      kind: "review_required",
      class: "A_conditional",
      reason: "insufficient_structure",
    };
  if (referenceMonth && !shiftMonth(referenceMonth, 0))
    return {
      kind: "review_required",
      class: reviewClassForKnownFacts,
      reason: "insufficient_structure",
    };

  return {
    kind: "materializable",
    class: "A",
    conditional:
      installment.creditCardId !== undefined &&
      eventMonth === undefined &&
      firstInvoiceReferenceMonth !== undefined,
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
  /** Class-A candidates safe to materialize without a resolver. */
  unconditionalA: number;
  /** Requires an explicitly supplied, canonical card competence resolver. */
  conditionalA: number;
  classB: number;
  classC: number;
  materializable: number;
  reviewRequired: number;
  alreadyScheduled: number;
  applied: number;
  scheduleItems: InstallmentScheduleItem[];
};

export type LegacyMaterializationPostCheck = {
  approved: number;
  completeAndReconciled: number;
  rejected: number;
  unexpectedSchedulePlans: number;
  invoiceEventsUnchanged: boolean;
  settlementsUnchanged: boolean;
  reimbursementsUnchanged: boolean;
};

function schedulesMatch(
  expected: readonly InstallmentScheduleItem[],
  actual: readonly InstallmentScheduleItem[],
) {
  const canonical = (items: readonly InstallmentScheduleItem[]) =>
    [...items]
      .sort((left, right) => left.installmentNumber - right.installmentNumber)
      .map((item) => ({
        id: item.id,
        installmentNumber: item.installmentNumber,
        totalInstallments: item.totalInstallments,
        amount: item.amount,
        invoiceReferenceMonth: item.invoiceReferenceMonth,
        dueDate: item.dueDate,
        creditCardId: item.creditCardId,
        status: item.status,
      }));
  return (
    JSON.stringify(canonical(expected)) === JSON.stringify(canonical(actual))
  );
}

/**
 * Read-only verifier for the future controlled application. It proves that
 * every explicitly approved plan received exactly its complete Class-A
 * schedule, and that the operation did not introduce schedules or historical
 * facts outside the pre-authorized scope.
 */
export function verifyClassAMaterializationReadOnly({
  installments,
  scheduleItems,
  invoiceEvents = [],
  settlementEvents = [],
  reimbursements = [],
  approvedInstallmentIds,
  preexistingScheduleInstallmentIds = [],
  firstInvoiceReferenceMonth,
  baselineFactCounts,
}: {
  installments: readonly Installment[];
  scheduleItems: readonly InstallmentScheduleItem[];
  invoiceEvents?: readonly InstallmentInvoiceEvent[];
  settlementEvents?: readonly InstallmentSettlementEvent[];
  reimbursements?: readonly InstallmentReimbursementAllocation[];
  approvedInstallmentIds: readonly number[];
  preexistingScheduleInstallmentIds?: readonly number[];
  firstInvoiceReferenceMonth?: (installment: Installment) => string | undefined;
  baselineFactCounts: {
    invoiceEvents: number;
    settlements: number;
    reimbursements: number;
  };
}): LegacyMaterializationPostCheck {
  const approved = new Set(approvedInstallmentIds);
  const preexisting = new Set(preexistingScheduleInstallmentIds);
  let completeAndReconciled = 0;
  let rejected = 0;

  for (const installmentId of approved) {
    const installment = installments.find((item) => item.id === installmentId);
    if (!installment) {
      rejected += 1;
      continue;
    }
    const classification = classifyLegacyInstallmentForMaterialization({
      installment,
      invoiceEvents,
      firstInvoiceReferenceMonth: firstInvoiceReferenceMonth?.(installment),
    });
    const actual = scheduleItems.filter(
      (item) => item.installmentId === installmentId,
    );
    if (
      classification.kind !== "materializable" ||
      classification.conditional ||
      !schedulesMatch(classification.schedule, actual)
    ) {
      rejected += 1;
      continue;
    }
    try {
      assertManualScheduleReviewComplete(
        installment,
        actual,
        invoiceEvents,
        settlementEvents,
        reimbursements,
      );
      completeAndReconciled += 1;
    } catch {
      rejected += 1;
    }
  }

  const unexpectedSchedulePlans = new Set(
    scheduleItems
      .map((item) => item.installmentId)
      .filter(
        (installmentId) =>
          !approved.has(installmentId) && !preexisting.has(installmentId),
      ),
  ).size;
  return {
    approved: approved.size,
    completeAndReconciled,
    rejected,
    unexpectedSchedulePlans,
    invoiceEventsUnchanged:
      invoiceEvents.length === baselineFactCounts.invoiceEvents,
    settlementsUnchanged:
      settlementEvents.length === baselineFactCounts.settlements,
    reimbursementsUnchanged:
      reimbursements.length === baselineFactCounts.reimbursements,
  };
}

/**
 * Controlled local operation for a future explicitly-authorized write. The
 * default `apply` is false, making this usable as a dry-run. It only appends a
 * complete Class-A schedule for plans that have no schedule rows at all.
 */
export function materializeDeterministicLegacySchedules({
  installments,
  scheduleItems,
  invoiceEvents = [],
  settlementEvents = [],
  reimbursements = [],
  firstInvoiceReferenceMonth,
  apply = false,
  approvedInstallmentIds,
  includeConditionallyResolved = false,
}: {
  installments: readonly Installment[];
  scheduleItems: readonly InstallmentScheduleItem[];
  invoiceEvents?: readonly InstallmentInvoiceEvent[];
  settlementEvents?: readonly InstallmentSettlementEvent[];
  reimbursements?: readonly InstallmentReimbursementAllocation[];
  firstInvoiceReferenceMonth?: (installment: Installment) => string | undefined;
  apply?: boolean;
  /** Required for writes, preventing an accidental bulk application. */
  approvedInstallmentIds?: readonly number[];
  /** Defaults to false: a resolver alone never authorizes the conditioned A. */
  includeConditionallyResolved?: boolean;
}): LegacyScheduleMaterializationReport {
  if (apply && !approvedInstallmentIds)
    throw new Error(
      "A aplicação exige os IDs técnicos A aprovados explicitamente.",
    );
  const approved = new Set(approvedInstallmentIds ?? []);
  let unconditionalA = 0;
  let conditionalA = 0;
  let classB = 0;
  let classC = 0;
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
      if (classification.class === "A_conditional") conditionalA += 1;
      else if (classification.class === "B") classB += 1;
      else classC += 1;
      reviewRequired += 1;
      continue;
    }
    if (classification.conditional) conditionalA += 1;
    else unconditionalA += 1;
    materializable += 1;
    // Recheck every canonical fact immediately before preparing a write. This
    // is deliberately per-plan: any changed or conflicting candidate is skipped.
    try {
      assertManualScheduleReviewComplete(
        installment,
        classification.schedule,
        invoiceEvents,
        settlementEvents,
        reimbursements,
      );
    } catch {
      if (classification.conditional) conditionalA -= 1;
      else unconditionalA -= 1;
      materializable -= 1;
      classB += 1;
      reviewRequired += 1;
      continue;
    }
    if (
      apply &&
      approved.has(installment.id) &&
      (!classification.conditional || includeConditionallyResolved)
    )
      additions.push(...classification.schedule);
  }
  return {
    unconditionalA,
    conditionalA,
    classB,
    classC,
    materializable,
    reviewRequired,
    alreadyScheduled,
    applied: additions.length ? additions.length : 0,
    scheduleItems: apply
      ? [...scheduleItems, ...additions]
      : [...scheduleItems],
  };
}

export type ApprovedClassAMaterializationOutcome = {
  installmentId: number;
  status: "applied" | "skipped" | "conflict" | "failed";
};

/**
 * Sequentially applies only explicitly-approved, unconditional Class-A plans.
 * The supplied boundary must call the narrow per-plan RPC; this domain layer
 * has no dependency on, and never invokes, snapshot replacement.
 */
export async function applyApprovedClassAMaterializations({
  installments,
  scheduleItems,
  invoiceEvents = [],
  settlementEvents = [],
  reimbursements = [],
  approvedInstallmentIds,
  materialize,
}: {
  installments: readonly Installment[];
  scheduleItems: readonly InstallmentScheduleItem[];
  invoiceEvents?: readonly InstallmentInvoiceEvent[];
  settlementEvents?: readonly InstallmentSettlementEvent[];
  reimbursements?: readonly InstallmentReimbursementAllocation[];
  approvedInstallmentIds: readonly number[];
  materialize: (
    installmentId: number,
    schedule: readonly InstallmentScheduleItem[],
  ) => Promise<"applied" | "conflict">;
}): Promise<ApprovedClassAMaterializationOutcome[]> {
  const outcomes: ApprovedClassAMaterializationOutcome[] = [];
  for (const installmentId of approvedInstallmentIds) {
    const installment = installments.find((item) => item.id === installmentId);
    if (
      !installment ||
      scheduleItems.some((item) => item.installmentId === installmentId)
    ) {
      outcomes.push({ installmentId, status: "skipped" });
      continue;
    }
    const classification = classifyLegacyInstallmentForMaterialization({
      installment,
      invoiceEvents,
    });
    if (
      classification.kind !== "materializable" ||
      classification.conditional
    ) {
      outcomes.push({ installmentId, status: "skipped" });
      continue;
    }
    try {
      assertManualScheduleReviewComplete(
        installment,
        classification.schedule,
        invoiceEvents,
        settlementEvents,
        reimbursements,
      );
      const status = await materialize(installmentId, classification.schedule);
      outcomes.push({ installmentId, status });
    } catch {
      outcomes.push({ installmentId, status: "failed" });
    }
  }
  return outcomes;
}
