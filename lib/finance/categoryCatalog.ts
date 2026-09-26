import type {
  AppFinancialData,
  Category,
  Expense,
  Installment,
} from "../app/AppTypes";

/**
 * The catalog deliberately supports the Portuguese/Latin letters below. This
 * is a small, explicit case fold shared with SQL `translate`, rather than a
 * runtime locale or database collation.
 */
const UPPERCASE_PT_BR = "ABCDEFGHIJKLMNOPQRSTUVWXYZÁÀÂÃÄÇÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜ";
const LOWERCASE_PT_BR = "abcdefghijklmnopqrstuvwxyzáàâãäçéèêëíìîïóòôõöúùûü";
const lowerByCategoryContract = new Map(
  [...UPPERCASE_PT_BR].map((character, index) => [
    character,
    LOWERCASE_PT_BR[index]!,
  ]),
);

/**
 * Canonical display candidates trim and collapse ASCII spaces only. This is
 * intentionally the same narrow operation used by PostgreSQL's `btrim` and
 * `regexp_replace(..., ' +', ' ', 'g')`.
 */
export function canonicalCategoryDisplayName(name: string) {
  return name.replace(/^ +| +$/g, "").replace(/ +/g, " ");
}

/**
 * This is normalization, not fuzzy matching. It folds only the explicit
 * Brazilian Portuguese alphabet above; accents remain distinct.
 */
export function normalizeCategoryName(name: string) {
  return [...canonicalCategoryDisplayName(name)]
    .map((character) => lowerByCategoryContract.get(character) ?? character)
    .join("");
}

/** A deterministic bridge identity for records that pre-date the catalog. */
export function legacyCategoryId(name: string) {
  return `legacy:${normalizeCategoryName(name)}`;
}

export const DEFAULT_CATEGORY_NAMES = [
  "Casa",
  "Carro",
  "Alimentação",
  "Pets",
  "Assinaturas",
  "Saúde",
  "Educação",
  "Pessoal",
  "Lazer",
  "Trabalho",
  "Outros",
  // This was already a budget and icon category, but was missing from the UI list.
  "Transporte",
] as const;

type LegacyCategoryCandidate = {
  name: string;
  /** Defaults have a stable, intentionally curated display spelling. */
  sourcePriority: number;
};

function compareUtf8(left: string, right: string) {
  const leftBytes = new TextEncoder().encode(left);
  const rightBytes = new TextEncoder().encode(right);
  for (
    let index = 0;
    index < Math.min(leftBytes.length, rightBytes.length);
    index += 1
  ) {
    const difference = leftBytes[index]! - rightBytes[index]!;
    if (difference) return difference;
  }
  return leftBytes.length - rightBytes.length;
}

function legacyCategoryCandidates({
  expenses,
  installments,
  budgets,
}: Pick<AppFinancialData, "expenses" | "installments" | "budgets">) {
  return [
    ...DEFAULT_CATEGORY_NAMES.map((name) => ({ name, sourcePriority: 0 })),
    ...Object.keys(budgets).map((name) => ({ name, sourcePriority: 1 })),
    ...expenses
      .filter((expense) => !expense.categoryId)
      .map((expense) => ({ name: expense.cat, sourcePriority: 1 })),
    ...installments
      .filter((installment) => !installment.categoryId)
      .map((installment) => ({
        name: installment.category,
        sourcePriority: 1,
      })),
  ].filter((candidate) =>
    Boolean(canonicalCategoryDisplayName(candidate.name)),
  );
}

function categoryForLegacyText(
  categoriesByNormalizedName: ReadonlyMap<string, readonly Category[]>,
  name: string,
) {
  const matches =
    categoriesByNormalizedName.get(normalizeCategoryName(name)) ?? [];
  const active = matches.filter((category) => category.active);
  if (active.length === 1) return active[0];
  if (active.length === 0 && matches.length === 1) return matches[0];
  return undefined;
}

/**
 * Promotes only unambiguous name-keyed compatibility values. The returned
 * `budgets` object is expressly the residual, unresolved legacy map.
 */
export function promoteLegacyCategoryBudgets({
  categories,
  budgets,
  categoryBudgets = {},
}: {
  categories: readonly Category[];
  budgets: Readonly<Record<string, number>>;
  categoryBudgets?: Readonly<Record<string, number>>;
}) {
  const categoriesByNormalizedName = new Map<string, Category[]>();
  for (const category of categories) {
    const normalized = normalizeCategoryName(category.name);
    if (!normalized) continue;
    categoriesByNormalizedName.set(normalized, [
      ...(categoriesByNormalizedName.get(normalized) ?? []),
      category,
    ]);
  }
  const categoryBudgetsById = { ...categoryBudgets };
  const unresolvedBudgets: Record<string, number> = {};
  const legacyBudgetCandidates = new Map<
    string,
    Array<readonly [name: string, amount: number]>
  >();
  for (const [name, amount] of Object.entries(budgets)) {
    const categoryId = categoryForLegacyText(
      categoriesByNormalizedName,
      name,
    )?.id;
    if (categoryId && typeof amount === "number" && Number.isFinite(amount)) {
      legacyBudgetCandidates.set(categoryId, [
        ...(legacyBudgetCandidates.get(categoryId) ?? []),
        [name, amount],
      ]);
    } else {
      unresolvedBudgets[name] = amount;
    }
  }
  for (const [categoryId, candidates] of legacyBudgetCandidates) {
    if (candidates.length === 1) {
      if (categoryBudgetsById[categoryId] === undefined) {
        categoryBudgetsById[categoryId] = candidates[0]![1];
      }
      continue;
    }
    for (const [name, amount] of candidates) unresolvedBudgets[name] = amount;
  }
  return { budgets: unresolvedBudgets, categoryBudgets: categoryBudgetsById };
}

