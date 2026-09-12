import type { Dispatch, SetStateAction } from "react";
import type {
  Confirmation,
  Debt,
  Expense,
  IncomeEntry,
  Installment,
  Person,
} from "../../lib/app/AppTypes";

type CommonDependencies = {
  setConfirmation: Dispatch<SetStateAction<Confirmation | null>>;
  setToast: Dispatch<SetStateAction<string>>;
};

export function createExpenseIncomeMutations({
  expenses,
  incomeEntries,
  setExpenses,
  setIncomeEntries,
  setConfirmation,
  setToast,
}: CommonDependencies & {
  expenses: readonly Expense[];
  incomeEntries: readonly IncomeEntry[];
  setExpenses: Dispatch<SetStateAction<Expense[]>>;
  setIncomeEntries: Dispatch<SetStateAction<IncomeEntry[]>>;
}) {
  return {
    saveExpense(item: Expense, editing: boolean) {
      setExpenses((current) =>
        editing
          ? current.map((expense) => (expense.id === item.id ? item : expense))
          : [item, ...current],
      );
      setToast(editing ? "Gasto atualizado 💚" : "Gasto adicionado 💚");
    },
    deleteExpense(id: number) {
      const item = expenses.find((expense) => expense.id === id);
      if (!item) return;
      setConfirmation({
        title: "Excluir gasto",
        description: `“${item.title}” será removido permanentemente.`,
        confirmLabel: "Excluir gasto",
        destructive: true,
        onConfirm: () => {
          setExpenses((current) =>
            current.filter((expense) => expense.id !== id),
          );
          setToast("Gasto excluído");
        },
      });
    },
    saveIncome(item: IncomeEntry, editing: boolean) {
      setIncomeEntries((current) =>
        editing
          ? current.map((entry) => (entry.id === item.id ? item : entry))
          : [item, ...current],
      );
      setToast(editing ? "Entrada salva 💚" : "Entrada salva 💚");
    },
    deleteIncome(id: number) {
      const item = incomeEntries.find((entry) => entry.id === id);
      if (!item) return;
      setConfirmation({
        title: "Excluir entrada",
        description: `“${item.title}” será removida permanentemente.`,
        confirmLabel: "Excluir entrada",
        destructive: true,
        onConfirm: () => {
          setIncomeEntries((current) =>
            current.filter((entry) => entry.id !== id),
          );
          setToast("Entrada excluída");
        },
      });
    },
  };
}

export function createInstallmentMutations({
  installments,
  setInstallments,
  setConfirmation,
  setToast,
}: CommonDependencies & {
  installments: readonly Installment[];
  setInstallments: Dispatch<SetStateAction<Installment[]>>;
}) {
  const pay = (id: number, count: number) => {
    setInstallments((current) =>
      current.map((item) => {
        if (item.id !== id) return item;
        const remaining = item.totalInstallments - item.paidInstallments;
        const actual = Math.min(Math.max(0, count), remaining);
        const paidInstallments = item.paidInstallments + actual;
        const [year, month, day] = item.nextDue.split("-").map(Number);
        const due = new Date(year, month - 1 + actual, Math.min(day, 28));
        return {
          ...item,
          paidInstallments,
          nextDue:
            paidInstallments >= item.totalInstallments
              ? item.nextDue
              : `${due.getFullYear()}-${String(due.getMonth() + 1).padStart(2, "0")}-${String(due.getDate()).padStart(2, "0")}`,
        };
      }),
    );
    setToast(
      count > 1
        ? `${count} parcelas adiantadas 💚`
        : count === 1
          ? "Parcela marcada como paga 💚"
          : "Parcela quitada 💚",
    );
  };

  return {
    save(item: Installment, editing: boolean) {
      setInstallments((current) =>
        editing
          ? current.map((installment) =>
              installment.id === item.id ? item : installment,
            )
          : [item, ...current],
      );
      setToast(editing ? "Parcela atualizada 💚" : "Parcela adicionada 💚");
    },
    delete(id: number) {
      const item = installments.find((installment) => installment.id === id);
      if (!item) return;
      setConfirmation({
        title: "Excluir parcelamento",
        description: `“${item.title}” será removido permanentemente.`,
        confirmLabel: "Excluir parcelamento",
        destructive: true,
        onConfirm: () => {
          setInstallments((current) =>
            current.filter((installment) => installment.id !== id),
          );
          setToast("Parcela excluída");
        },
      });
    },
    pay,
    confirmQuit(item: Installment) {
      const remaining = item.totalInstallments - item.paidInstallments;
      if (!remaining) return;
      setConfirmation({
        title: "Quitar parcelamento",
        description: `“${item.title}” tem ${remaining} parcela${remaining === 1 ? "" : "s"} restante${remaining === 1 ? "" : "s"}. Todas serão quitadas.`,
        confirmLabel: "Confirmar quitação",
        onConfirm: () => pay(item.id, remaining),
      });
    },
  };
}

