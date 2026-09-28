import type {
  Installment,
  InstallmentScheduleItem,
  Person,
} from "../app/AppTypes";
import {
  completeInstallmentSchedule,
  isInstallmentScheduleItemHistorical,
  type InstallmentScheduleHistoryFacts,
} from "./installmentScheduleHistory";

export type ProspectiveInstallmentEdit = {
  title?: string;
  category?: string;
  categoryId?: string | undefined;
  who?: Person;
  /** The exact sum to distribute only across the future schedule items. */
  futureTotalAmount?: number;
  /** Number of future items; historical X/Y items are never renumbered. */
  futureInstallmentCount?: number;
  firstFutureInvoiceReferenceMonth?: string | null;
  firstFutureDueDate?: string | null;
  futureCreditCardId?: number | null;
};

export type ProspectiveInstallmentEditResult = {
  installment: Installment;
  scheduleItems: InstallmentScheduleItem[];
};

const MONTH = /^(\d{4})-(\d{2})$/;
const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

function hasOwn(input: object, key: string) {
  return Object.prototype.hasOwnProperty.call(input, key);
}

function cents(value: number) {
  if (!Number.isFinite(value) || value < 0)
    throw new Error("O valor futuro deve ser um número não negativo.");
  const result = Math.round(value * 100);
  if (Math.abs(value * 100 - result) > 1e-7)
    throw new Error("O valor futuro deve ter no máximo duas casas decimais.");
  return result;
}

