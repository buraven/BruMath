"use client";

import { Check } from "lucide-react";
import { useState } from "react";
import { DateInput } from "../../components/ui/DateInput";
import { FormDialog } from "../../components/ui/FormDialog";
import { MoneyInput } from "../../components/ui/MoneyInput";
import type { Category, CreditCard, Person } from "../../lib/app/AppTypes";
import { CategorySelect } from "../categories/CategorySelect";

type Props = {
  card: CreditCard;
  referenceMonth: string;
  initialDueDate: string;
  categories: readonly Category[];
  activeProfile: Person;
  onSave: (input: {
    title: string;
    category: string;
    categoryId: string;
    who: Person;
    totalAmount: number;
    totalInstallments: number;
    firstDueDate: string;
  }) => void;
  onClose: () => void;
  onInvalid: (message: string) => void;
};

export function InvoiceInstallmentPurchaseDialog({
  card,
  referenceMonth,
  initialDueDate,
  categories,
  activeProfile,
  onSave,
  onClose,
  onInvalid,
}: Props) {
  const defaultCategory =
    categories.find(
      (category) => category.active && category.name === "Outros",
    ) ?? categories.find((category) => category.active);
  const [form, setForm] = useState({
    title: "",
    category: defaultCategory?.name ?? "Outros",
    categoryId: defaultCategory?.id ?? "",
    who: activeProfile,
    totalAmount: "",
    totalInstallments: "2",
    firstDueDate: initialDueDate,
  });

  return (
    <FormDialog title="Adicionar compra parcelada" onClose={onClose}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const totalAmount = Number(form.totalAmount.replace(",", "."));
          const totalInstallments = Number(form.totalInstallments);
          if (
            !form.title.trim() ||
            !form.categoryId ||
            !Number.isFinite(totalAmount) ||
            totalAmount <= 0 ||
            !Number.isInteger(totalInstallments) ||
            totalInstallments < 1 ||
            !form.firstDueDate
          ) {
            onInvalid("Preencha descrição, valor e quantidade de parcelas.");
            return;
          }
          onSave({
            title: form.title.trim(),
            category: form.category,
            categoryId: form.categoryId,
            who: form.who,
            totalAmount,
            totalInstallments,
            firstDueDate: form.firstDueDate,
          });
        }}
      >
        <p className="form-help">
          A primeira parcela será incluída na competência {referenceMonth}.
        </p>
        <label className="field">
          <span>O que foi?</span>
          <input
            value={form.title}
            onChange={(event) =>
              setForm({ ...form, title: event.target.value })
            }
            placeholder="Ex.: Notebook"
            required
          />
        </label>
        <label className="field">
          <span>Cartão</span>
          <select value={String(card.id)} disabled>
            <option value={card.id}>
              {card.name} · {card.owner}
            </option>
          </select>
        </label>
        <div className="form-grid">
          <label className="field">
            <span>Valor total da compra</span>
            <MoneyInput
              value={form.totalAmount}
              onValueChange={(totalAmount) => setForm({ ...form, totalAmount })}
              placeholder="600,00"
              required
            />
          </label>
          <label className="field">
            <span>Quantidade de parcelas</span>
            <input
              type="number"
              min="1"
              value={form.totalInstallments}
              onChange={(event) =>
                setForm({ ...form, totalInstallments: event.target.value })
              }
              required
            />
          </label>
        </div>
        <div className="form-grid">
          <CategorySelect
            categories={categories}
            valueId={form.categoryId || undefined}
            fallbackName={form.category}
            onChange={(category) =>
              setForm({
                ...form,
                category: category.name,
                categoryId: category.id,
              })
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
          <span>Primeiro vencimento</span>
          <DateInput
            value={form.firstDueDate}
            onValueChange={(firstDueDate) => setForm({ ...form, firstDueDate })}
          />
        </label>
        <button type="submit" className="primary-button">
          <Check size={17} /> Salvar compra parcelada
        </button>
      </form>
    </FormDialog>
  );
}
