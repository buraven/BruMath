"use client";

import { Check } from "lucide-react";
import { FormDialog } from "../../components/ui/FormDialog";
import { MoneyInput } from "../../components/ui/MoneyInput";
import type { PersonalLimitBucket } from "../../lib/finance/personalLimitBuckets";
import type { PersonalLimitConfiguration } from "../../lib/finance/personalLimits";

type Props = {
  income: number;
  personalLimits: PersonalLimitConfiguration;
  budgets: Record<string, number>;
  onIncomeChange: (value: number) => void;
  onPersonalLimitChange: (bucket: PersonalLimitBucket, value: number) => void;
  onCategoryLimitChange: (category: string, value: number) => void;
  onSave: () => void;
  onClose: () => void;
};

export function FinancialSettingsDialog({
  income,
  personalLimits,
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
        <p>
          <strong>
            Limite pessoal da Bruna: R${" "}
            {(
              personalLimits.bruna_nails + personalLimits.bruna_personal
            ).toFixed(2)}
          </strong>
        </p>
        <div className="form-grid">
          <label className="field">
            <span>Bruna — Unha</span>
            <MoneyInput
              value={personalLimits.bruna_nails}
              onValueChange={(value) =>
                onPersonalLimitChange("bruna_nails", Number(value))
              }
            />
          </label>
          <label className="field">
            <span>Bruna — Pessoal</span>
            <MoneyInput
              value={personalLimits.bruna_personal}
              onValueChange={(value) =>
                onPersonalLimitChange("bruna_personal", Number(value))
              }
            />
          </label>
        </div>
        <label className="field">
          <span>Matheus — Pessoal</span>
          <MoneyInput
            value={personalLimits.matheus_personal}
            onValueChange={(value) =>
              onPersonalLimitChange("matheus_personal", Number(value))
            }
          />
        </label>
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
