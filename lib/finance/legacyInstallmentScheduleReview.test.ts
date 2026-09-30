import assert from "node:assert/strict";
import test from "node:test";
import type { Installment } from "../app/AppTypes";
import {
  classifyLegacyInstallmentForMaterialization,
  applyApprovedClassAMaterializations,
  assertManualScheduleReviewComplete,
  materializeDeterministicLegacySchedules,
  verifyClassAMaterializationReadOnly,
} from "./legacyInstallmentScheduleReview";

const plan: Installment = {
  id: 51,
  title: "Plano",
  category: "Casa",
  who: "Bruna",
  amount: 100,
  totalInstallments: 3,
  paidInstallments: 0,
  nextDue: "2026-09-30",
  creditCardId: 4,
};

test("materializes only deterministic legacy class A without history", () => {
  const result = classifyLegacyInstallmentForMaterialization({
    installment: plan,
    firstInvoiceReferenceMonth: "2026-09",
  });
  assert.equal(result.kind, "materializable");
  if (result.kind === "materializable") {
    assert.equal(result.schedule.length, 3);
    assert.equal(result.conditional, true);
  }
});

test("dry-run never writes and explicit class-A application is idempotent", () => {
  const input = {
    installments: [plan],
    scheduleItems: [],
    firstInvoiceReferenceMonth: () => "2026-09",
  };
  const dryRun = materializeDeterministicLegacySchedules(input);
  assert.deepEqual(
    {
      materializable: dryRun.materializable,
      applied: dryRun.applied,
      items: dryRun.scheduleItems.length,
    },
    { materializable: 1, applied: 0, items: 0 },
  );
  const applied = materializeDeterministicLegacySchedules({
    ...input,
    apply: true,
    approvedInstallmentIds: [plan.id],
    includeConditionallyResolved: true,
  });
  assert.equal(applied.applied, 3);
  const rerun = materializeDeterministicLegacySchedules({
    ...input,
    scheduleItems: applied.scheduleItems,
    apply: true,
    approvedInstallmentIds: [plan.id],
    includeConditionallyResolved: true,
  });
  assert.deepEqual(
    {
      already: rerun.alreadyScheduled,
      applied: rerun.applied,
      items: rerun.scheduleItems.length,
    },
    { already: 1, applied: 0, items: 3 },
  );
});

test("does not promote a paidInstallments counter without explicit X/Y facts", () => {
  assert.deepEqual(
    classifyLegacyInstallmentForMaterialization({
      installment: { ...plan, paidInstallments: 1 },
      firstInvoiceReferenceMonth: "2026-09",
    }),
    { kind: "review_required", class: "C", reason: "ambiguous_history" },
  );
});

test("reports A/B/C operationally and never applies a conditioned card plan by default", () => {
  const conditional = materializeDeterministicLegacySchedules({
    installments: [plan],
    scheduleItems: [],
    firstInvoiceReferenceMonth: () => "2026-09",
    apply: true,
    approvedInstallmentIds: [plan.id],
  });
  assert.deepEqual(
    {
      unconditionalA: conditional.unconditionalA,
      conditionalA: conditional.conditionalA,
      applied: conditional.applied,
    },
    { unconditionalA: 0, conditionalA: 1, applied: 0 },
  );

  const missingResolver = classifyLegacyInstallmentForMaterialization({
    installment: plan,
  });
  assert.deepEqual(missingResolver, {
    kind: "review_required",
    class: "A_conditional",
    reason: "insufficient_structure",
  });

  const explicitFactsButConflict = classifyLegacyInstallmentForMaterialization({
    installment: { ...plan, paidInstallments: 1 },
    invoiceEvents: [
      {
        id: 1,
        installmentId: plan.id,
        installmentNumber: 2,
        cardId: plan.creditCardId!,
        referenceMonth: "2026-09",
        amount: plan.amount,
        type: "historical",
      },
    ],
  });
  assert.deepEqual(explicitFactsButConflict, {
    kind: "review_required",
    class: "B",
    reason: "ambiguous_history",
  });
});

