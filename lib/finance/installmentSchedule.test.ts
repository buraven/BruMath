import assert from "node:assert/strict";
import test from "node:test";
import { generateInstallmentSchedule } from "./installmentSchedule";

test("generates one deterministic schedule item", () => {
  assert.deepEqual(
    generateInstallmentSchedule({
      installmentId: 9,
      totalAmount: 50,
      totalInstallments: 1,
      firstInvoiceReferenceMonth: "2026-09",
      firstDueDate: "2026-09-30",
      creditCardId: 3,
    }),
    [
      {
        id: "installment:9:1",
        installmentId: 9,
        installmentNumber: 1,
        totalInstallments: 1,
        amount: 50,
        invoiceReferenceMonth: "2026-09",
        dueDate: "2026-09-30",
        creditCardId: 3,
        status: "scheduled",
      },
    ],
  );
});

test("splits cents exactly and advances competence through a year boundary", () => {
  const schedule = generateInstallmentSchedule({
    installmentId: 7,
    totalAmount: 100,
    totalInstallments: 3,
    firstInvoiceReferenceMonth: "2026-11",
    firstDueDate: "2026-11-30",
  });
  assert.deepEqual(
    schedule.map((item) => item.amount),
    [33.34, 33.33, 33.33],
  );
  assert.equal(
    schedule.reduce((sum, item) => sum + Math.round(item.amount * 100), 0),
    10_000,
  );
  assert.deepEqual(
    schedule.map((item) => item.invoiceReferenceMonth),
    ["2026-11", "2026-12", "2027-01"],
  );
  assert.deepEqual(
    schedule.map((item) => item.dueDate),
    ["2026-11-30", "2026-12-30", "2027-01-30"],
  );
  assert.equal(new Set(schedule.map((item) => item.id)).size, 3);
});

test("caps monthly due dates and supports schedules without a card", () => {
  const schedule = generateInstallmentSchedule({
    installmentId: 2,
    totalAmount: 10,
    totalInstallments: 2,
    firstDueDate: "2026-01-31",
  });
  assert.deepEqual(
    schedule.map((item) => item.dueDate),
    ["2026-01-31", "2026-02-28"],
  );
  assert.equal("creditCardId" in schedule[0], false);
});

test("rejects invalid financial inputs", () => {
  assert.throws(() =>
    generateInstallmentSchedule({
      installmentId: 1,
      totalAmount: 10,
      totalInstallments: 0,
      firstInvoiceReferenceMonth: "2026-09",
    }),
  );
  assert.throws(() =>
    generateInstallmentSchedule({
      installmentId: 1,
      totalAmount: 1.001,
      totalInstallments: 1,
      firstInvoiceReferenceMonth: "2026-09",
    }),
  );
  assert.throws(() =>
    generateInstallmentSchedule({
      installmentId: 1,
      totalAmount: 1,
      totalInstallments: 1,
    }),
  );
});
