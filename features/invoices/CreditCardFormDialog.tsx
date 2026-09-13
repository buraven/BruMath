"use client";

import { Check } from "lucide-react";
import { useState } from "react";
import { FormDialog } from "../../components/ui/FormDialog";
import { MoneyInput } from "../../components/ui/MoneyInput";
import type { CreditCard, Person } from "../../lib/app/AppTypes";

type Props = {
  card: CreditCard | null;
  activeProfile: Person;
  onSave: (card: CreditCard, editing: boolean) => void;
  onClose: () => void;
  onInvalid: (message: string) => void;
};

export function CreditCardFormDialog({
  card,
  activeProfile,
  onSave,
  onClose,
  onInvalid,
}: Props) {
  const [form, setForm] = useState(() =>
    card
      ? {
          name: card.name,
          issuer: card.issuer ?? "",
          owner: card.owner,
          creditLimit: String(card.creditLimit),
          closingDay: String(card.closingDay),
          dueDay: String(card.dueDay),
          appearance: card.appearance ?? "purple",
        }
      : {
          name: "",
          issuer: "",
          owner: activeProfile,
          creditLimit: "",
          closingDay: "20",
          dueDay: "27",
          appearance: "purple",
        },
  );
  const update = <Key extends keyof typeof form>(
    key: Key,
    value: (typeof form)[Key],
  ) => setForm((current) => ({ ...current, [key]: value }));

  return (
    <FormDialog
      title={card ? "Editar cartão" : "Novo cartão"}
      onClose={onClose}
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const creditLimit = Number(form.creditLimit.replace(",", "."));
          const closingDay = Number(form.closingDay);
          const dueDay = Number(form.dueDay);
          if (
            !form.name.trim() ||
            !Number.isFinite(creditLimit) ||
            creditLimit <= 0 ||
            !Number.isInteger(closingDay) ||
            closingDay < 1 ||
            closingDay > 31 ||
            !Number.isInteger(dueDay) ||
            dueDay < 1 ||
            dueDay > 31
          ) {
            onInvalid(
              "Preencha nome, limite, fechamento e vencimento válidos.",
            );
            return;
          }
          onSave(
            {
              id: card?.id ?? Date.now(),
              name: form.name.trim(),
              ...(form.issuer.trim() ? { issuer: form.issuer.trim() } : {}),
              owner: form.owner,
              creditLimit,
              closingDay,
              dueDay,
              appearance: form.appearance as CreditCard["appearance"],
              active: true,
            },
            Boolean(card),
          );
        }}
      >
        <label className="field">
          <span>Nome do cartão</span>
          <input
            value={form.name}
            onChange={(event) => update("name", event.target.value)}
            placeholder="Ex.: Nubank"
            required
          />
        </label>
        <div className="form-grid">
          <label className="field">
            <span>Instituição / bandeira</span>
            <input
              value={form.issuer}
              onChange={(event) => update("issuer", event.target.value)}
              placeholder="Ex.: Mastercard"
            />
          </label>
          <label className="field">
            <span>Titular</span>
            <select
              value={form.owner}
              onChange={(event) =>
                update("owner", event.target.value as Person)
              }
            >
              <option>Bruna</option>
              <option>Matheus</option>
              <option>Casal</option>
            </select>
          </label>
        </div>
        <label className="field">
          <span>Limite de crédito</span>
          <MoneyInput
            value={form.creditLimit}
            onValueChange={(value) => update("creditLimit", value)}
            placeholder="5.000,00"
            required
          />
        </label>
        <div className="form-grid">
          <label className="field">
            <span>Fecha no dia</span>
            <input
              type="number"
              min="1"
              max="31"
              value={form.closingDay}
              onChange={(event) => update("closingDay", event.target.value)}
            />
          </label>
          <label className="field">
            <span>Vence no dia</span>
            <input
              type="number"
              min="1"
              max="31"
              value={form.dueDay}
              onChange={(event) => update("dueDay", event.target.value)}
            />
          </label>
        </div>
        <button type="submit" className="primary-button">
          <Check size={17} /> Salvar cartão
        </button>
      </form>
    </FormDialog>
  );
}
