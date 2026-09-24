import type {
  CreditCard,
  Expense,
  InvoiceAdjustment,
  InvoicePayment,
  Installment,
  InstallmentInvoiceEvent,
  Person,
} from "../app/AppTypes";
import { isWithinProfileScope } from "./profileScope";

/**
 * An in-progress cycle is intentionally distinct from an unpaid invoice:
 * it keeps a configured card visible before its first purchase without
 * representing a debt.
 */
export type InvoiceStatus = "in_progress" | "open" | "paid";
export type InvoiceFilter = "all" | "open" | "due" | "paid";

export type DerivedInvoice = {
  id: string;
  card: CreditCard;
  referenceMonth: string;
  closingDate: string;
  dueDate: string;
  expenses: readonly Expense[];
  installments: readonly InvoiceInstallmentItem[];
  adjustments: readonly InvoiceAdjustment[];
  total: number;
  paidAmount: number;
  status: InvoiceStatus;
  availableCredit: number;
  utilization: number;
  categoryTotals: readonly { category: string; amount: number }[];
};

export type InvoiceInstallmentItem = {
  id: string;
  title: string;
  category: string;
  owner: Person;
  amount: number;
  date: string;
  currentInstallment: number;
  totalInstallments: number;
  eventType?: InstallmentInvoiceEvent["type"];
};

export function filterInvoices(
  invoices: readonly DerivedInvoice[],
  filter: InvoiceFilter,
): readonly DerivedInvoice[] {
  if (filter === "all") return invoices;
  // "Abertas" and "A vencer" only represent invoices with an actual balance.
  if (filter === "due")
    return invoices.filter((invoice) => invoice.status === "open");
  return invoices.filter((invoice) => invoice.status === filter);
}

export function summarizeInvoices(invoices: readonly DerivedInvoice[]) {
  const payable = invoices.filter((invoice) => invoice.status === "open");
  const paid = invoices.filter((invoice) => invoice.status === "paid");

  return {
    payableCount: payable.length,
    totalPayable: payable.reduce((sum, invoice) => sum + invoice.total, 0),
    nextDue: payable.map((invoice) => invoice.dueDate).sort()[0],
    totalProjected: invoices.reduce((sum, invoice) => sum + invoice.total, 0),
    totalPaid: paid.reduce((sum, invoice) => sum + invoice.total, 0),
  };
}

export function registerInvoicePayment(
  payments: readonly InvoicePayment[],
  invoice: Pick<DerivedInvoice, "card" | "referenceMonth" | "total">,
  paidAt: string,
  id: number,
): InvoicePayment[] {
  if (invoice.total <= 0) return [...payments];
  const alreadyRecorded = payments.some(
    (payment) =>
      payment.cardId === invoice.card.id &&
      payment.referenceMonth === invoice.referenceMonth,
  );
  return alreadyRecorded
    ? [...payments]
    : [
        ...payments,
        {
          id,
          cardId: invoice.card.id,
          referenceMonth: invoice.referenceMonth,
          paidAt,
          amount: invoice.total,
        },
      ];
}

const pad = (value: number) => String(value).padStart(2, "0");

function toDate(value: string) {
  return new Date(`${value}T12:00:00`);
}

function monthKey(year: number, monthIndex: number) {
  const date = new Date(year, monthIndex, 1);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
}

function dateInMonth(month: string, day: number) {
  const [year, monthNumber] = month.split("-").map(Number);
  const lastDay = new Date(year, monthNumber, 0).getDate();
  return `${month}-${pad(Math.min(Math.max(1, day), lastDay))}`;
}

/** The invoice closes in its reference month. Purchases after closing move forward. */
export function resolveInvoiceReferenceMonth(
  purchaseDate: string,
  closingDay: number,
): string {
  const date = toDate(purchaseDate);
  return monthKey(
    date.getFullYear(),
    date.getMonth() + (date.getDate() > closingDay ? 1 : 0),
  );
}

export function resolveInvoiceDueDate(
  card: CreditCard,
  referenceMonth: string,
) {
  const [year, month] = referenceMonth.split("-").map(Number);
  return card.dueDay <= card.closingDay
    ? dateInMonth(monthKey(year, month), card.dueDay)
    : dateInMonth(referenceMonth, card.dueDay);
}

export function resolveInvoiceClosingDate(
  card: CreditCard,
  referenceMonth: string,
) {
  return dateInMonth(referenceMonth, card.closingDay);
}