/**
 * Converts a legacy, name-only snapshot to the additive catalog contract.
 * Materialized records are keyed by ID: archived and active categories with
 * the same display name are distinct historical facts and both are retained.
 */
export function hydrateCategoryCatalog<
  T extends Pick<
    AppFinancialData,
    "categories" | "expenses" | "installments" | "budgets" | "categoryBudgets"
  >,
>(
  snapshot: T,
): T & {
  categories: Category[];
  expenses: Expense[];
  installments: Installment[];
  categoryBudgets?: Record<string, number>;
} {
  const categoriesById = new Map<string, Category>();
  for (const category of snapshot.categories ?? []) {
    if (!category.id || categoriesById.has(category.id)) continue;
    categoriesById.set(category.id, {
      ...category,
      name: canonicalCategoryDisplayName(category.name),
    });
  }
  const categoriesByNormalizedName = new Map<string, Category[]>();
  for (const category of categoriesById.values()) {
    const normalized = normalizeCategoryName(category.name);
    if (!normalized) continue;
    categoriesByNormalizedName.set(normalized, [
      ...(categoriesByNormalizedName.get(normalized) ?? []),
      category,
    ]);
  }

  const candidatesByNormalizedName = new Map<
    string,
    LegacyCategoryCandidate[]
  >();
  for (const candidate of legacyCategoryCandidates(snapshot)) {
    const normalized = normalizeCategoryName(candidate.name);
    // A legacy ID is immutable once materialized. A later rename changes the
    // display name, never allows defaults or old textual facts to recreate a
    // second category carrying the original legacy identity.
    if (
      !normalized ||
      categoriesByNormalizedName.has(normalized) ||
      categoriesById.has(legacyCategoryId(normalized))
    )
      continue;
    candidatesByNormalizedName.set(normalized, [
      ...(candidatesByNormalizedName.get(normalized) ?? []),
      { ...candidate, name: canonicalCategoryDisplayName(candidate.name) },
    ]);
  }
  for (const [normalized, candidates] of candidatesByNormalizedName) {
    const winner = [...candidates].sort(
      (left, right) =>
        left.sourcePriority - right.sourcePriority ||
        compareUtf8(left.name, right.name),
    )[0]!;
    const category: Category = {
      id: legacyCategoryId(normalized),
      name: winner.name,
      active: true,
      sortOrder: categoriesById.size,
    };
    categoriesById.set(category.id, category);
    categoriesByNormalizedName.set(normalized, [category]);
  }

  const categories = [...categoriesById.values()].sort(
    (left, right) =>
      left.sortOrder - right.sortOrder || compareUtf8(left.id, right.id),
  );
  const categoryIdFor = (name: string) =>
    categoryForLegacyText(categoriesByNormalizedName, name)?.id;
  const promotedBudgets = promoteLegacyCategoryBudgets({
    categories,
    budgets: snapshot.budgets,
    categoryBudgets: snapshot.categoryBudgets,
  });
  return {
    ...snapshot,
    categories,
    budgets: promotedBudgets.budgets,
    ...(Object.keys(promotedBudgets.categoryBudgets).length
      ? { categoryBudgets: promotedBudgets.categoryBudgets }
      : {}),
    expenses: snapshot.expenses.map((expense) => ({
      ...expense,
      ...(expense.categoryId || !categoryIdFor(expense.cat)
        ? {}
        : { categoryId: categoryIdFor(expense.cat) }),
    })),
    installments: snapshot.installments.map((installment) => ({
      ...installment,
      ...(installment.categoryId || !categoryIdFor(installment.category)
        ? {}
        : { categoryId: categoryIdFor(installment.category) }),
    })),
  };
}

export function resolveCategoryBudgetMap(
  budgets: Readonly<Record<string, number>>,
  categories: readonly Category[],
) {
  const byName = new Map<string, string>();
  for (const category of categories) {
    const normalized = normalizeCategoryName(category.name);
    if (!byName.has(normalized) && category.active) {
      byName.set(normalized, category.id);
    }
  }
  return Object.fromEntries(
    Object.entries(budgets).map(([name, amount]) => [
      byName.get(normalizeCategoryName(name)) ?? name,
      amount,
    ]),
  );
}
