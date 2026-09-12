"use client";

import { Check } from "lucide-react";
import { FormDialog } from "../../components/ui/FormDialog";
import { MoneyInput } from "../../components/ui/MoneyInput";

type Props = {
  income: number;
  limits: Record<"Bruna" | "Matheus", number>;
  budgets: Record<string, number>;
  onIncomeChange: (value: number) => void;
  onPersonalLimitChange: (person: "Bruna" | "Matheus", value: number) => void;
  onCategoryLimitChange: (category: string, value: number) => void;
  onSave: () => void;
  onClose: () => void;
};

export function FinancialSettingsDialog({
  income,
  limits,
  budgets,
  onIncomeChange,
  onPersonalLimitChange,
  onCategoryLimitChange,
  onSave,
  onClose,
}: Props) {
  return (
    <FormDialog title="Renda e orçamento" onClose={onClose}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onSave();
        }}
      >
        <label className="field">
          <span>Renda mensal base</span>
          <MoneyInput
            value={income}
            onValueChange={(value) => onIncomeChange(Number(value))}
          />
        </label>
        <div className="form-grid">
          <label className="field">
            <span>Limite Bruna</span>
            <MoneyInput
              value={limits.Bruna}
              onValueChange={(value) =>
                onPersonalLimitChange("Bruna", Number(value))
              }
            />
          </label>
          <label className="field">
            <span>Limite Matheus</span>
            <MoneyInput
              value={limits.Matheus}
              onValueChange={(value) =>
                onPersonalLimitChange("Matheus", Number(value))
              }
            />
          </label>
        </div>
        <div className="settings-grid">
          {Object.entries(budgets).map(([category, value]) => (
            <label className="field" key={category}>
              <span>Limite {category}</span>
              <MoneyInput
                value={value}
                onValueChange={(nextValue) =>
                  onCategoryLimitChange(category, Number(nextValue))
                }
              />
            </label>
          ))}
        </div>
        <button type="submit" className="primary-button">
          <Check size={17} /> Salvar orçamento
        </button>
      </form>
    </FormDialog>
  );
}