export function deriveInvoices({
  cards,
  expenses,
  payments,
  installments = [],
  adjustments = [],
  installmentEvents = [],
  profile,
  referenceMonth,
}: {
  cards: readonly CreditCard[];
  expenses: readonly Expense[];
  payments: readonly InvoicePayment[];
  installments?: readonly Installment[];
  adjustments?: readonly InvoiceAdjustment[];
  installmentEvents?: readonly InstallmentInvoiceEvent[];
  profile: Person;
  referenceMonth: string;
}): readonly DerivedInvoice[] {
  return cards
    .filter((card) => card.active && isWithinProfileScope(card.owner, profile))
    .map((card) => {
      const invoiceExpenses = expenses.filter(
        (expense) =>
          expense.creditCardId === card.id &&
          (expense.invoiceReferenceMonth ??
            resolveInvoiceReferenceMonth(expense.date, card.closingDay)) ===
            referenceMonth,
      );
      const cardEvents = installmentEvents.filter(
        (event) =>
          event.cardId === card.id && event.referenceMonth === referenceMonth,
      );
      const eventInstallmentIds = new Set(
        cardEvents.map((event) => event.installmentId),
      );
      const invoiceInstallments: InvoiceInstallmentItem[] = installments
        .filter(
          (installment) =>
            installment.creditCardId === card.id &&
            installment.paidInstallments < installment.totalInstallments &&
            !eventInstallmentIds.has(installment.id) &&
            resolveInvoiceReferenceMonth(
              installment.nextDue,
              card.closingDay,
            ) === referenceMonth,
        )
        .map((installment) => ({
          id: `installment:${installment.id}:${referenceMonth}`,
          title: installment.title,
          category: installment.category,
          owner: installment.who,
          amount: installment.amount,
          date: installment.nextDue,
          currentInstallment: installment.paidInstallments + 1,
          totalInstallments: installment.totalInstallments,
        }));
      const eventInstallments: InvoiceInstallmentItem[] = cardEvents.flatMap(
        (event) => {
          const installment = installments.find(
            (candidate) => candidate.id === event.installmentId,
          );
          if (!installment) return [];
          return [
            {
              id: `installment-event:${event.id}`,
              title: installment.title,
              category: installment.category,
              owner: installment.who,
              amount: event.amount,
              date: event.date ?? installment.nextDue,
              currentInstallment: event.installmentNumber,
              totalInstallments: installment.totalInstallments,
              eventType: event.type,
            } satisfies InvoiceInstallmentItem,
          ];
        },
      );
      const invoiceAdjustments = adjustments.filter(
        (adjustment) =>
          adjustment.cardId === card.id &&
          adjustment.referenceMonth === referenceMonth,
      );
      const expenseTotal = invoiceExpenses.reduce(
        (sum, expense) => sum + expense.amount,
        0,
      );
      const installmentTotal = [
        ...invoiceInstallments,
        ...eventInstallments,
      ].reduce((sum, installment) => sum + installment.amount, 0);
      const adjustmentTotal = invoiceAdjustments.reduce(
        (sum, adjustment) => sum + adjustment.amount,
        0,
      );
      const total = expenseTotal + installmentTotal + adjustmentTotal;
      const paidAmount = payments
        .filter(
          (payment) =>
            payment.cardId === card.id &&
            payment.referenceMonth === referenceMonth,
        )
        .reduce((sum, payment) => sum + payment.amount, 0);
      const categoryMap = new Map<string, number>();
      for (const expense of invoiceExpenses) {
        categoryMap.set(
          expense.cat,
          (categoryMap.get(expense.cat) ?? 0) + expense.amount,
        );
      }
      for (const installment of [
        ...invoiceInstallments,
        ...eventInstallments,
      ]) {
        categoryMap.set(
          installment.category,
          (categoryMap.get(installment.category) ?? 0) + installment.amount,
        );
      }
      return {
        id: `${card.id}:${referenceMonth}`,
        card,
        referenceMonth,
        closingDate: resolveInvoiceClosingDate(card, referenceMonth),
        dueDate: resolveInvoiceDueDate(card, referenceMonth),
        expenses: invoiceExpenses,
        installments: [...invoiceInstallments, ...eventInstallments],
        adjustments: invoiceAdjustments,
        total,
        paidAmount,
        status:
          total <= 0 ? "in_progress" : paidAmount >= total ? "paid" : "open",
        availableCredit: Math.max(0, card.creditLimit - total),
        utilization:
          card.creditLimit > 0 ? (total / card.creditLimit) * 100 : 0,
        categoryTotals: [...categoryMap.entries()]
          .map(([category, amount]) => ({ category, amount }))
          .sort(
            (a, b) =>
              b.amount - a.amount || a.category.localeCompare(b.category),
          ),
      } satisfies DerivedInvoice;
    })
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
}
