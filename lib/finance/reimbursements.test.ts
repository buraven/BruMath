import assert from "node:assert/strict";
import test from "node:test";
import {
  deriveReimbursementProjection,
  markReimbursementDue,
} from "./reimbursements";

const future = {
  id: 1,
  installmentId: 9,
  person: "Terceiro",
  installmentNumber: 3,
  amount: 200,
  expectedMonth: "2026-10",
  status: "future" as const,
};

test("a reimbursement amount is independent from the card installment and future is not a current debt", () => {
  const projection = deriveReimbursementProjection([future], []);
  assert.equal(projection.currentAmount, 0);
  assert.equal(projection.futureAmount, 200);
});

test("future to due is explicit and idempotent, while received/cancelled are never pending", () => {
  const due = markReimbursementDue(future, 8);
  assert.deepEqual(markReimbursementDue(due, 8), due);
  assert.equal(
    deriveReimbursementProjection(
      [due],
      [
        {
          id: 8,
          person: "Terceiro",
          amount: 200,
          paid: 0,
          destination: "casal",
          note: "",
          month: "2026-10",
        },
      ],
    ).currentAmount,
    200,
  );
  assert.equal(
    deriveReimbursementProjection([{ ...due, status: "received" }], [])
      .currentAmount,
    0,
  );
  assert.equal(
    deriveReimbursementProjection([{ ...future, status: "cancelled" }], [])
      .futureAmount,
    0,
  );
});