test("requires explicit approval and skips a plan whose facts conflict at application time", () => {
  assert.throws(() =>
    materializeDeterministicLegacySchedules({
      installments: [{ ...plan, creditCardId: undefined }],
      scheduleItems: [],
      apply: true,
    }),
  );
  const result = materializeDeterministicLegacySchedules({
    installments: [{ ...plan, creditCardId: undefined }],
    scheduleItems: [],
    settlementEvents: [
      {
        id: "settlement:51:1",
        installmentId: plan.id,
        installmentNumber: 9,
        amount: plan.amount,
        settledAt: "2026-09-30",
        type: "regular",
      },
    ],
    apply: true,
    approvedInstallmentIds: [plan.id],
  });
  assert.deepEqual(
    {
      applied: result.applied,
      classB: result.classB,
      scheduleItems: result.scheduleItems.length,
    },
    { applied: 0, classB: 1, scheduleItems: 0 },
  );
});

test("read-only post-check accepts only the approved complete Class-A schedule", () => {
  const materialized = materializeDeterministicLegacySchedules({
    installments: [{ ...plan, creditCardId: undefined }],
    scheduleItems: [],
    apply: true,
    approvedInstallmentIds: [plan.id],
  });
  assert.deepEqual(
    verifyClassAMaterializationReadOnly({
      installments: [{ ...plan, creditCardId: undefined }],
      scheduleItems: materialized.scheduleItems,
      approvedInstallmentIds: [plan.id],
      baselineFactCounts: {
        invoiceEvents: 0,
        settlements: 0,
        reimbursements: 0,
      },
    }),
    {
      approved: 1,
      completeAndReconciled: 1,
      rejected: 0,
      unexpectedSchedulePlans: 0,
      invoiceEventsUnchanged: true,
      settlementsUnchanged: true,
      reimbursementsUnchanged: true,
    },
  );
});

test("read-only post-check rejects a partial or out-of-scope schedule", () => {
  const materialized = materializeDeterministicLegacySchedules({
    installments: [{ ...plan, creditCardId: undefined }],
    scheduleItems: [],
    apply: true,
    approvedInstallmentIds: [plan.id],
  });
  const partial = materialized.scheduleItems.slice(0, 2);
  assert.deepEqual(
    verifyClassAMaterializationReadOnly({
      installments: [{ ...plan, creditCardId: undefined }],
      scheduleItems: [
        ...partial,
        { ...partial[0], installmentId: 99, id: "unexpected:99:1" },
      ],
      approvedInstallmentIds: [plan.id],
      baselineFactCounts: {
        invoiceEvents: 1,
        settlements: 0,
        reimbursements: 0,
      },
    }),
    {
      approved: 1,
      completeAndReconciled: 0,
      rejected: 1,
      unexpectedSchedulePlans: 1,
      invoiceEventsUnchanged: false,
      settlementsUnchanged: true,
      reimbursementsUnchanged: true,
    },
  );
});

test("apply executor sends only unconditional approved plans to its narrow boundary", async () => {
  const calls: number[] = [];
  const outcomes = await applyApprovedClassAMaterializations({
    installments: [
      { ...plan, creditCardId: undefined },
      { ...plan, id: 52 },
    ],
    scheduleItems: [],
    approvedInstallmentIds: [51, 52],
    materialize: async (installmentId) => {
      calls.push(installmentId);
      return "applied";
    },
  });
  assert.deepEqual(calls, [51]);
  assert.deepEqual(outcomes, [
    { installmentId: 51, status: "applied" },
    { installmentId: 52, status: "skipped" },
  ]);
});

test("manual review rejects any schedule that contradicts canonical settlement or reimbursement X/Y", () => {
  const classification = classifyLegacyInstallmentForMaterialization({
    installment: plan,
    firstInvoiceReferenceMonth: "2026-09",
  });
  assert.equal(classification.kind, "materializable");
  if (classification.kind !== "materializable") return;

  assert.doesNotThrow(() =>
    assertManualScheduleReviewComplete(
      plan,
      classification.schedule,
      [],
      [
        {
          id: "settlement:51:1",
          installmentId: 51,
          installmentNumber: 1,
          amount: 100,
          settledAt: "2026-09-30",
          type: "regular",
        },
      ],
      [
        {
          id: 1,
          installmentId: 51,
          installmentNumber: 2,
          person: "Bruna",
          amount: 100,
          expectedMonth: "2026-10",
          status: "future",
        },
      ],
    ),
  );
  assert.throws(() =>
    assertManualScheduleReviewComplete(
      plan,
      classification.schedule,
      [],
      [
        {
          id: "settlement:51:9",
          installmentId: 51,
          installmentNumber: 3,
          amount: 99,
          settledAt: "2026-11-30",
          type: "regular",
        },
      ],
    ),
  );
});
