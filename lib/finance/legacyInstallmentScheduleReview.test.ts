import assert from "node:assert/strict";
import test from "node:test";
import type { Installment } from "../app/AppTypes";
import {
  classifyLegacyInstallmentForMaterialization,
  assertManualScheduleReviewComplete,
  materializeDeterministicLegacySchedules,
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
  if (result.kind === "materializable") assert.equal(result.schedule.length, 3);
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
  });
  assert.equal(applied.applied, 3);
  const rerun = materializeDeterministicLegacySchedules({
    ...input,
    scheduleItems: applied.scheduleItems,
    apply: true,
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
    { kind: "review_required", reason: "ambiguous_history" },
  );
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
