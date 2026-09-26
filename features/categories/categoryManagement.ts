import type { AppFinancialData, Category } from "../../lib/app/AppTypes";
import {
  canonicalCategoryDisplayName,
  legacyCategoryId,
  normalizeCategoryName,
} from "../../lib/finance/categoryCatalog";

export function assertActiveCategoryNameAvailable(
  categories: readonly Category[],
  name: string,
  exceptId?: string,
) {
  const normalized = normalizeCategoryName(name);
  if (!normalized) throw new Error("Informe o nome da categoria.");
  if (
    categories.some(
      (category) =>
        category.id !== exceptId &&
        category.active &&
        normalizeCategoryName(category.name) === normalized,
    )
  ) {
    throw new Error("Já existe uma categoria ativa com esse nome.");
  }
  return canonicalCategoryDisplayName(name);
}

export function categoryHasHistory(
  category: Category,
  data: Pick<AppFinancialData, "categoryBudgets"> & {
    expenses: readonly AppFinancialData["expenses"][number][];
    installments: readonly AppFinancialData["installments"][number][];
    budgets?: Readonly<Record<string, number>>;
  },
) {
  return (
    data.expenses.some(
      (expense) =>
        expense.categoryId === category.id ||
        (!expense.categoryId &&
          (legacyCategoryId(expense.cat) === category.id ||
            normalizeCategoryName(expense.cat) ===
              normalizeCategoryName(category.name))),
    ) ||
    data.installments.some(
      (installment) =>
        installment.categoryId === category.id ||
        (!installment.categoryId &&
          (legacyCategoryId(installment.category) === category.id ||
            normalizeCategoryName(installment.category) ===
              normalizeCategoryName(category.name))),
    ) ||
    data.categoryBudgets?.[category.id] !== undefined ||
    Object.keys(data.budgets ?? {}).some(
      (name) =>
        normalizeCategoryName(name) === normalizeCategoryName(category.name),
    )
  );
}

/** Domain guard: UI affordances must never be the only deletion protection. */
export function assertCategoryCanBeDeleted(
  category: Category,
  data: Parameters<typeof categoryHasHistory>[1],
) {
  if (categoryHasHistory(category, data)) {
    throw new Error(
      "Esta categoria possui histórico ou limite associado. Arquive-a em vez de excluir.",
    );
  }
}

export function createManagedCategory(
  categories: readonly Category[],
  name: string,
  id: string,
): Category {
  const displayName = assertActiveCategoryNameAvailable(categories, name);
  if (!id || id.startsWith("legacy:"))
    throw new Error("ID de categoria inválido.");
  return {
    id,
    name: displayName,
    active: true,
    sortOrder:
      Math.max(-1, ...categories.map((category) => category.sortOrder)) + 1,
  };
}
