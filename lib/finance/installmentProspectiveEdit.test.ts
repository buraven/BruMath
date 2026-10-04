import assert from "node:assert/strict";
import test from "node:test";
import type {
  Installment,
  InstallmentInvoiceEvent,
  InstallmentScheduleItem,
  InstallmentSettlementEvent,
} from "../app/AppTypes";
import { applyProspectiveInstallmentEdit } from "./installmentProspectiveEdit";

const plan = (overrides: Partial<Installment> = {}): Installment => ({
  id: 70,
  title: "Notebook",
  category: "Trabalho",
  who: "Bruna",
  amount: 100,
  totalInstallments: 6,
  paidInstallments: 0,
  nextDue: "2026-09-10",
  creditCardId: 4,
  ...overrides,
});

const schedule = (total = 6): InstallmentScheduleItem[] =>
  Array.from({ length: total }, (_, index) => {
    const number = index + 1;
    const month = 9 + index;
    const date = new Date(2026, month - 1, 1);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    return {
      id: `installment:70:${number}`,
      installmentId: 70,
      installmentNumber: number,
      totalInstallments: total,
      amount: 100,
      invoiceReferenceMonth: key,
      dueDate: `${key}-10`,
      creditCardId: 4,
      status: "scheduled",
    };
  });

const settled = (number: number): InstallmentSettlementEvent => ({
  id: `settlement:70:${number}`,
  installmentId: 70,
  installmentNumber: number,
  amount: 100,
  settledAt: "2026-10-10",
  type: "regular",
});

test("edits all future value exactly when a complete plan has no history", () => {
  const result = applyProspectiveInstallmentEdit({
    installment: plan(),
    scheduleItems: schedule(),
    historyFacts: {},
    edit: { futureTotalAmount: 100 },
  });
  assert.deepEqual(
    result.scheduleItems.map((item) => item.amount),
    [16.67, 16.67, 16.67, 16.67, 16.66, 16.66],
  );
  assert.equal(
    result.scheduleItems.reduce(
      (sum, item) => sum + Math.round(item.amount * 100),
      0,
    ),
    10_000,
  );
});

test("keeps historical schedule fields and explicit facts byte-for-byte while repricing only future", () => {
  const original = schedule();
  const settlementEvents = [settled(1)];
  const invoiceEvents: InstallmentInvoiceEvent[] = [
    {
      id: 2,
      installmentId: 70,
      installmentNumber: 2,
      cardId: 4,
      referenceMonth: "2026-10",
      amount: 100,
      type: "regular",
      date: "2026-10-10",
    },
  ];
  const result = applyProspectiveInstallmentEdit({
    installment: plan(),
    scheduleItems: original,
    historyFacts: {
      installmentSettlementEvents: settlementEvents,
      installmentInvoiceEvents: invoiceEvents,
    },
    edit: { futureTotalAmount: 360 },
  });
  assert.deepEqual(result.scheduleItems.slice(0, 2), original.slice(0, 2));
  assert.deepEqual(settlementEvents, [settled(1)]);
  assert.deepEqual(invoiceEvents, [
    {
      id: 2,
      installmentId: 70,
      installmentNumber: 2,
      cardId: 4,
      referenceMonth: "2026-10",
      amount: 100,
      type: "regular",
      date: "2026-10-10",
    },
  ]);
  assert.equal(
    result.scheduleItems.slice(2).reduce((sum, item) => sum + item.amount, 0),
    360,
  );
});

test("can increase or reduce only the contiguous future tail without renumbering history", () => {
  const base = {
    installment: plan(),
    scheduleItems: schedule(),
    historyFacts: { installmentSettlementEvents: [settled(1), settled(2)] },
  };
  const expanded = applyProspectiveInstallmentEdit({
    ...base,
    edit: { futureInstallmentCount: 6, futureTotalAmount: 600 },
  });
  assert.deepEqual(
    expanded.scheduleItems.map((item) => item.installmentNumber),
    [1, 2, 3, 4, 5, 6, 7, 8],
  );
  assert.deepEqual(expanded.scheduleItems.slice(0, 2), schedule().slice(0, 2));
  assert.equal(expanded.installment.totalInstallments, 8);
  const reduced = applyProspectiveInstallmentEdit({
    ...base,
    edit: { futureInstallmentCount: 2, futureTotalAmount: 199.99 },
  });
  assert.deepEqual(
    reduced.scheduleItems.map((item) => item.installmentNumber),
    [1, 2, 3, 4],
  );
  assert.equal(
    reduced.scheduleItems
      .slice(2)
      .reduce((sum, item) => sum + Math.round(item.amount * 100), 0),
    19_999,
  );
  assert.equal(reduced.installment.totalInstallments, 4);
});

