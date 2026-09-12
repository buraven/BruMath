export type TemporalContext = Readonly<{
  currentDate: string;
  timeZone: string;
}>;

function dateKey(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function createTemporalContext(
  now = new Date(),
  timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone ||
    "America/Sao_Paulo",
): TemporalContext {
  return { currentDate: dateKey(now, timeZone), timeZone };
}

export function resolveRelativeDate(
  reference: "hoje" | "ontem" | "anteontem",
  context: TemporalContext,
): string {
  const [year, month, day] = context.currentDate.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(
    date.getUTCDate() -
      (reference === "hoje" ? 0 : reference === "ontem" ? 1 : 2),
  );
  return date.toISOString().slice(0, 10);
}

/** Financial relative periods are anchored to the selected product month, not today. */
export function resolveFinancialMonth(
  reference: "selected" | "previous" | "next",
  selectedMonth: string,
): string {
  const [year, month] = selectedMonth.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, 1));
  date.setUTCMonth(
    date.getUTCMonth() +
      (reference === "selected" ? 0 : reference === "previous" ? -1 : 1),
  );
  return date.toISOString().slice(0, 7);
}
