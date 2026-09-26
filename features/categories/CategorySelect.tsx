"use client";

import type { Category } from "../../lib/app/AppTypes";

type Props = {
  categories: readonly Category[];
  valueId?: string;
  fallbackName?: string;
  onChange: (category: Category) => void;
  label?: string;
};

/** Native picker: iOS/Safari owns the menu and keyboard interaction. */
export function CategorySelect({
  categories,
  valueId,
  fallbackName,
  onChange,
  label = "Categoria",
}: Props) {
  const selected = categories.find((category) => category.id === valueId);
  const options = categories.filter(
    (category) => category.active || category.id === selected?.id,
  );

  return (
    <label className="field">
      <span>{label}</span>
      <select
        value={selected?.id ?? ""}
        onChange={(event) => {
          const category = categories.find(
            (item) => item.id === event.target.value,
          );
          if (category) onChange(category);
        }}
      >
        {!selected && fallbackName ? (
          <option value="" disabled>
            {fallbackName} (histórica)
          </option>
        ) : null}
        {options.map((category) => (
          <option key={category.id} value={category.id}>
            {category.name}
            {category.active ? "" : " (arquivada)"}
          </option>
        ))}
      </select>
    </label>
  );
}
