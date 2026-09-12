"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { FormDialog } from "../../components/ui/FormDialog";
import type { Installment } from "../../lib/app/AppTypes";

type Props = {
  installment: Installment;
  onAdvance: (count: number) => void;
  onClose: () => void;
  onInvalid: (message: string) => void;
};

export function AdvanceInstallmentsDialog({
  installment,
  onAdvance,
  onClose,
  onInvalid,
}: Props) {
  const remaining =
    installment.totalInstallments - installment.paidInstallments;
  const [count, setCount] = useState(remaining > 2 ? "2" : "1");

  return (
    <FormDialog title="Adiantar parcelas" onClose={onClose}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const parsed = Number(count);
          if (!Number.isInteger(parsed) || parsed < 1 || parsed > remaining) {
            onInvalid(`Digite uma quantidade entre 1 e ${remaining}.`);
            return;
          }
          onAdvance(parsed);
        }}
      >
        <div className="receive-summary">
          <span>Parcela</span>
          <strong>{installment.title}</strong>
          <small>Você pode adiantar até {remaining} parcelas.</small>
        </div>
        <label className="field">
          <span>Quantas parcelas deseja adiantar?</span>
          <input
            autoFocus
            type="number"
            min="1"
            max={remaining}
            value={count}
            onChange={(event) => setCount(event.target.value)}
            required
          />
        </label>
        <div className="modal-actions">
          <button type="button" className="secondary-button" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className="primary-button">
            <Check size={17} /> Confirmar adianto
          </button>
        </div>
      </form>
    </FormDialog>
  );
}
