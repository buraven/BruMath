import type { Category } from "../../lib/app/AppTypes";
import { normalizeCategoryName } from "../../lib/finance/categoryCatalog";

export function orderedActiveCategories(categories: readonly Category[]) {
  return [...categories]
    .filter((category) => category.active)
    .sort(
      (left, right) =>
        left.sortOrder - right.sortOrder ||
        left.name.localeCompare(right.name, "pt-BR", { sensitivity: "base" }),
    );
}

export function searchCategories(
  categories: readonly Category[],
  query: string,
) {
  const normalizedQuery = normalizeCategoryName(query);
  return orderedActiveCategories(categories).filter((category) =>
    normalizeCategoryName(category.name).includes(normalizedQuery),
  );
}