function addMonth(month: string, offset: number) {
  const match = MONTH.exec(month);
  if (!match) throw new Error("A competência futura deve usar YYYY-MM.");
  const year = Number(match[1]);
  const monthNumber = Number(match[2]);
  if (monthNumber < 1 || monthNumber > 12)
    throw new Error("A competência futura deve conter um mês válido.");
  const date = new Date(year, monthNumber - 1 + offset, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function addMonthToDate(dateValue: string, offset: number) {
  const match = DATE.exec(dateValue);
  if (!match) throw new Error("O vencimento futuro deve usar YYYY-MM-DD.");
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const first = new Date(year, month - 1 + offset, 1);
  const last = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  return `${first.getFullYear()}-${String(first.getMonth() + 1).padStart(2, "0")}-${String(Math.min(day, last)).padStart(2, "0")}`;
}

function isFinancialEdit(edit: ProspectiveInstallmentEdit) {
  return (
    hasOwn(edit, "futureTotalAmount") ||
    hasOwn(edit, "futureInstallmentCount") ||
    hasOwn(edit, "firstFutureInvoiceReferenceMonth") ||
    hasOwn(edit, "firstFutureDueDate") ||
    hasOwn(edit, "futureCreditCardId")
  );
}

/**
 * Applies a prospective edit without mutating inputs. Explicit event facts
 * protect historical schedule items; every remaining X/Y item can be
 * repriced, rescheduled, moved to another card, added, or shortened.
 */
export function applyProspectiveInstallmentEdit({
  installment,
  scheduleItems,
  historyFacts,
  edit,
}: {
  installment: Installment;
  scheduleItems: readonly InstallmentScheduleItem[];
  historyFacts: InstallmentScheduleHistoryFacts;
  edit: ProspectiveInstallmentEdit;
}): ProspectiveInstallmentEditResult {
  const schedule = completeInstallmentSchedule(installment, scheduleItems);
  if (!schedule)
    throw new Error("A edição prospectiva exige um cronograma completo.");

  const historical = schedule.filter((item) =>
    isInstallmentScheduleItemHistorical(item, historyFacts),
  );
  const future = schedule.filter(
    (item) => !isInstallmentScheduleItemHistorical(item, historyFacts),
  );
  const metadata: Installment = {
    ...installment,
    ...(edit.title !== undefined ? { title: edit.title } : {}),
    ...(edit.category !== undefined ? { category: edit.category } : {}),
    ...(hasOwn(edit, "categoryId") ? { categoryId: edit.categoryId } : {}),
    ...(edit.who !== undefined ? { who: edit.who } : {}),
  };

  if (!isFinancialEdit(edit))
    return { installment: metadata, scheduleItems: schedule };
  if (!future.length)
    throw new Error("Não há parcelas futuras para alterar neste parcelamento.");

  const futureCount = edit.futureInstallmentCount ?? future.length;
  if (!Number.isInteger(futureCount) || futureCount < 1)
    throw new Error(
      "A quantidade futura de parcelas deve ser um inteiro positivo.",
    );
  const futureTotalCents = cents(
    edit.futureTotalAmount ??
      future.reduce((total, item) => total + item.amount, 0),
  );
  const firstFuture = future[0]!;
  const firstMonth = hasOwn(edit, "firstFutureInvoiceReferenceMonth")
    ? edit.firstFutureInvoiceReferenceMonth
    : firstFuture.invoiceReferenceMonth;
  const firstDueDate = hasOwn(edit, "firstFutureDueDate")
    ? edit.firstFutureDueDate
    : firstFuture.dueDate;
  const futureCardId = hasOwn(edit, "futureCreditCardId")
    ? edit.futureCreditCardId
    : firstFuture.creditCardId;
  let retainedFuture = [...future];
  let totalInstallments = installment.totalInstallments;

  if (futureCount < future.length) {
    const removedCount = future.length - futureCount;
    for (let index = 0; index < removedCount; index += 1) {
      const candidate = retainedFuture.at(-1);
      if (!candidate || candidate.installmentNumber !== totalInstallments)
        throw new Error(
          "Não é possível reduzir a quantidade futura sem remover uma parcela já consolidada.",
        );
      retainedFuture.pop();
      totalInstallments -= 1;
    }
  } else if (futureCount > future.length) {
    totalInstallments += futureCount - future.length;
  }

  const baseCents = Math.floor(futureTotalCents / futureCount);
  const remainder = futureTotalCents % futureCount;
  const rebuildFuture =
    futureCount !== future.length ||
    hasOwn(edit, "firstFutureInvoiceReferenceMonth") ||
    hasOwn(edit, "firstFutureDueDate");
  const nextFuture = Array.from({ length: futureCount }, (_, index) => {
    if (!rebuildFuture) {
      const existing = retainedFuture[index]!;
      return {
        ...existing,
        amount: (baseCents + (index < remainder ? 1 : 0)) / 100,
        ...(hasOwn(edit, "futureCreditCardId")
          ? futureCardId === null
            ? { creditCardId: undefined }
            : { creditCardId: futureCardId }
          : {}),
      } satisfies InstallmentScheduleItem;
    }
    const existing = retainedFuture[index];
    const installmentNumber =
      existing?.installmentNumber ??
      installment.totalInstallments + (index - retainedFuture.length) + 1;
    const item: InstallmentScheduleItem = existing
      ? {
          ...existing,
          totalInstallments,
          amount: (baseCents + (index < remainder ? 1 : 0)) / 100,
        }
      : {
          id: `installment:${installment.id}:${installmentNumber}`,
          installmentId: installment.id,
          installmentNumber,
          totalInstallments,
          amount: (baseCents + (index < remainder ? 1 : 0)) / 100,
          status: "scheduled",
        };
    if (firstMonth) item.invoiceReferenceMonth = addMonth(firstMonth, index);
    if (firstDueDate) item.dueDate = addMonthToDate(firstDueDate, index);
    if (futureCardId !== null && futureCardId !== undefined)
      item.creditCardId = futureCardId;
    return item;
  });

  return {
    installment: {
      ...metadata,
      totalInstallments: rebuildFuture
        ? totalInstallments
        : installment.totalInstallments,
      amount: nextFuture[0]!.amount,
      ...(firstDueDate ? { nextDue: firstDueDate } : {}),
      ...(hasOwn(edit, "futureCreditCardId")
        ? futureCardId === null
          ? { creditCardId: undefined }
          : { creditCardId: futureCardId }
        : {}),
    },
    // Historical objects are returned untouched, including their original Y.
    scheduleItems: [...historical, ...nextFuture].sort(
      (left, right) => left.installmentNumber - right.installmentNumber,
    ),
  };
}
