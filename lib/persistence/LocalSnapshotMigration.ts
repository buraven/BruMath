import type { AppFinancialData } from "../app/AppTypes";

export type LocalMigrationPreview = {
  sourceHash: string;
  counts: Readonly<Record<string, number>>;
  valid: boolean;
  issues: readonly string[];
};

export type FinancialImportTarget = {
  hasImport(householdId: string, sourceHash: string): Promise<boolean>;
  importSnapshot(
    householdId: string,
    snapshot: AppFinancialData,
  ): Promise<void>;
  readSnapshot(householdId: string): Promise<AppFinancialData>;
  markImport(
    householdId: string,
    sourceHash: string,
    summary: LocalMigrationPreview["counts"],
  ): Promise<void>;
};

function stableSnapshot(snapshot: AppFinancialData) {
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

export function previewLocalMigration(
  snapshot: AppFinancialData,
): LocalMigrationPreview {
  const issues = [
    ...(snapshot.expenses.some((item) => !Number.isInteger(item.id))
      ? ["Há gastos sem ID legado inteiro."]
      : []),
    ...(snapshot.creditCards.some((item) => !Number.isInteger(item.id))
      ? ["Há cartões sem ID legado inteiro."]
      : []),
  ];
  return {
    sourceHash: hash(stableSnapshot(snapshot)),
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
}: {
  target: FinancialImportTarget;
  householdId: string;
  snapshot: AppFinancialData;
}) {
  const preview = previewLocalMigration(snapshot);
  if (!preview.valid) throw new Error(preview.issues.join(" "));
  if (await target.hasImport(householdId, preview.sourceHash))
    return { imported: false, preview };

  await target.importSnapshot(householdId, snapshot);
  const persisted = await target.readSnapshot(householdId);
  const reconciliation = previewLocalMigration(persisted);
  if (
    JSON.stringify(reconciliation.counts) !== JSON.stringify(preview.counts)
  ) {
    throw new Error("A importação não reconciliou com o snapshot local.");
  }
  await target.markImport(householdId, preview.sourceHash, preview.counts);
  return { imported: true, preview };
}
