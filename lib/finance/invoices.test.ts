import assert from "node:assert/strict";
import test from "node:test";
import type { CreditCard, Expense, Installment } from "../app/AppTypes";
import {
  deriveInvoices,
  filterInvoices,
  registerInvoicePayment,
  resolveInvoiceDueDate,
  resolveInvoiceReferenceMonth,
} from "./invoices";

const card: CreditCard = {
  id: 1,
  name: "Nubank Bruna",
  owner: "Bruna",
  creditLimit: 1_000,
  closingDay: 20,
  dueDay: 27,
  active: true,
};

const expense = (overrides: Partial<Expense> = {}): Expense => ({
  id: 1,
  title: "Almoço",
  cat: "Alimentação",
  who: "Bruna",
  amount: 100,
  date: "2026-08-20",
  creditCardId: 1,
  ...overrides,
});

test("assigns purchases to the invoice cycle instead of the purchase month", () => {
  assert.equal(resolveInvoiceReferenceMonth("2026-08-20", 20), "2026-08");
  assert.equal(resolveInvoiceReferenceMonth("2026-08-21", 20), "2026-09");
  assert.equal(resolveInvoiceDueDate(card, "2026-08"), "2026-08-27");
});

test("derives one invoice from linked expenses without changing expense totals", () => {
  const invoices = deriveInvoices({
    cards: [card],
    expenses: [
      expense(),
      expense({
        id: 2,
        amount: 50,
        cat: "Pessoal",
        personalLimitBucket: "bruna_personal",
      }),
    ],
    payments: [],
    profile: "Bruna",
    referenceMonth: "2026-08",
  });
  assert.equal(invoices.length, 1);
  assert.equal(invoices[0]?.total, 150);
  assert.equal(invoices[0]?.expenses.length, 2);
  assert.equal(
    invoices[0]?.categoryTotals.find((item) => item.category === "Alimentação")
      ?.amount,
    100,
  );
  assert.equal(
    invoices[0]?.categoryTotals.find((item) => item.category === "Pessoal")
      ?.amount,
    50,
  );
});

test("keeps ownership scope while cards remain visible without purchases", () => {
  const cards = [
    card,
    { ...card, id: 2, name: "Nubank Matheus", owner: "Matheus" as const },
  ];
  assert.equal(
    deriveInvoices({
      cards,
      expenses: [expense()],
      payments: [],
      profile: "Matheus",
      referenceMonth: "2026-08",
    })[0]?.card.id,
    2,
  );
  assert.equal(
    deriveInvoices({
      cards,
      expenses: [expense()],
      payments: [],
      profile: "Casal",
      referenceMonth: "2026-08",
    }).length,
    2,
  );
  assert.equal(
    deriveInvoices({
      cards,
      expenses: [expense({ creditCardId: 2 })],
      payments: [],
      profile: "Matheus",
      referenceMonth: "2026-08",
    })[0]?.card.id,
    2,
  );
  assert.equal(
    deriveInvoices({
      cards,
      expenses: [expense({ creditCardId: undefined })],
      payments: [],
      profile: "Casal",
      referenceMonth: "2026-08",
    })[0]?.total,
    0,
  );
});

test("keeps a persisted card visible when its selected invoice is empty", () => {
  const [invoice] = deriveInvoices({
    cards: [card],
    expenses: [],
    payments: [],
    profile: "Bruna",
    referenceMonth: "2026-01",
  });

  assert.equal(invoice?.card.id, card.id);
  assert.equal(invoice?.total, 0);
  assert.equal(invoice?.expenses.length, 0);
  assert.equal(invoice?.status, "open");
});

test("adds a card installment to its cycle without manufacturing an expense", () => {
  const installment: Installment = {
    id: 9,
    title: "Notebook",
    category: "Trabalho",
    who: "Bruna",
    amount: 200,
    totalInstallments: 10,
    paidInstallments: 2,
    nextDue: "2026-08-19",
    creditCardId: 1,
  };
  const [invoice] = deriveInvoices({
    cards: [card],
    expenses: [],
    installments: [installment],
    payments: [],
    profile: "Bruna",
    referenceMonth: "2026-08",
  });
  assert.equal(invoice?.expenses.length, 0);
  assert.equal(invoice?.installments[0]?.currentInstallment, 3);
  assert.equal(invoice?.total, 200);
});

test("payment is derived state and does not add another purchase", () => {
  const [invoice] = deriveInvoices({
    cards: [card],
    expenses: [expense()],
    payments: [
      {
        id: 7,
        cardId: 1,
        referenceMonth: "2026-08",
        paidAt: "2026-08-27",
        amount: 100,
      },
    ],
    profile: "Bruna",
    referenceMonth: "2026-08",
  });
  assert.equal(invoice?.status, "paid");
  assert.equal(invoice?.total, 100);
  assert.equal(invoice?.expenses.length, 1);
});

test("filters derived statuses and records a full payment once", () => {
  const [invoice] = deriveInvoices({
    cards: [card],
    expenses: [expense()],
    payments: [],
    profile: "Bruna",
    referenceMonth: "2026-08",
  });
  assert.ok(invoice);
  assert.equal(filterInvoices([invoice], "all").length, 1);
  assert.equal(filterInvoices([invoice], "due").length, 1);
  const payments = registerInvoicePayment([], invoice, "2026-08-27", 7);
  assert.equal(payments.length, 1);
  assert.equal(
    registerInvoicePayment(payments, invoice, "2026-08-27", 8).length,
    1,
  );
});

test("a cardless expense stays outside the invoice while a linked purchase is derived once", () => {
  const cardless = expense({ creditCardId: undefined });
  const linked = expense({ id: 2, amount: 25, creditCardId: card.id });
  const [invoice] = deriveInvoices({
    cards: [card],
    expenses: [cardless, linked],
    payments: [],
    profile: "Bruna",
    referenceMonth: "2026-08",
  });

  assert.equal(invoice?.total, 25);
  assert.deepEqual(
    invoice?.expenses.map((item) => item.id),
    [linked.id],
  );
  assert.equal(cardless.amount + linked.amount, 125);
});

test("editing a purchase date or card moves its derived invoice without creating another expense", () => {
  const secondCard: CreditCard = {
    ...card,
    id: 2,
    name: "Nubank Bruna reserva",
  };
  const original = expense({ date: "2026-08-20" });
  const moved = {
    ...original,
    creditCardId: secondCard.id,
    date: "2026-08-21",
  };

  const august = deriveInvoices({
    cards: [card, secondCard],
    expenses: [moved],
    payments: [],
    profile: "Bruna",
    referenceMonth: "2026-08",
  });
  const september = deriveInvoices({
    cards: [card, secondCard],
    expenses: [moved],
    payments: [],
    profile: "Bruna",
    referenceMonth: "2026-09",
  });

  assert.equal(august.find((invoice) => invoice.card.id === card.id)?.total, 0);
  assert.equal(
    august.find((invoice) => invoice.card.id === secondCard.id)?.total,
    0,
  );
  assert.equal(
    september.find((invoice) => invoice.card.id === secondCard.id)?.total,
    100,
  );
  assert.equal(september.flatMap((invoice) => invoice.expenses).length, 1);
});

test("deleting the linked expense clears its invoice and a zero invoice cannot be paid", () => {
  const [invoice] = deriveInvoices({
    cards: [card],
    expenses: [],
    payments: [],
    profile: "Bruna",
    referenceMonth: "2026-08",
  });

  assert.ok(invoice);
  assert.equal(invoice.total, 0);
  assert.deepEqual(registerInvoicePayment([], invoice, "2026-08-27", 7), []);
});
