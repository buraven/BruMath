"use client";

import { ChevronDown, Search } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { Category } from "../../lib/app/AppTypes";
import { searchCategories } from "./categorySelectorHelpers";

type CategorySelectorProps = {
  categories: readonly Category[];
  valueId?: string;
  fallbackName?: string;
  onChange: (category: Category) => void;
  label?: string;
};

/** A searchable catalog picker shared by expense and installment dialogs. */
export function CategorySelector({
  categories,
  valueId,
  fallbackName,
  onChange,
  label = "Categoria",
}: CategorySelectorProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const labelId = useId();
  const selected = categories.find((category) => category.id === valueId);
  const options = useMemo(
    () => searchCategories(categories, query),
    [categories, query],
  );
  const selectedLabel = selected?.name ?? fallbackName ?? "Selecione";

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  return (
    <div className="category-selector">
      <span id={labelId} className="field-label">
        {label}
      </span>
      <button
        type="button"
        className="category-selector-trigger"
        aria-labelledby={labelId}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => {
          setOpen((current) => !current);
          setQuery("");
        }}
      >
        <span>
          {selectedLabel}
          {selected && !selected.active ? " · Arquivada" : ""}
        </span>
        <ChevronDown size={17} aria-hidden="true" />
      </button>
      {open && (
        <div className="category-selector-popover">
          <label className="category-selector-search">
            <Search size={16} aria-hidden="true" />
            <input
              ref={inputRef}
              type="search"
              value={query}
              placeholder="Buscar categoria"
              aria-label="Buscar categoria"
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape") setOpen(false);
              }}
            />
          </label>
          <div
            role="listbox"
            aria-label="Categorias"
            className="category-selector-options"
          >
            {options.length ? (
              options.map((category) => (
                <button
                  type="button"
                  role="option"
                  aria-selected={category.id === valueId}
                  key={category.id}
                  className="category-selector-option"
                  onClick={() => {
                    onChange(category);
                    setOpen(false);
                    setQuery("");
                  }}
                >
                  {category.name}
                </button>
              ))
            ) : (
              <p className="category-selector-empty">
                Nenhuma categoria encontrada.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