export function createReceivableMutations({
  debts,
  setDebts,
  setIncomeEntries,
  setConfirmation,
  setToast,
}: CommonDependencies & {
  debts: readonly Debt[];
  setDebts: Dispatch<SetStateAction<Debt[]>>;
  setIncomeEntries: Dispatch<SetStateAction<IncomeEntry[]>>;
}) {
  return {
    save(item: Debt, editing: boolean) {
      setDebts((current) =>
        editing
          ? current.map((debt) => (debt.id === item.id ? item : debt))
          : [item, ...current],
      );
      setToast(editing ? "Dívida atualizada 💚" : "Dívida adicionada 💚");
    },
    delete(id: number) {
      const item = debts.find((debt) => debt.id === id);
      if (!item) return;
      setConfirmation({
        title: "Excluir valor a receber",
        description: `“${item.person}” será removido permanentemente.`,
        confirmLabel: "Excluir valor",
        destructive: true,
        onConfirm: () => {
          setDebts((current) => current.filter((debt) => debt.id !== id));
          setToast("Dívida excluída");
        },
      });
    },
    registerReceipt({
      debt,
      amount,
      month,
      owner,
    }: {
      debt: Debt;
      amount: number;
      month: string;
      owner: Person;
    }) {
      const paid = Math.min(
        debt.amount,
        Math.round((debt.paid + amount) * 100) / 100,
      );
      const destination = debt.destination === "cartao" ? "cartao" : "conta";
      setDebts((current) =>
        current.map((item) =>
          item.id === debt.id ? { ...item, paid, receivedMonth: month } : item,
        ),
      );
      setIncomeEntries((current) => [
        ...current,
        {
          id: Date.now(),
          title: `Recebimento de ${debt.person}`,
          amount,
          who: owner,
          date: `${month}-01`,
          destination,
          note: debt.note || "Pagamento de dívida",
        },
      ]);
      return paid;
    },
  };
}

export function createLimitMutations({
  limits,
  budgets,
  setLimits,
  setBudgets,
}: {
  limits: { Bruna: number; Matheus: number };
  budgets: Record<string, number>;
  setLimits: Dispatch<SetStateAction<{ Bruna: number; Matheus: number }>>;
  setBudgets: Dispatch<SetStateAction<Record<string, number>>>;
}) {
  return {
    save({
      personal,
      categories,
    }: {
      personal: { Bruna: number; Matheus: number };
      categories: Record<string, number>;
    }) {
      setLimits({ Bruna: personal.Bruna, Matheus: personal.Matheus });
      setBudgets((current) => ({ ...current, ...categories }));
    },
    updatePersonal(person: "Bruna" | "Matheus", value: number) {
      setLimits({ ...limits, [person]: value });
    },
    updateCategory(category: string, value: number) {
      setBudgets({ ...budgets, [category]: value });
    },
  };
}
