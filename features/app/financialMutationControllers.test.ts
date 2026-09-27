import assert from "node:assert/strict";
import test from "node:test";
import {
  createExpenseIncomeMutations,
  createInstallmentMutations,
  createLimitMutations,
  createReceivableMutations,
} from "./financialMutationControllers";
import type {
  Confirmation,
  Debt,
  Expense,
  IncomeEntry,
  Installment,
  InstallmentInvoiceEvent,
  InstallmentScheduleItem,
  InstallmentSettlementEvent,
} from "../../lib/app/AppTypes";
import { DEFAULT_PERSONAL_LIMITS } from "../../lib/finance/personalLimits";

function setter<T>(initial: T) {
  let value = initial;
  return {
    set(next: T | ((current: T) => T)) {
      value =
        typeof next === "function" ? (next as (current: T) => T)(value) : next;
    },
    get value() {
      return value;
    },
  };
}

test("manual expense and income mutations update the shared snapshot only after confirmation", () => {
  const expenses = setter([] as Expense[]);
  const income = setter([] as IncomeEntry[]);
  const confirmation = setter<Confirmation | null>(null);
  const toast = setter("");
  const controller = createExpenseIncomeMutations({
    expenses: expenses.value,
    incomeEntries: income.value,
    setExpenses: expenses.set,
    setIncomeEntries: income.set,
    setConfirmation: confirmation.set,
    setToast: toast.set,
  });
  controller.saveExpense(
    {
      id: 1,
      title: "Mercado",
      cat: "Alimentação",
      who: "Bruna",
      amount: 40,
      date: "2026-09-01",
      personalLimitBucket: "bruna_personal",
    },
    false,
  );
  assert.equal(expenses.value.length, 1);
  assert.equal(expenses.value[0]?.personalLimitBucket, "bruna_personal");
  controller.saveExpense(
    {
      ...expenses.value[0]!,
      personalLimitBucket: undefined,
    },
    true,
  );
  assert.equal(expenses.value[0]?.personalLimitBucket, undefined);
  createExpenseIncomeMutations({
    expenses: expenses.value,
    incomeEntries: income.value,
    setExpenses: expenses.set,
    setIncomeEntries: income.set,
    setConfirmation: confirmation.set,
    setToast: toast.set,
  }).deleteExpense(1);
  assert.equal(expenses.value.length, 1);
  confirmation.value?.onConfirm();
  assert.equal(expenses.value.length, 0);
});

test("scheduled cardless payments and advances append exact X/Y settlement facts", () => {
  const installments = setter<Installment[]>([
    {
      id: 8,
      title: "Curso",
      category: "Educação",
      who: "Bruna",
      amount: 33.34,
      totalInstallments: 3,
      paidInstallments: 0,
      nextDue: "2026-09-10",
    },
  ]);
  const settlementEvents = setter<InstallmentSettlementEvent[] | undefined>([]);
  const invoiceEvents = setter<InstallmentInvoiceEvent[]>([]);
  const confirmation = setter<Confirmation | null>(null);
  const toast = setter("");
  const schedule: InstallmentScheduleItem[] = [1, 2, 3].map(
    (installmentNumber) => ({
      id: `installment:8:${installmentNumber}`,
      installmentId: 8,
      installmentNumber,
      totalInstallments: 3,
      amount: installmentNumber === 1 ? 33.34 : 33.33,
      dueDate: `2026-${String(8 + installmentNumber).padStart(2, "0")}-10`,
      status: "scheduled",
    }),
  );
  const controller = createInstallmentMutations({
    installments: installments.value,
    installmentScheduleItems: schedule,
    installmentSettlementEvents: settlementEvents.value,
    installmentInvoiceEvents: invoiceEvents.value,
    setInstallments: installments.set,
    setInstallmentSettlementEvents: settlementEvents.set,
    setInstallmentInvoiceEvents: invoiceEvents.set,
    setConfirmation: confirmation.set,
    setToast: toast.set,
  });
  controller.pay(8, 1, "2026-09-10");
  createInstallmentMutations({
    installments: installments.value,
    installmentScheduleItems: schedule,
    installmentSettlementEvents: settlementEvents.value,
    installmentInvoiceEvents: invoiceEvents.value,
    setInstallments: installments.set,
    setInstallmentSettlementEvents: settlementEvents.set,
    setInstallmentInvoiceEvents: invoiceEvents.set,
    setConfirmation: confirmation.set,
    setToast: toast.set,
  }).anticipate(8, 2, "2026-09-11");
  assert.deepEqual(
    settlementEvents.value?.map((event) => [
      event.installmentNumber,
      event.type,
      event.amount,
    ]),
    [
      [1, "regular", 33.34],
      [2, "anticipated", 33.33],
      [3, "anticipated", 33.33],
    ],
  );
  assert.equal(invoiceEvents.value.length, 0);
  assert.equal(installments.value[0]?.paidInstallments, 3);
});

