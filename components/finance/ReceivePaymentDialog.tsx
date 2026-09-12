"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { FormDialog } from "../ui/FormDialog";
import { MoneyInput } from "../ui/MoneyInput";
import type { Debt } from "../../lib/app/AppTypes";

type Props = {
  debt: Debt;
  formatMoney: (value: number) => string;
  onReceive: (amount: number) => void;
  onClose: () => void;
  onInvalid: (message: string) => void;
};

export function ReceivePaymentDialog({
  debt,
  formatMoney,
  onReceive,
  onClose,
  onInvalid,
}: Props) {
  const [amount, setAmount] = useState("");
  const outstanding = Math.max(0, debt.amount - debt.paid);

  return (
    <FormDialog title="Registrar recebimento" onClose={onClose}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const parsed = Number(amount.replace(",", "."));
          if (!Number.isFinite(parsed) || parsed <= 0) {
            onInvalid("Informe quanto recebeu.");
            return;
          }
          if (Math.round(parsed * 100) > Math.round(outstanding * 100)) {
            onInvalid(
              `O máximo que pode registrar agora é ${formatMoney(outstanding)}.`,
            );
            return;
          }
          onReceive(parsed);
        }}
      >
        <div className="receive-summary">
          <span>Valor em aberto</span>
          <strong>{formatMoney(outstanding)}</strong>
          <small>
            {debt.person}
            {debt.note ? ` · ${debt.note}` : ""}
          </small>
        </div>
        <label className="field">
          <span>Quanto você recebeu?</span>
          <MoneyInput
            autoFocus
            value={amount}
            maximum={outstanding}
            onValueChange={setAmount}
            placeholder="Ex.: 200,00"
            required
          />
        </label>
        <p className="receive-help">
          Você pode receber uma parte agora e o restante continuará em aberto
          para os próximos meses.
        </p>
        <button type="submit" className="primary-button">
          <Check size={17} /> Registrar recebimento
        </button>
      </form>
    </FormDialog>
  );
}
