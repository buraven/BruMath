"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { FormDialog } from "../ui/FormDialog";
import { MoneyInput } from "../ui/MoneyInput";
import type { Debt, DebtDestination } from "../../lib/app/AppTypes";

type Props = {
  debt: Debt | null;
  viewMonth: string;
  onSave: (debt: Debt, isEditing: boolean) => void;
  onClose: () => void;
  onInvalid: (message: string) => void;
};

export function ReceivableFormDialog({
  debt,
  viewMonth,
  onSave,
  onClose,
  onInvalid,
}: Props) {
  const [form, setForm] = useState(() =>
    debt
      ? {
          person: debt.person,
          amount: String(debt.amount),
          paid: String(debt.paid),
          destination: debt.destination,
          note: debt.note,
          month: debt.month || viewMonth,
        }
      : {
          person: "Amigo",
          amount: "",
          paid: "0",
          destination: "bruna" as DebtDestination,
          note: "",
          month: viewMonth,
        },
  );

  return (
    <FormDialog
      title={debt ? "Editar quem me deve" : "Adicionar quem me deve"}
      onClose={onClose}
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const amount = Number(form.amount.replace(",", "."));
          const paid = Number(form.paid.replace(",", ".")) || 0;
          if (!form.person.trim() || !amount || amount < 0) {
            onInvalid("Informe quem deve e o valor.");
            return;
          }
          if (!Number.isFinite(paid) || paid < 0 || paid > amount) {
            onInvalid(
              "O valor recebido precisa ficar entre R$ 0 e o valor total.",
            );
            return;
          }
          onSave(
            {
              id: debt?.id ?? Date.now(),
              person: form.person.trim(),
              amount,
              destination: form.destination,
              note: form.note.trim(),
              paid,
              month: form.month || viewMonth,
              receivedMonth:
                paid >= amount
                  ? debt?.receivedMonth || viewMonth
                  : debt?.receivedMonth,
            },
            Boolean(debt),
          );
        }}
      >
        <label className="field">
          <span>Quem deve?</span>
          <input
            value={form.person}
            onChange={(event) =>
              setForm({ ...form, person: event.target.value })
            }
            placeholder="Ex.: João"
            required
          />
        </label>
        <div className="form-grid">
          <label className="field">
            <span>Valor total</span>
            <MoneyInput
              value={form.amount}
              onValueChange={(amount) => setForm({ ...form, amount })}
              placeholder="13.000,00"
              required
            />
          </label>
          <label className="field">
            <span>Já recebido</span>
            <MoneyInput
              maximum={Number(form.amount) || 0}
              value={form.paid}
              onValueChange={(paid) => setForm({ ...form, paid })}
              placeholder="0,00"
            />
          </label>
        </div>
        <div className="form-grid">
          <label className="field">
            <span>Mês</span>
            <input
              type="month"
              value={form.month}
              onChange={(event) =>
                setForm({ ...form, month: event.target.value })
              }
            />
          </label>
          <label className="field">
            <span>Quando pagar, vai para</span>
            <select
              value={form.destination}
              onChange={(event) =>
                setForm({
                  ...form,
                  destination: event.target.value as DebtDestination,
                })
              }
            >
              <option value="cartao">Cartão</option>
              <option value="bruna">Bruna</option>
              <option value="matheus">Matheus</option>
              <option value="casal">Casal</option>
            </select>
          </label>
        </div>
        <label className="field">
          <span>Observação</span>
          <input
            value={form.note}
            onChange={(event) => setForm({ ...form, note: event.target.value })}
            placeholder="Ex.: amigo me deve R$ 13 mil"
          />
        </label>
        <button type="submit" className="primary-button">
          <Check size={17} /> Salvar valor a receber
        </button>
      </form>
    </FormDialog>
  );
}
