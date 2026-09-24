import assert from "node:assert/strict";
import test from "node:test";
import { INITIAL_INSTALLMENTS } from "../../features/app/defaultFinancialData";
import type { CreditCard, Expense, Installment } from "../app/AppTypes";
import { deriveCalendarProjection, getCalendarItemsForDate } from "./calendar";

const card: CreditCard = {
  id: 1,
  name: "Nubank",
  owner: "Bruna",
  creditLimit: 1_000,
  closingDay: 20,
  dueDay: 10,
  active: true,
};

const expense = (overrides: Partial<Expense> = {}): Expense => ({
  id: 1,
  title: "Café",
  cat: "Alimentação",
  who: "Bruna",
  amount: 100,
  date: "2026-08-10",
  creditCardId: card.id,
  ...overrides,
});

test("projects historical transactions and installments without persisting a parallel event", () => {
  const installment: Installment = {
    id: 2,
    title: "Notebook",
    category: "Trabalho",
    who: "Bruna",
    amount: 200,
    totalInstallments: 5,
    paidInstallments: 1,
    nextDue: "2026-09-15",
  };
  const projection = deriveCalendarProjection({
    month: "2026-09",
    profile: "Bruna",
    expenses: [expense({ date: "2026-09-05" })],
    incomeEntries: [
      {
        id: 3,
        title: "Freela",
        amount: 500,
        who: "Bruna",
        date: "2026-09-09",
        destination: "conta",
        note: "",
      },
    ],
    installments: [installment],
    cards: [],
    payments: [],
    baseBalance: 1_000,
  });

  assert.deepEqual(
    projection.items.map((item) => item.type),
    ["expense", "income", "installment_due"],
  );
  assert.equal(projection.items[0]?.sourceId, 1);
  assert.equal(projection.forecast.knownFutureCommitments, 200);
  assert.equal(projection.forecast.projectedBalance, 800);
});

test("counts the versioned Hocks September installment exactly once in commitments and forecast", () => {
  const hocks = INITIAL_INSTALLMENTS.find((item) => item.title === "Hocks");
  assert.ok(hocks);
  assert.equal(hocks.nextDue, "2026-09-15");

  const projection = deriveCalendarProjection({
    month: "2026-09",
    profile: "Bruna",
    expenses: [],
    incomeEntries: [],
    installments: [hocks],
    cards: [],
    payments: [],
    baseBalance: 1_000,
  });

  const hocksItems = projection.items.filter(
    (item) => item.type === "installment_due" && item.sourceId === hocks.id,
  );
  assert.equal(hocksItems.length, 1);
  assert.equal(hocksItems[0]?.amount, 89.9);
  assert.equal(projection.forecast.knownFutureCommitments, 89.9);
  assert.equal(projection.forecast.projectedBalance, 910.1);
});

test("respects Bruna, Matheus and Casal profile scope", () => {
  const expenses = [
    expense({ id: 1, who: "Bruna", creditCardId: undefined }),
    expense({ id: 2, who: "Matheus", creditCardId: undefined }),
    expense({ id: 3, who: "Casal", creditCardId: undefined }),
  ];
  const base = {
    month: "2026-08",
    incomeEntries: [],
    installments: [],
    cards: [],
    payments: [],
    baseBalance: 0,
  } as const;
  assert.equal(
    deriveCalendarProjection({ ...base, profile: "Bruna", expenses }).items
      .length,
    1,
  );
  assert.equal(
    deriveCalendarProjection({ ...base, profile: "Matheus", expenses }).items
      .length,
    1,
  );
  assert.equal(
    deriveCalendarProjection({ ...base, profile: "Casal", expenses }).items
      .length,
    3,
  );
});

test("keeps only the visible competence and exposes a usable empty projection", () => {
  const base = {
    profile: "Bruna" as const,
    incomeEntries: [],
    installments: [],
    cards: [],
    payments: [],
    baseBalance: 0,
  };
  const september = deriveCalendarProjection({
    ...base,
    month: "2026-09",
    expenses: [expense({ date: "2026-09-30", creditCardId: undefined })],
  });
  assert.equal(september.items.length, 1);
  assert.equal(
    deriveCalendarProjection({
      ...base,
      month: "2026-10",
      expenses: [expense({ date: "2026-09-30", creditCardId: undefined })],
    }).items.length,
    0,
  );
});

test("finds an adjacent invoice cycle due in the visible month without duplicating its purchase", () => {
  const projection = deriveCalendarProjection({
    month: "2026-09",
    profile: "Bruna",
    expenses: [expense()],
    incomeEntries: [],
    installments: [],
    cards: [card],
    payments: [],
    baseBalance: 0,
  });

  const due = projection.items.find((item) => item.type === "invoice_due");
  assert.equal(due?.date, "2026-09-10");
  assert.equal(due?.amount, 100);
  assert.equal(
    projection.items.filter((item) => item.type === "expense").length,
    0,
  );
  assert.equal(projection.forecast.knownFutureCommitments, 100);
});