test("recalculates only the future sequence for competence, due date and card", () => {
  const result = applyProspectiveInstallmentEdit({
    installment: plan(),
    scheduleItems: schedule(),
    historyFacts: { installmentSettlementEvents: [settled(1), settled(2)] },
    edit: {
      firstFutureInvoiceReferenceMonth: "2026-11",
      firstFutureDueDate: "2026-11-30",
      futureCreditCardId: 9,
    },
  });
  assert.deepEqual(result.scheduleItems.slice(0, 2), schedule().slice(0, 2));
  assert.deepEqual(
    result.scheduleItems.slice(2).map((item) => item.invoiceReferenceMonth),
    ["2026-11", "2026-12", "2027-01", "2027-02"],
  );
  assert.deepEqual(
    result.scheduleItems.slice(2).map((item) => item.dueDate),
    ["2026-11-30", "2026-12-30", "2027-01-30", "2027-02-28"],
  );
  assert.deepEqual(
    result.scheduleItems.slice(2).map((item) => item.creditCardId),
    [9, 9, 9, 9],
  );
});

test("allows plan metadata corrections but rejects financial edits after all items are historical", () => {
  const facts = {
    installmentSettlementEvents: schedule().map((item) =>
      settled(item.installmentNumber),
    ),
  };
  const metadata = applyProspectiveInstallmentEdit({
    installment: plan(),
    scheduleItems: schedule(),
    historyFacts: facts,
    edit: {
      title: "Notebook do trabalho",
      category: "Equipamentos",
      who: "Casal",
    },
  });
  assert.equal(metadata.installment.title, "Notebook do trabalho");
  assert.equal(metadata.installment.category, "Equipamentos");
  assert.equal(metadata.installment.who, "Casal");
  assert.throws(() =>
    applyProspectiveInstallmentEdit({
      installment: plan(),
      scheduleItems: schedule(),
      historyFacts: facts,
      edit: { futureTotalAmount: 1 },
    }),
  );
});

test("edits non-contiguous future X/Y items without changing protected items or facts", () => {
  const original = schedule();
  const settlementEvents = [settled(1), settled(4)];
  const invoiceEvents: InstallmentInvoiceEvent[] = [
    {
      id: 2,
      installmentId: 70,
      installmentNumber: 2,
      cardId: 4,
      referenceMonth: "2026-10",
      amount: 100,
      type: "regular",
      date: "2026-10-10",
    },
  ];
  const result = applyProspectiveInstallmentEdit({
    installment: plan(),
    scheduleItems: original,
    historyFacts: {
      installmentSettlementEvents: settlementEvents,
      installmentInvoiceEvents: invoiceEvents,
    },
    edit: {
      futureTotalAmount: 270,
      futureCreditCardId: 9,
      firstFutureInvoiceReferenceMonth: "2027-01",
      firstFutureDueDate: "2027-01-31",
    },
  });

  for (const number of [1, 2, 4]) {
    assert.deepEqual(
      result.scheduleItems.find((item) => item.installmentNumber === number),
      original.find((item) => item.installmentNumber === number),
    );
  }
  assert.deepEqual(
    result.scheduleItems
      .filter((item) => [3, 5, 6].includes(item.installmentNumber))
      .map((item) => ({
        number: item.installmentNumber,
        amount: item.amount,
        month: item.invoiceReferenceMonth,
        dueDate: item.dueDate,
        cardId: item.creditCardId,
      })),
    [
      {
        number: 3,
        amount: 90,
        month: "2027-01",
        dueDate: "2027-01-31",
        cardId: 9,
      },
      {
        number: 5,
        amount: 90,
        month: "2027-02",
        dueDate: "2027-02-28",
        cardId: 9,
      },
      {
        number: 6,
        amount: 90,
        month: "2027-03",
        dueDate: "2027-03-31",
        cardId: 9,
      },
    ],
  );
  assert.deepEqual(settlementEvents, [settled(1), settled(4)]);
  assert.deepEqual(invoiceEvents, [
    {
      id: 2,
      installmentId: 70,
      installmentNumber: 2,
      cardId: 4,
      referenceMonth: "2026-10",
      amount: 100,
      type: "regular",
      date: "2026-10-10",
    },
  ]);
});

