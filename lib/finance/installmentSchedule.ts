import type { InstallmentScheduleItem } from "../app/AppTypes";

const MONTH = /^(\d{4})-(\d{2})$/;
const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

function addMonths(month: string, offset: number) {
  const match = MONTH.exec(month);
  if (!match) throw new Error("A competência deve usar o formato YYYY-MM.");
  const year = Number(match[1]);
  const monthNumber = Number(match[2]);
  if (monthNumber < 1 || monthNumber > 12)
    throw new Error("A competência deve conter um mês válido.");
  const value = new Date(year, monthNumber - 1 + offset, 1);
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}`;
}

function addMonthsToDate(date: string, offset: number) {
  const match = DATE.exec(date);
  if (!match) throw new Error("O vencimento deve usar o formato YYYY-MM-DD.");
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const first = new Date(year, month - 1 + offset, 1);
  const last = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  return `${first.getFullYear()}-${String(first.getMonth() + 1).padStart(2, "0")}-${String(Math.min(day, last)).padStart(2, "0")}`;
}

export function generateInstallmentSchedule(input: {
  installmentId: number;
  totalAmount: number;
  totalInstallments: number;
  firstInvoiceReferenceMonth?: string;
  firstDueDate?: string;
  creditCardId?: number;
}): InstallmentScheduleItem[] {
  if (!Number.isSafeInteger(input.installmentId))
    throw new Error("O ID do parcelamento deve ser um inteiro seguro.");
  if (!Number.isInteger(input.totalInstallments) || input.totalInstallments < 1)
    throw new Error("A quantidade de parcelas deve ser um inteiro positivo.");
  if (!Number.isFinite(input.totalAmount) || input.totalAmount < 0)
    throw new Error("O valor total deve ser um número não negativo.");
  if (!input.firstInvoiceReferenceMonth && !input.firstDueDate)
    throw new Error("Informe a primeira competência ou o primeiro vencimento.");

  const totalCents = Math.round(input.totalAmount * 100);
  if (Math.abs(input.totalAmount * 100 - totalCents) > 1e-7)
    throw new Error("O valor total deve ter no máximo duas casas decimais.");
  const baseCents = Math.floor(totalCents / input.totalInstallments);
  const remainder = totalCents % input.totalInstallments;
  return Array.from({ length: input.totalInstallments }, (_, index) => {
    const number = index + 1;
    const cents = baseCents + (number <= remainder ? 1 : 0);
    return {
      id: `installment:${input.installmentId}:${number}`,
      installmentId: input.installmentId,
      installmentNumber: number,
      totalInstallments: input.totalInstallments,
      amount: cents / 100,
      ...(input.firstInvoiceReferenceMonth
        ? {
            invoiceReferenceMonth: addMonths(
              input.firstInvoiceReferenceMonth,
              index,
            ),
          }
        : {}),
      ...(input.firstDueDate
        ? { dueDate: addMonthsToDate(input.firstDueDate, index) }
        : {}),
      ...(input.creditCardId !== undefined
        ? { creditCardId: input.creditCardId }
        : {}),
      status: "scheduled" as const,
    };
  });
}
