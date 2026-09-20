import type {
  CreditCard,
  Expense,
  IncomeEntry,
  Installment,
  InvoicePayment,
  Person,
} from "../app/AppTypes";
import { deriveInvoices, type InvoiceStatus } from "./invoices";
import { isWithinProfileScope } from "./profileScope";

export type CalendarItemType =
  | "expense"
  | "income"
  | "installment_due"
  | "invoice_due"
  | "invoice_closing";

export type CalendarItem = {
  id: string;
  date: string;
  type: CalendarItemType;
  sourceId: string | number;
  title: string;
  amount?: number;
  owner?: Person;
  category?: string;
  status?: InvoiceStatus;
  /** Existing actions only apply to original installments. */
  installmentId?: number;
  /** Existing invoice detail is identified by this stable derived id. */
  invoiceId?: string;
};

export type CalendarProjection = {
  month: string;
  items: readonly CalendarItem[];
  itemsByDate: ReadonlyMap<string, readonly CalendarItem[]>;
  /**
   * This is intentionally conservative. `baseBalance` is the app's existing
   * monthly available amount, so dated income and card purchases must not be
   * added or subtracted again. Only non-card installments still due after the
   * supplied reference day can reduce this limited forecast.
   */
  forecast: {
    baseBalance: number;
    knownFutureIncome: number;
    knownFutureCommitments: number;
    projectedBalance: number;
  };
};

const itemOrder: Record<CalendarItemType, number> = {
  invoice_closing: 0,
  invoice_due: 1,
  installment_due: 2,
  income: 3,
  expense: 4,
};

function previousMonth(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  const date = new Date(year, monthNumber - 2, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function belongsToMonth(date: string, month: string) {
  return date.startsWith(`${month}-`);
}

function isOnOrAfter(date: string, referenceDate: string) {
  return date >= referenceDate;
}

function sortItems(items: readonly CalendarItem[]) {
  return [...items].sort(
    (left, right) =>
      left.date.localeCompare(right.date) ||
      itemOrder[left.type] - itemOrder[right.type] ||
      left.title.localeCompare(right.title),
  );
}

export function deriveCalendarProjection({
  month,
  profile,
  expenses,
  incomeEntries,
  installments,
  cards,
  payments,
  baseBalance,
  referenceDate = `${month}-01`,
}: {
  month: string;
  profile: Person;
  expenses: readonly Expense[];
  incomeEntries: readonly IncomeEntry[];
  installments: readonly Installment[];
  cards: readonly CreditCard[];
  payments: readonly InvoicePayment[];
  baseBalance: number;
  referenceDate?: string;
}): CalendarProjection {
  const items: CalendarItem[] = [];

  for (const expense of expenses) {
    if (
      belongsToMonth(expense.date, month) &&
      isWithinProfileScope(expense.who, profile)
    ) {
      items.push({
        id: `expense:${expense.id}`,
        date: expense.date,
        type: "expense",
        sourceId: expense.id,
        title: expense.title,
        amount: expense.amount,
        owner: expense.who,
        category: expense.cat,
      });
    }
  }

  for (const income of incomeEntries) {
    if (
      belongsToMonth(income.date, month) &&
      isWithinProfileScope(income.who, profile)
    ) {
      items.push({
        id: `income:${income.id}`,
        date: income.date,
        type: "income",
        sourceId: income.id,
        title: income.title,
        amount: income.amount,
        owner: income.who,
      });
    }
  }

  const activeInstallments = installments.filter(
    (installment) =>
      installment.paidInstallments < installment.totalInstallments &&
      isWithinProfileScope(installment.who, profile),
  );
  // A card-linked installment is an item of its derived invoice. The invoice
  // due date, rather than the installment itself, is the cash commitment.
  const standaloneInstallments = activeInstallments.filter(
    (installment) => !installment.creditCardId,
  );
  for (const installment of standaloneInstallments) {
    if (belongsToMonth(installment.nextDue, month)) {
      items.push({
        id: `installment:${installment.id}:${installment.nextDue}`,
        date: installment.nextDue,
        type: "installment_due",
        sourceId: installment.id,
        title: installment.title,
        amount: installment.amount,
        owner: installment.who,
        category: installment.category,
        installmentId: installment.id,
      });
    }
  }

  // A due date can belong to the preceding reference cycle. Deriving both
  // adjacent cycles makes September discover an August cycle due in September.
  const invoices = [previousMonth(month), month].flatMap((referenceMonth) =>
    deriveInvoices({
      cards,
      expenses,
      installments,
      payments,
      profile,
      referenceMonth,
    }),
  );
  for (const invoice of invoices) {
    if (belongsToMonth(invoice.closingDate, month)) {
      items.push({
        id: `invoice-closing:${invoice.id}`,
        date: invoice.closingDate,
        type: "invoice_closing",
        sourceId: invoice.id,
        title: `Fechamento ${invoice.card.name}`,
        owner: invoice.card.owner,
        status: invoice.status,
        invoiceId: invoice.id,
      });
    }
    if (invoice.total > 0 && belongsToMonth(invoice.dueDate, month)) {
      items.push({
        id: `invoice-due:${invoice.id}`,
        date: invoice.dueDate,
        type: "invoice_due",
        sourceId: invoice.id,
        title: `Vencimento ${invoice.card.name}`,
        amount: invoice.total,
        owner: invoice.card.owner,
        status: invoice.status,
        invoiceId: invoice.id,
      });
    }
  }

  const sortedItems = sortItems(items);
  const grouped = new Map<string, CalendarItem[]>();
  for (const item of sortedItems) {
    const dayItems = grouped.get(item.date) ?? [];
    dayItems.push(item);
    grouped.set(item.date, dayItems);
  }

  const standaloneCommitments = standaloneInstallments
    .filter(
      (installment) =>
        belongsToMonth(installment.nextDue, month) &&
        isOnOrAfter(installment.nextDue, referenceDate),
    )
    .reduce((total, installment) => total + installment.amount, 0);

  const invoiceCommitments = invoices
    .filter(
      (invoice) =>
        invoice.status === "open" &&
        belongsToMonth(invoice.dueDate, month) &&
        isOnOrAfter(invoice.dueDate, referenceDate),
    )
    .reduce((total, invoice) => {
      // The existing base balance already includes card purchases registered in
      // this same competence. Only the invoice portion not already reflected
      // there is a future cash commitment. Card installments are never
      // expenses, so they remain fully represented by the invoice.
      const expensesAlreadyInBase = invoice.expenses
        .filter((expense) => belongsToMonth(expense.date, month))
        .reduce((sum, expense) => sum + expense.amount, 0);
      return total + Math.max(0, invoice.total - expensesAlreadyInBase);
    }, 0);

  const knownFutureCommitments = standaloneCommitments + invoiceCommitments;

  return {
    month,
    items: sortedItems,
    itemsByDate: grouped,
    forecast: {
      baseBalance,
      knownFutureIncome: 0,
      knownFutureCommitments,
      projectedBalance: baseBalance - knownFutureCommitments,
    },
  };
}

export function getCalendarItemsForDate(
  projection: CalendarProjection,
  date: string,
): readonly CalendarItem[] {
  return projection.itemsByDate.get(date) ?? [];
}
