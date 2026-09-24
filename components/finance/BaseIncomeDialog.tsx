"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { FormDialog } from "../ui/FormDialog";
import { MoneyInput } from "../ui/MoneyInput";

type Props = {
  income: number;
  onSave: (income: number) => void;
  onClose: () => void;
};

/** Edits the existing global base-income value; it never creates an income entry. */
export function BaseIncomeDialog({ income, onSave, onClose }: Props) {
  const [draft, setDraft] = useState(String(income));
  const [error, setError] = useState("");

  return (
    <FormDialog title="Editar renda mensal" onClose={onClose}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const nextIncome = Number(draft);
          if (!Number.isFinite(nextIncome) || nextIncome < 0) {
            setError("Informe uma renda mensal válida.");
            return;
          }
          onSave(nextIncome);
        }}
      >
        <label className="field">
          <span>Renda mensal base</span>
          <MoneyInput
            value={draft}
            onValueChange={(value) => {
              setDraft(value);
              setError("");
            }}
            required
            autoFocus
          />
        </label>
        <p>
          Este valor é a renda-base global. Entradas extras continuam
          registradas separadamente.
        </p>
        {error && <small role="alert">{error}</small>}
        <button type="submit" className="primary-button">
          <Check size={17} /> Salvar renda mensal
        </button>
      </form>
    </FormDialog>
  );
}
