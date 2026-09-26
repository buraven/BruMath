"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { DateInput } from "../../components/ui/DateInput";
import { FormDialog } from "../../components/ui/FormDialog";
import { MoneyInput } from "../../components/ui/MoneyInput";
import type {
  Category,
  CreditCard,
  Installment,
  Person,
} from "../../lib/app/AppTypes";
import { CategorySelect } from "../categories/CategorySelect";

type Props = {
  installment: Installment | null;
  categories: readonly Category[];
  activeProfile: Person;
  defaultNextDue: string;
  creditCards: readonly CreditCard[];
  onSave: (installment: Installment, isEditing: boolean) => void;
  onClose: () => void;
  onInvalid: (message: string) => void;
};

export function InstallmentFormDialog({
  installment,
  categories,
  activeProfile,
  defaultNextDue,
  creditCards,
  onSave,
  onClose,
  onInvalid,
}: Props) {
  const defaultCategory =
    categories.find(
      (category) => category.active && category.name === "Outros",
    ) ?? categories.find((category) => category.active);
  const [form, setForm] = useState(() =>
    installment
      ? {
          title: installment.title,
          amount: String(installment.amount),
          category: installment.category,
          categoryId: installment.categoryId ?? "",
          who: installment.who,
          total: String(installment.totalInstallments),
          paid: String(installment.paidInstallments),
          nextDue: installment.nextDue,
          creditCardId: installment.creditCardId
            ? String(installment.creditCardId)
            : "",
        }
      : {
          title: "",
          amount: "",
          category: defaultCategory?.name ?? "Outros",
          categoryId: defaultCategory?.id ?? "",
          who: activeProfile,
          total: "",
          paid: "0",
          nextDue: defaultNextDue,
          creditCardId: "",
        },
  );

  return (
    <FormDialog
      title={installment ? "Editar parcela" : "Nova parcela"}
      onClose={onClose}
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const amount = Number(form.amount.replace(",", "."));
          const total = Number(form.total);
          const paid = Math.max(0, Math.min(Number(form.paid) || 0, total));
          if (
            !form.title.trim() ||
            !amount ||
            amount < 0 ||
            !total ||
            total < 1 ||
            !form.categoryId
          ) {
            onInvalid("Preencha os dados da parcela.");
            return;
          }
          onSave(
            {
              id: installment?.id ?? Date.now(),
              title: form.title.trim(),
              amount,
              category: form.category,
              ...(form.categoryId ? { categoryId: form.categoryId } : {}),
              who: form.who,
              totalInstallments: total,
              paidInstallments: paid,
              nextDue: form.nextDue || defaultNextDue,
              ...(form.creditCardId
                ? { creditCardId: Number(form.creditCardId) }
                : {}),
            },
            Boolean(installment),
          );
        }}
      >
        <label className="field">
          <span>Nome</span>
          <input
            value={form.title}
            onChange={(event) =>
              setForm({ ...form, title: event.target.value })
            }
            placeholder="Ex.: Notebook"
            required
          />
        </label>
        <div className="form-grid">
          <label className="field">
            <span>Valor mensal</span>
            <MoneyInput
              value={form.amount}
              onValueChange={(amount) => setForm({ ...form, amount })}
              placeholder="300,00"
              required
            />
          </label>
          <label className="field">
            <span>Total de parcelas</span>
            <input
              type="number"
              min="1"
              value={form.total}
              onChange={(event) =>
                setForm({ ...form, total: event.target.value })
              }
              required
            />
          </label>
        </div>
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
                  {card.name}
                </option>
              ))}
          </select>
        </label>
        <div className="form-grid">
          <label className="field">
            <span>Já pagas</span>
            <input
              type="number"
              min="0"
              value={form.paid}
              onChange={(event) =>
                setForm({ ...form, paid: event.target.value })
              }
            />
          </label>
          <label className="field">
            <span>Próximo vencimento</span>
            <DateInput
              value={form.nextDue}
              onValueChange={(nextDue) => setForm({ ...form, nextDue })}
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
        <button type="submit" className="primary-button">
          <Check size={17} /> Salvar parcela
        </button>
      </form>
    </FormDialog>
  );
}
