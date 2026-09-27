import type {
  Installment,
  InstallmentInvoiceEvent,
  InstallmentScheduleItem,
  InstallmentSettlementEvent,
} from "../app/AppTypes";

/** Stable X/Y identity; never derived from an array position or legacy count. */
export function installmentScheduleIdentity(
  item: Pick<InstallmentScheduleItem, "installmentId" | "installmentNumber">,
) {
  return `${item.installmentId}:${item.installmentNumber}`;
}

export type InstallmentScheduleHistoryFacts = {
  installmentInvoiceEvents?: readonly InstallmentInvoiceEvent[];
  installmentSettlementEvents?: readonly InstallmentSettlementEvent[];
};

/** Only explicit persisted facts protect a planned item; dates never do. */
export function isInstallmentScheduleItemHistorical(
  item: Pick<InstallmentScheduleItem, "installmentId" | "installmentNumber">,
  {
    installmentInvoiceEvents = [],
    installmentSettlementEvents = [],
  }: InstallmentScheduleHistoryFacts,
) {
  return (
    installmentInvoiceEvents.some(
      (event) =>
        event.installmentId === item.installmentId &&
        event.installmentNumber === item.installmentNumber,
    ) ||
    installmentSettlementEvents.some(
      (event) =>
        event.installmentId === item.installmentId &&
        event.installmentNumber === item.installmentNumber,
    )
  );
}

/** Returns a complete schedule only when every X/Y item is present and valid. */
export function completeInstallmentSchedule(
  installment: Installment,
  scheduleItems: readonly InstallmentScheduleItem[],
) {
  const items = scheduleItems.filter(
    (item) => item.installmentId === installment.id,
  );
  if (items.length !== installment.totalInstallments) return undefined;
  const numbers = new Set<number>();
  for (const item of items) {
    if (
      item.status !== "scheduled" ||
      item.installmentNumber < 1 ||
      item.installmentNumber > installment.totalInstallments ||
      item.totalInstallments < item.installmentNumber ||
      numbers.has(item.installmentNumber) ||
      !Number.isFinite(item.amount) ||
      item.amount < 0
    )
      return undefined;
    numbers.add(item.installmentNumber);
  }
  return [...items].sort(
    (left, right) => left.installmentNumber - right.installmentNumber,
  );
}

export function futureInstallmentScheduleItems(
  installment: Installment,
  scheduleItems: readonly InstallmentScheduleItem[],
  facts: InstallmentScheduleHistoryFacts,
) {
  return (
    completeInstallmentSchedule(installment, scheduleItems)?.filter(
      (item) => !isInstallmentScheduleItemHistorical(item, facts),
    ) ?? []
  );
}
