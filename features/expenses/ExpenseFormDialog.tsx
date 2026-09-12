"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { DateInput } from "../../components/ui/DateInput";
import { FormDialog } from "../../components/ui/FormDialog";
import { MoneyInput } from "../../components/ui/MoneyInput";
import type { Expense, Person } from "../../lib/app/AppTypes";

type Props = {
  expense: Expense | null;
  categories: readonly string[];
  activeProfile: Person;
  viewMonth: string;
  onSave: (expense: Expense, isEditing: boolean) => void;
  onClose: () => void;
  onInvalid: (message: string) => void;
};

export function ExpenseFormDialog({
  expense,
  categories,
  activeProfile,
  viewMonth,
  onSave,
  onClose,
  onInvalid,
}: Props) {
  const [form, setForm] = useState(() =>
    expense
      ? {
          title: expense.title,
          amount: String(expense.amount),
          cat: expense.cat,
          who: expense.who,
          date: expense.date,
        }
      : {
          title: "",
          amount: "",
          cat: "Outros",
          who: activeProfile,
          date: `${viewMonth}-01`,
        },
  );

  return (
    <FormDialog
      title={expense ? "Editar gasto" : "Adicionar gasto"}
      onClose={onClose}
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const amount = Number(form.amount.replace(",", "."));
          if (!form.title.trim() || !amount || amount < 0) {
            onInvalid("Preencha descrição e valor.");
            return;
          }
          onSave(
            {
              id: expense?.id ?? Date.now(),
              title: form.title.trim(),
              amount,
              cat: form.cat,
              who: form.who,
              date: form.date || `${viewMonth}-01`,
            },
            Boolean(expense),
          );
        }}
      >
        <label className="field">
          <span>O que foi?</span>
          <input
            value={form.title}
            onChange={(event) =>
              setForm({ ...form, title: event.target.value })
            }
            placeholder="Ex.: Mercado"
            required
          />
        </label>
        <div className="form-grid">
          <label className="field">
            <span>Valor</span>
            <MoneyInput
              value={form.amount}
              onValueChange={(amount) => setForm({ ...form, amount })}
              placeholder="50,00"
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
            <span>Categoria</span>
            <select
              value={form.cat}
              onChange={(event) =>
                setForm({ ...form, cat: event.target.value })
              }
            >
              {categories.map((category) => (
                <option key={category}>{category}</option>
              ))}
            </select>
          </label>
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
        </div>
        <button type="submit" className="primary-button">
          <Check size={17} /> Salvar gasto
        </button>
      </form>
    </FormDialog>
  );
}