test("uses the invoice, not its card installment, as the calendar commitment", () => {
  const cardInstallment: Installment = {
    id: 9,
    title: "Mercado Livre",
    category: "Casa",
    who: "Bruna",
    amount: 153.75,
    totalInstallments: 10,
    paidInstallments: 2,
    nextDue: "2026-09-20",
    creditCardId: card.id,
  };
  const projection = deriveCalendarProjection({
    month: "2026-10",
    profile: "Bruna",
    expenses: [],
    incomeEntries: [],
    installments: [cardInstallment],
    cards: [card],
    payments: [],
    baseBalance: 1_000,
  });

  assert.equal(
    projection.items.filter((item) => item.type === "installment_due").length,
    0,
  );
  const invoice = projection.items.find((item) => item.type === "invoice_due");
  assert.equal(invoice?.date, "2026-10-10");
  assert.equal(invoice?.amount, 153.75);
  assert.equal(projection.forecast.knownFutureCommitments, 153.75);
});

test("does not subtract a same-month card purchase twice through its invoice", () => {
  const projection = deriveCalendarProjection({
    month: "2026-09",
    profile: "Bruna",
    expenses: [expense({ date: "2026-09-10" })],
    incomeEntries: [],
    installments: [],
    cards: [{ ...card, dueDay: 27 }],
    payments: [],
    baseBalance: 900,
  });

  assert.equal(
    projection.items.find((item) => item.type === "invoice_due")?.amount,
    100,
  );
  assert.equal(projection.forecast.knownFutureCommitments, 0);
  assert.equal(projection.forecast.projectedBalance, 900);
});

test("keeps a cardless installment as its own commitment", () => {
  const projection = deriveCalendarProjection({
    month: "2026-09",
    profile: "Bruna",
    expenses: [],
    incomeEntries: [],
    installments: [
      {
        id: 10,
        title: "Curso",
        category: "Educação",
        who: "Bruna",
        amount: 90,
        totalInstallments: 2,
        paidInstallments: 0,
        nextDue: "2026-09-15",
      },
    ],
    cards: [],
    payments: [],
    baseBalance: 1_000,
  });

  assert.equal(
    projection.items.filter((item) => item.type === "installment_due").length,
    1,
  );
  assert.equal(projection.forecast.knownFutureCommitments, 90);
});

test("a paid invoice no longer consumes future commitments", () => {
  const projection = deriveCalendarProjection({
    month: "2026-09",
    profile: "Bruna",
    expenses: [expense()],
    incomeEntries: [],
    installments: [],
    cards: [card],
    payments: [
      {
        id: 11,
        cardId: card.id,
        referenceMonth: "2026-08",
        paidAt: "2026-09-10",
        amount: 100,
      },
    ],
    baseBalance: 1_000,
  });

  assert.equal(projection.forecast.knownFutureCommitments, 0);
  assert.equal(
    projection.items.find((item) => item.type === "invoice_due")?.status,
    "paid",
  );
});

test("shows an empty invoice closing as an operational marker, never a debt", () => {
  const projection = deriveCalendarProjection({
    month: "2026-02",
    profile: "Bruna",
    expenses: [],
    incomeEntries: [],
    installments: [],
    cards: [{ ...card, closingDay: 31, dueDay: 31 }],
    payments: [],
    baseBalance: 0,
  });
  const closing = projection.items.find(
    (item) => item.type === "invoice_closing",
  );
  assert.equal(closing?.date, "2026-02-28");
  assert.equal(closing?.status, "in_progress");
  assert.equal(
    projection.items.some((item) => item.type === "invoice_due"),
    false,
  );
});

test("keeps due dates correct across December, January and leap February", () => {
  const decemberPurchase = expense({ date: "2026-12-21" });
  const january = deriveCalendarProjection({
    month: "2027-01",
    profile: "Bruna",
    expenses: [decemberPurchase],
    incomeEntries: [],
    installments: [],
    cards: [{ ...card, dueDay: 31 }],
    payments: [],
    baseBalance: 0,
  });
  assert.equal(
    january.items.find((item) => item.type === "invoice_due")?.date,
    "2027-01-31",
  );

  const february = deriveCalendarProjection({
    month: "2028-02",
    profile: "Bruna",
    expenses: [expense({ date: "2028-01-21" })],
    incomeEntries: [],
    installments: [],
    cards: [{ ...card, dueDay: 31 }],
    payments: [],
    baseBalance: 0,
  });
  assert.equal(
    february.items.find((item) => item.type === "invoice_due")?.date,
    "2028-02-29",
  );
});

test("a paid invoice changes status without creating another financial item", () => {
  const projection = deriveCalendarProjection({
    month: "2026-09",
    profile: "Bruna",
    expenses: [expense()],
    incomeEntries: [],
    installments: [],
    cards: [card],
    payments: [
      {
        id: 1,
        cardId: card.id,
        referenceMonth: "2026-08",
        paidAt: "2026-09-10",
        amount: 100,
      },
    ],
    baseBalance: 0,
  });
  const due = getCalendarItemsForDate(projection, "2026-09-10").find(
    (item) => item.type === "invoice_due",
  );
  assert.equal(due?.status, "paid");
  assert.equal(
    projection.items.filter((item) => item.type === "invoice_due").length,
    1,
  );
});
