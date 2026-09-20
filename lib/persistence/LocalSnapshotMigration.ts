import type { AppFinancialData } from "../app/AppTypes";

export type LocalMigrationPreview = {
  sourceHash: string;
  counts: Readonly<Record<string, number>>;
  valid: boolean;
  issues: readonly string[];
};

export type FinancialImportTarget = {
  hasImport(householdId: string, sourceHash: string): Promise<boolean>;
  /** Must be implemented as one authenticated database transaction/RPC. */
  importAtomically(
    householdId: string,
    snapshot: AppFinancialData,
    sourceHash: string,
    summary: LocalMigrationPreview["counts"],
  ): Promise<AppFinancialData>;
};

export function normalizeSnapshot(snapshot: AppFinancialData) {
  return JSON.stringify({
    expenses: [...snapshot.expenses].sort((a, b) => a.id - b.id),
    installments: [...snapshot.installments].sort((a, b) => a.id - b.id),
    debts: [...snapshot.debts].sort((a, b) => a.id - b.id),
    incomeEntries: [...snapshot.incomeEntries].sort((a, b) => a.id - b.id),
    income: snapshot.income,
    budgets: Object.entries(snapshot.budgets).sort(),
    limits: snapshot.limits,
    personalLimits: snapshot.personalLimits,
    creditCards: [...snapshot.creditCards].sort((a, b) => a.id - b.id),
    invoicePayments: [...snapshot.invoicePayments].sort((a, b) => a.id - b.id),
    activeProfile: snapshot.activeProfile,
    viewMonth: snapshot.viewMonth,
  });
}

function hash(value: string) {
  let current = 2_166_136_261;
  for (const character of value) {
    current ^= character.charCodeAt(0);
    current = Math.imul(current, 16_777_619);
  }
  return `local-${(current >>> 0).toString(16)}`;
}

function normalizeLocalValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalizeLocalValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, normalizeLocalValue(item)]),
    );
  }
  return value;
}

/** Stable identity for the preserved localStorage payload, not hydrated defaults. */
export function localStorageSourceHash(stored: unknown) {
  return hash(JSON.stringify(normalizeLocalValue(stored)));
}

export function previewLocalMigration(
  snapshot: AppFinancialData,
  sourceHash = hash(normalizeSnapshot(snapshot)),
): LocalMigrationPreview {
  const collections = [
    ["gastos", snapshot.expenses],
    ["parcelas", snapshot.installments],
    ["recebíveis", snapshot.debts],
    ["entradas", snapshot.incomeEntries],
    ["cartões", snapshot.creditCards],
    ["pagamentos de fatura", snapshot.invoicePayments],
  ] as const;
  const issues = collections.flatMap(([label, items]) => {
    const ids = items.map((item) => item.id);
    return [
      ...(!ids.every(Number.isInteger)
        ? [`Há ${label} sem ID legado inteiro.`]
        : []),
      ...(new Set(ids).size !== ids.length
        ? [`Há IDs legados duplicados em ${label}.`]
        : []),
    ];
  });
  const cardIds = new Set(snapshot.creditCards.map((card) => card.id));
  for (const cardId of [
    ...snapshot.expenses.map((item) => item.creditCardId),
    ...snapshot.installments.map((item) => item.creditCardId),
    ...snapshot.invoicePayments.map((item) => item.cardId),
  ]) {
    if (cardId !== undefined && !cardIds.has(cardId))
      issues.push(`Há referência a cartão legado inexistente (${cardId}).`);
  }
  return {
    sourceHash,
    counts: {
      expenses: snapshot.expenses.length,
      installments: snapshot.installments.length,
      receivables: snapshot.debts.length,
      incomeEntries: snapshot.incomeEntries.length,
      creditCards: snapshot.creditCards.length,
      invoicePayments: snapshot.invoicePayments.length,
    },
    valid: issues.length === 0,
    issues,
  };
}

export async function importLocalSnapshot({
  target,
  householdId,
  snapshot,
  sourceHash,
}: {
  target: FinancialImportTarget;
  householdId: string;
  snapshot: AppFinancialData;
  sourceHash?: string;
}) {
  const preview = previewLocalMigration(snapshot, sourceHash);
  if (!preview.valid) throw new Error(preview.issues.join(" "));
  if (await target.hasImport(householdId, preview.sourceHash))
    return { imported: false, preview };

  const persisted = await target.importAtomically(
    householdId,
    snapshot,
    preview.sourceHash,
    preview.counts,
  );
  if (normalizeSnapshot(persisted) !== normalizeSnapshot(snapshot)) {
    throw new Error("A importação não reconciliou com o snapshot local.");
  }
  return { imported: true, preview };
}

/** Recognizes both the stable localStorage identity and the legacy hydrated hash. */
export async function hasImportedLocalSnapshot({
  target,
  householdId,
  sourceHash,
  legacySourceHash,
}: {
  target: FinancialImportTarget;
  householdId: string;
  sourceHash: string;
  legacySourceHash: string;
}) {
  if (await target.hasImport(householdId, sourceHash)) return true;
  return (
    sourceHash !== legacySourceHash &&
    target.hasImport(householdId, legacySourceHash)
  );
}
