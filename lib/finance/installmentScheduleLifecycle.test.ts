import assert from "node:assert/strict";
import test from "node:test";
import type { InstallmentScheduleItem } from "../app/AppTypes";
import { classifyInstallmentScheduleItem } from "./installmentScheduleLifecycle";

const item = (
  number: number,
  status: "scheduled" | "cancelled" = "scheduled",
) =>
  ({
    id: `installment:77:${number}`,
    installmentId: 77,
    installmentNumber: number,
    totalInstallments: 2,
    amount: 50,
    creditCardId: 9,
    invoiceReferenceMonth: number === 1 ? "2026-09" : "2026-10",
    status,
  }) satisfies InstallmentScheduleItem;

test("classifies explicit facts before the open invoice and never uses dates", () => {
  assert.equal(
    classifyInstallmentScheduleItem(item(1), {
      openInvoiceReferenceMonth: "2026-09",
      installmentInvoiceEvents: [
        {
          id: 1,
          installmentId: 77,
          installmentNumber: 1,
          cardId: 9,
          referenceMonth: "2026-09",
          amount: 50,
          type: "regular",
        },
      ],
    }),
    "historical",
  );
  assert.equal(
    classifyInstallmentScheduleItem(item(1), {
      openInvoiceReferenceMonth: "2026-09",
    }),
    "current_open_invoice",
  );
  assert.equal(
    classifyInstallmentScheduleItem(item(2), {
      openInvoiceReferenceMonth: "2026-09",
    }),
    "future",
  );
  assert.equal(
    classifyInstallmentScheduleItem(item(2, "cancelled"), {}),
    "cancelled",
  );
});

test("represents Fifa 27 as zero historical, one current invoice and one future", () => {
  const classes = [item(1), item(2)].map((scheduleItem) =>
    classifyInstallmentScheduleItem(scheduleItem, {
      openInvoiceReferenceMonth: "2026-09",
    }),
  );
  assert.deepEqual(classes, ["current_open_invoice", "future"]);
});
