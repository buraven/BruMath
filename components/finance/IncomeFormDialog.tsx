"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { DateInput } from "../ui/DateInput";
import { FormDialog } from "../ui/FormDialog";
import { MoneyInput } from "../ui/MoneyInput";
import type { IncomeEntry, Person } from "../../lib/app/AppTypes";

type Props = {
  income: IncomeEntry | null;
  activeProfile: Person;
  viewMonth: string;
  onSave: (income: IncomeEntry, isEditing: boolean) => void;
  onClose: () => void;
  onInvalid: (message: string) => void;
};

export function IncomeFormDialog({
  income,
  activeProfile,
  viewMonth,
  onSave,
  onClose,
  onInvalid,
}: Props) {
  const [form, setForm] = useState(() =>
    income
      ? {
          title: income.title,
          amount: String(income.amount),
          who: income.who,
          date: income.date,
          destination: income.destination,
          note: income.note,
        }
      : {
          title: "",
          amount: "",
          who: activeProfile,
          date: `${viewMonth}-01`,
          destination: "conta" as const,
          note: "",
        },
  );

  return (
    <FormDialog
      title={income ? "Editar entrada" : "Nova entrada"}
      onClose={onClose}
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const amount = Number(form.amount.replace(",", "."));
          if (!form.title.trim() || !amount || amount < 0) {
            onInvalid("Informe a entrada e o valor.");
            return;
          }
          onSave(
            {
              id: income?.id ?? Date.now(),
              title: form.title.trim(),
              amount,
              who: form.who,
              date: form.date || `${viewMonth}-01`,
              destination: form.destination,
              note: form.note.trim(),
            },
            Boolean(income),
          );
        }}
      >
        <label className="field">
          <span>Entrada</span>
          <input
            value={form.title}
            onChange={(event) =>
              setForm({ ...form, title: event.target.value })
            }
            placeholder="Ex.: Reembolso"
            required
          />
        </label>
        <div className="form-grid">
          <label className="field">
            <span>Valor</span>
            <MoneyInput
              value={form.amount}
              onValueChange={(amount) => setForm({ ...form, amount })}
              placeholder="500,00"
              required
            />
          </label>
          <label className="field">
            <span>Data</span>
            <DateInput
              value={form.date}
              onValueChange={(date) => setForm({ ...form, date })}
            />
          </label>
        </div>
        <div className="form-grid">
          <label className="field">
            <span>Quem</span>
            <select
              value={form.who}
              onChange={(event) =>
                setForm({ ...form, who: event.target.value as Person })
              }
            >
              <option>Bruna</option>
              <option>Matheus</option>
              <option>Casal</option>
            </select>
          </label>
          <label className="field">
            <span>Destino</span>
            <select
              value={form.destination}
              onChange={(event) =>
                setForm({
                  ...form,
                  destination: event.target.value as "conta" | "cartao",
                })
              }
            >
              <option value="conta">Conta</option>
              <option value="cartao">Cartão</option>
            </select>
          </label>
        </div>
        <label className="field">
          <span>Observação</span>
          <input
            value={form.note}
            onChange={(event) => setForm({ ...form, note: event.target.value })}
          />
        </label>
        <button type="submit" className="primary-button">
          <Check size={17} /> Salvar entrada
        </button>
      </form>
    </FormDialog>
  );
}