test("scheduled card payments use invoice events and never create a parallel settlement", () => {
  const installments = setter<Installment[]>([
    {
      id: 18,
      title: "Notebook",
      category: "Trabalho",
      who: "Bruna",
      amount: 100,
      totalInstallments: 2,
      paidInstallments: 0,
      nextDue: "2026-09-27",
      creditCardId: 3,
    },
  ]);
  const settlementEvents = setter<InstallmentSettlementEvent[] | undefined>([]);
  const invoiceEvents = setter<InstallmentInvoiceEvent[]>([]);
  const confirmation = setter<Confirmation | null>(null);
  const toast = setter("");
  const schedule: InstallmentScheduleItem[] = [1, 2].map(
    (installmentNumber) => ({
      id: `installment:18:${installmentNumber}`,
      installmentId: 18,
      installmentNumber,
      totalInstallments: 2,
      amount: 100,
      creditCardId: 3,
      invoiceReferenceMonth: `2026-${String(8 + installmentNumber).padStart(2, "0")}`,
      dueDate: `2026-${String(8 + installmentNumber).padStart(2, "0")}-27`,
      status: "scheduled",
    }),
  );
  createInstallmentMutations({
    installments: installments.value,
    installmentScheduleItems: schedule,
    installmentSettlementEvents: settlementEvents.value,
    installmentInvoiceEvents: invoiceEvents.value,
    setInstallments: installments.set,
    setInstallmentSettlementEvents: settlementEvents.set,
    setInstallmentInvoiceEvents: invoiceEvents.set,
    setConfirmation: confirmation.set,
    setToast: toast.set,
  }).anticipate(18, 1, "2026-08-20");
  assert.deepEqual(
    invoiceEvents.value.map((event) => [event.installmentNumber, event.type]),
    [[1, "anticipated"]],
  );
  assert.deepEqual(settlementEvents.value, []);
});

test("installment, receivable and limit mutations preserve their existing deterministic rules", () => {
  const installments = setter<Installment[]>([
    {
      id: 1,
      title: "Carro",
      category: "Carro",
      who: "Casal" as const,
      amount: 100,
      totalInstallments: 4,
      paidInstallments: 1,
      nextDue: "2026-09-10",
    },
  ]);
  const debts = setter<Debt[]>([
    {
      id: 2,
      person: "Ana",
      amount: 100,
      paid: 10,
      destination: "bruna" as const,
      note: "",
      month: "2026-09",
    },
  ]);
  const income = setter([] as IncomeEntry[]);
  const limits = setter({ Bruna: 350, Matheus: 350 });
  const personalLimits = setter({ ...DEFAULT_PERSONAL_LIMITS });
  const budgets = setter<Record<string, number>>({ Alimentação: 100 });
  const confirmation = setter<Confirmation | null>(null);
  const toast = setter("");
  const installmentController = createInstallmentMutations({
    installments: installments.value,
    setInstallments: installments.set,
    setConfirmation: confirmation.set,
    setToast: toast.set,
  });
  installmentController.pay(1, 2);
  assert.equal(installments.value[0].paidInstallments, 3);
  const receivables = createReceivableMutations({
    debts: debts.value,
    setDebts: debts.set,
    setIncomeEntries: income.set,
    setConfirmation: confirmation.set,
    setToast: toast.set,
  });
  const paid = receivables.registerReceipt({
    debt: debts.value[0],
    amount: 25,
    month: "2026-09",
    owner: "Bruna",
  });
  assert.equal(paid, 35);
  assert.equal(income.value[0].amount, 25);
  const limitController = createLimitMutations({
    limits: limits.value,
    budgets: budgets.value,
    personalLimits: personalLimits.value,
    setLimits: limits.set,
    setBudgets: budgets.set,
    setPersonalLimits: personalLimits.set,
  });
  limitController.updatePersonal("bruna_personal", 400);
  limitController.updateCategory("Alimentação", 150);
  assert.equal(limits.value.Bruna, 400);
  assert.equal(personalLimits.value.bruna_personal, 400);
  assert.equal(budgets.value.Alimentação, 150);
});