test("can resize non-contiguous future items without renumbering or reusing historical X/Y", () => {
  const facts = {
    installmentSettlementEvents: [settled(1), settled(2), settled(4)],
  };
  const reduced = applyProspectiveInstallmentEdit({
    installment: plan(),
    scheduleItems: schedule(),
    historyFacts: facts,
    edit: { futureInstallmentCount: 2, futureTotalAmount: 199.99 },
  });
  assert.deepEqual(
    reduced.scheduleItems.map((item) => item.installmentNumber),
    [1, 2, 3, 4, 5],
  );
  assert.deepEqual(
    reduced.scheduleItems.filter((item) =>
      [1, 2, 4].includes(item.installmentNumber),
    ),
    schedule().filter((item) => [1, 2, 4].includes(item.installmentNumber)),
  );

  const expanded = applyProspectiveInstallmentEdit({
    installment: plan(),
    scheduleItems: schedule(),
    historyFacts: facts,
    edit: { futureInstallmentCount: 4, futureTotalAmount: 400 },
  });
  assert.deepEqual(
    expanded.scheduleItems.map((item) => item.installmentNumber),
    [1, 2, 3, 4, 5, 6, 7],
  );
  assert.equal(
    expanded.scheduleItems.find((item) => item.installmentNumber === 7)?.id,
    "installment:70:7",
  );
  assert.deepEqual(
    expanded.scheduleItems.filter((item) =>
      [1, 2, 4].includes(item.installmentNumber),
    ),
    schedule().filter((item) => [1, 2, 4].includes(item.installmentNumber)),
  );
});

test("rejects an impossible non-contiguous reduction atomically", () => {
  const original = schedule();
  const facts = {
    installmentSettlementEvents: [settled(1), settled(2), settled(6)],
  };
  assert.throws(
    () =>
      applyProspectiveInstallmentEdit({
        installment: plan(),
        scheduleItems: original,
        historyFacts: facts,
        edit: { futureInstallmentCount: 2 },
      }),
    /sem remover uma parcela já consolidada/,
  );
  assert.deepEqual(original, schedule());
  assert.deepEqual(facts.installmentSettlementEvents, [
    settled(1),
    settled(2),
    settled(6),
  ]);
});

test("rejects legacy and incomplete schedules instead of guessing", () => {
  assert.throws(() =>
    applyProspectiveInstallmentEdit({
      installment: plan(),
      scheduleItems: [],
      historyFacts: {},
      edit: { futureTotalAmount: 20 },
    }),
  );
});

test("preserves the current open invoice item while editing only later future X/Y", () => {
  const currentAndFuture = schedule(2);
  const result = applyProspectiveInstallmentEdit({
    installment: plan({ totalInstallments: 2 }),
    scheduleItems: currentAndFuture,
    historyFacts: {},
    edit: {
      currentOpenInvoiceReferenceMonth: "2026-09",
      futureTotalAmount: 75,
      firstFutureInvoiceReferenceMonth: "2026-10",
      firstFutureDueDate: "2026-10-28",
      futureCreditCardId: 9,
    },
  });

  assert.deepEqual(result.scheduleItems[0], currentAndFuture[0]);
  assert.deepEqual(result.scheduleItems[1], {
    ...currentAndFuture[1],
    amount: 75,
    invoiceReferenceMonth: "2026-10",
    dueDate: "2026-10-28",
    creditCardId: 9,
  });
});
