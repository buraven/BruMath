/** Local calendar dates stay as YYYY-MM-DD strings: never parse them as UTC instants. */
export function isLocalDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;

  const [, yearText, monthText, dayText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const candidate = new Date(year, month - 1, day, 12);

  return (
    year >= 1000 &&
    candidate.getFullYear() === year &&
    candidate.getMonth() === month - 1 &&
    candidate.getDate() === day
  );
}

export function formatLocalDate(value: string) {
  if (!isLocalDate(value)) return "";
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

export function parseBrazilianDate(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  if (digits.length !== 8) return "";

  const day = digits.slice(0, 2);
  const month = digits.slice(2, 4);
  const year = digits.slice(4, 8);
  const localDate = `${year}-${month}-${day}`;
  return isLocalDate(localDate) ? localDate : "";
}

export function formatBrazilianDateDraft(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  return digits
    .replace(/^(\d{2})(\d)/, "$1/$2")
    .replace(/^(\d{2}\/\d{2})(\d)/, "$1/$2");
}
