"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { DateInput } from "../../components/ui/DateInput";
import { FormDialog } from "../../components/ui/FormDialog";
import { MoneyInput } from "../../components/ui/MoneyInput";
import type {
  Category,
  CreditCard,
  Expense,
  Person,
} from "../../lib/app/AppTypes";
import { PERSONAL_LIMIT_BUCKETS } from "../../lib/finance/personalLimits";
import type { PersonalLimitBucket } from "../../lib/finance/personalLimitBuckets";
import { CategorySelector } from "../categories/CategorySelector";

const personalLimitLabels: Record<PersonalLimitBucket, string> = {
  bruna_nails: "Bruna — Unha",
  bruna_personal: "Bruna — Pessoal",
  matheus_personal: "Matheus — Pessoal",
};

type Props = {
  expense: Expense | null;
  categories: readonly Category[];
  activeProfile: Person;
  viewMonth: string;
  creditCards: readonly CreditCard[];
  initialCreditCardId?: number;
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
  initialCreditCardId,
  onSave,
  onClose,
  onInvalid,
}: Props) {
  const defaultCategory =
    categories.find(
      (category) => category.active && category.name === "Outros",
    ) ?? categories.find((category) => category.active);
  const [form, setForm] = useState(() =>
    expense
      ? {
          title: expense.title,
          amount: String(expense.amount),
          cat: expense.cat,
          categoryId: expense.categoryId ?? "",
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
          cat: defaultCategory?.name ?? "Outros",
          categoryId: defaultCategory?.id ?? "",
          who: activeProfile,
          date: `${viewMonth}-01`,
          personalLimitBucket: "",
          creditCardId: initialCreditCardId ? String(initialCreditCardId) : "",
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
          if (!form.title.trim() || !amount || amount < 0 || !form.categoryId) {
            onInvalid("Preencha descrição e valor.");
            return;
          }
          onSave(
            {
              id: expense?.id ?? Date.now(),
              title: form.title.trim(),
              amount,
              cat: form.cat,
              ...(form.categoryId ? { categoryId: form.categoryId } : {}),
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
              .filter(
                (card) =>
                  card.active &&
                  (form.who === "Casal" ||
                    card.owner === "Casal" ||
                    card.owner === form.who),
              )
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
          <CategorySelector
            categories={categories}
            valueId={form.categoryId || undefined}
            fallbackName={form.cat}
            onChange={(category) =>
              setForm({ ...form, cat: category.name, categoryId: category.id })
            }
          />
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
