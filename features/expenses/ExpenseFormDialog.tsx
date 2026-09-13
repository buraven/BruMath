"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { DateInput } from "../../components/ui/DateInput";
import { FormDialog } from "../../components/ui/FormDialog";
import { MoneyInput } from "../../components/ui/MoneyInput";
import type { CreditCard, Expense, Person } from "../../lib/app/AppTypes";
import { PERSONAL_LIMIT_BUCKETS } from "../../lib/finance/personalLimits";
import type { PersonalLimitBucket } from "../../lib/finance/personalLimitBuckets";

const personalLimitLabels: Record<PersonalLimitBucket, string> = {
  bruna_nails: "Bruna — Unha",
  bruna_personal: "Bruna — Pessoal",
  matheus_personal: "Matheus — Pessoal",
};

type Props = {
  expense: Expense | null;
  categories: readonly string[];
  activeProfile: Person;
  viewMonth: string;
  creditCards: readonly CreditCard[];
  onSave: (expense: Expense, isEditing: boolean) => void;
  onClose: () => void;
  onInvalid: (message: string) => void;
};

export function ExpenseFormDialog({
  expense,
  categories,
  activeProfile,
  viewMonth,
  creditCards,
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
          personalLimitBucket: expense.personalLimitBucket ?? "",
          creditCardId: expense.creditCardId
            ? String(expense.creditCardId)
            : "",
        }
      : {
          title: "",
          amount: "",
          cat: "Outros",
          who: activeProfile,
          date: `${viewMonth}-01`,
          personalLimitBucket: "",
          creditCardId: "",
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
              ...(form.personalLimitBucket
                ? {
                    personalLimitBucket:
                      form.personalLimitBucket as PersonalLimitBucket,
                  }
                : {}),
              ...(form.creditCardId
                ? { creditCardId: Number(form.creditCardId) }
                : {}),
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
        <label className="field">
          <span>Cartão</span>
          <select
            value={form.creditCardId}
            onChange={(event) =>
              setForm({ ...form, creditCardId: event.target.value })
            }
          >
            <option value="">Nenhum</option>
            {creditCards
              .filter((card) => card.active)
              .map((card) => (
                <option key={card.id} value={card.id}>
                  {card.name} · {card.owner}
                </option>
              ))}
          </select>
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
        <label className="field">
          <span>Usar limite pessoal</span>
          <select
            value={form.personalLimitBucket}
            onChange={(event) =>
              setForm({
                ...form,
                personalLimitBucket: event.target.value,
              })
            }
          >
            <option value="">Nenhum</option>
            {PERSONAL_LIMIT_BUCKETS.map((bucket) => (
              <option key={bucket} value={bucket}>
                {personalLimitLabels[bucket]}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="primary-button">
          <Check size={17} /> Salvar gasto
        </button>
      </form>
    </FormDialog>
  );
}
