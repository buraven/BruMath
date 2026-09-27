import assert from "node:assert/strict";
import test from "node:test";
import type { Installment, InstallmentScheduleItem } from "../app/AppTypes";
import {
  futureInstallmentScheduleItems,
  isInstallmentScheduleItemHistorical,
} from "./installmentScheduleHistory";

const plan: Installment = {
  id: 31,
  title: "Curso",
  category: "Educação",
  who: "Bruna",
  amount: 50,
  totalInstallments: 3,
  paidInstallments: 2,
  nextDue: "2026-09-10",
};
const item = (
  number: number,
  dueDate = "2026-09-10",
): InstallmentScheduleItem => ({
  id: `installment:31:${number}`,
  installmentId: 31,
  installmentNumber: number,
  totalInstallments: 3,
  amount: 50,
  dueDate,
  status: "scheduled",
});

test("only explicit X/Y events protect a schedule item", () => {
  const first = item(1, "2020-01-10");
  assert.equal(isInstallmentScheduleItemHistorical(first, {}), false);
  assert.equal(
    isInstallmentScheduleItemHistorical(first, {
      installmentSettlementEvents: [
        {
          id: "settlement:31:1",
          installmentId: 31,
          installmentNumber: 1,
          amount: 50,
          settledAt: "2026-09-10",
          type: "regular",
        },
      ],
    }),
    true,
  );
  assert.equal(
    isInstallmentScheduleItemHistorical(first, {
      installmentInvoiceEvents: [
        {
          id: 1,
          installmentId: 31,
          installmentNumber: 2,
          cardId: 9,
          referenceMonth: "2026-09",
          amount: 50,
          type: "anticipated",
        },
      ],
    }),
    false,
  );
});

test("future schedule items are selected by explicit X/Y facts, never paidInstallments", () => {
  const items = [item(3), item(1), item(2)];
  assert.deepEqual(
    futureInstallmentScheduleItems(plan, items, {
      installmentSettlementEvents: [
        {
          id: "settlement:31:2",
          installmentId: 31,
          installmentNumber: 2,
          amount: 50,
          settledAt: "2026-09-10",
          type: "anticipated",
        },
      ],
    }).map((candidate) => candidate.installmentNumber),
    [1, 3],
  );
});
