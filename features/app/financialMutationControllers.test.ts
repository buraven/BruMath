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
} from "../../lib/app/AppTypes";

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
    },
    false,
  );
  assert.equal(expenses.value.length, 1);
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
    setLimits: limits.set,
    setBudgets: budgets.set,
  });
  limitController.updatePersonal("Bruna", 400);
  limitController.updateCategory("Alimentação", 150);
  assert.equal(limits.value.Bruna, 400);
  assert.equal(budgets.value.Alimentação, 150);
});
