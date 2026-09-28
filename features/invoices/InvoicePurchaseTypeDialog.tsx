"use client";

import { CreditCard, Layers3 } from "lucide-react";
import { FormDialog } from "../../components/ui/FormDialog";

type Props = {
  onChooseCash: () => void;
  onChooseInstallment: () => void;
  onClose: () => void;
};

/** First, compact step for a purchase explicitly started from an invoice. */
export function InvoicePurchaseTypeDialog({
  onChooseCash,
  onChooseInstallment,
  onClose,
}: Props) {
  return (
    <FormDialog title="Adicionar compra" onClose={onClose}>
      <p className="form-help">Como esta compra será paga?</p>
      <div className="dialog-choice-list">
        <button
          type="button"
          className="secondary-button"
          onClick={onChooseCash}
        >
          <CreditCard size={18} />
          <span>
            <strong>À vista</strong>
            <small>Uma compra nesta fatura.</small>
          </span>
        </button>
        <button
          type="button"
          className="secondary-button"
          onClick={onChooseInstallment}
        >
          <Layers3 size={18} />
          <span>
            <strong>Parcelado</strong>
            <small>Distribua a compra nas próximas faturas.</small>
          </span>
        </button>
      </div>
    </FormDialog>
  );
}
