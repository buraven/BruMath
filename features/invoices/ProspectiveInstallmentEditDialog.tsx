"use client";

import { Check } from "lucide-react";
import { useState } from "react";
import { DateInput } from "../../components/ui/DateInput";
import { FormDialog } from "../../components/ui/FormDialog";
import { MoneyInput } from "../../components/ui/MoneyInput";
import type {
  Category,
  CreditCard,
  Installment,
  InstallmentInvoiceEvent,
  InstallmentScheduleItem,
  InstallmentSettlementEvent,
  Person,
} from "../../lib/app/AppTypes";
import type { ProspectiveInstallmentEdit } from "../../lib/finance/installmentProspectiveEdit";
import {
  completeInstallmentSchedule,
  isInstallmentScheduleItemHistorical,
} from "../../lib/finance/installmentScheduleHistory";
import { CategorySelect } from "../categories/CategorySelect";

type Props = {
  installment: Installment;
  scheduleItems: readonly InstallmentScheduleItem[];
  installmentInvoiceEvents: readonly InstallmentInvoiceEvent[];
  installmentSettlementEvents: readonly InstallmentSettlementEvent[];
  categories: readonly Category[];
  creditCards: readonly CreditCard[];
  onSave: (edit: ProspectiveInstallmentEdit) => void;
  onClose: () => void;
};

function friendlyError(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  if (message.includes("Não há parcelas futuras"))
    return "Todas as parcelas já foram consolidadas. Você ainda pode corrigir descrição, categoria e responsável.";
  if (message.includes("legado"))
    return "Este parcelamento foi criado no formato anterior e ainda não suporta alteração das parcelas futuras.";
  if (message.includes("incompleto"))
    return "Este parcelamento precisa de revisão antes de alterar as parcelas futuras.";
  if (message.includes("quantidade") || message.includes("reorganizar"))
    return "A quantidade informada não é compatível com as parcelas já consolidadas.";
  return message || "Não foi possível atualizar este parcelamento.";
}

export function ProspectiveInstallmentEditDialog({
  installment,
  scheduleItems,
  installmentInvoiceEvents,
  installmentSettlementEvents,
  categories,
  creditCards,
  onSave,
  onClose,
}: Props) {
  const schedule = completeInstallmentSchedule(installment, scheduleItems);
  const historical = (schedule ?? []).filter((item) =>
    isInstallmentScheduleItemHistorical(item, {
      installmentInvoiceEvents,
      installmentSettlementEvents,
    }),
  );
  const future = (schedule ?? []).filter(
    (item) =>
      !isInstallmentScheduleItemHistorical(item, {
        installmentInvoiceEvents,
        installmentSettlementEvents,
      }),
  );
  const canEditFinancial = Boolean(schedule && future.length);
  const firstFuture = future[0];
  const [form, setForm] = useState(() => ({
    title: installment.title,
    category: installment.category,
    categoryId: installment.categoryId ?? "",
    who: installment.who,
    futureTotalAmount: String(
      future.reduce((total, item) => total + item.amount, 0),
    ),
    futureInstallmentCount: String(future.length),
    firstFutureInvoiceReferenceMonth: firstFuture?.invoiceReferenceMonth ?? "",
    firstFutureDueDate: firstFuture?.dueDate ?? "",
    futureCreditCardId: firstFuture?.creditCardId
      ? String(firstFuture.creditCardId)
      : "",
  }));
  const [error, setError] = useState("");

  return (
    <FormDialog title="Editar compra parcelada" onClose={onClose}>
      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          if (!form.title.trim() || !form.categoryId) {
            setError("Informe a descrição e a categoria da compra.");
            return;
          }
          const edit: ProspectiveInstallmentEdit = {
            title: form.title.trim(),
            category: form.category,
            categoryId: form.categoryId,
            who: form.who,
          };
          if (canEditFinancial) {
            const futureTotalAmount = Number(
              form.futureTotalAmount.replace(",", "."),
            );
            const futureInstallmentCount = Number(form.futureInstallmentCount);
            if (
              !Number.isFinite(futureTotalAmount) ||
              futureTotalAmount < 0 ||
              !Number.isInteger(futureInstallmentCount) ||
              futureInstallmentCount < 1
            ) {
              setError(
                "Informe um valor e uma quantidade válidos para as parcelas futuras.",
              );
              return;
            }
            Object.assign(edit, {
              futureTotalAmount,
              futureInstallmentCount,
              firstFutureInvoiceReferenceMonth:
                form.firstFutureInvoiceReferenceMonth || null,
              firstFutureDueDate: form.firstFutureDueDate || null,
              futureCreditCardId: form.futureCreditCardId
                ? Number(form.futureCreditCardId)
                : null,
            });
          }
          try {
            onSave(edit);
          } catch (saveError) {
            setError(friendlyError(saveError));
          }
        }}
      >
        <p className="form-help" aria-live="polite">
          {historical.length} de{" "}
          {schedule?.length ?? installment.totalInstallments} parcelas
          consolidadas · {future.length} parcelas futuras
        </p>
        {!schedule ? (
          <p className="form-help" role="status">
            Este parcelamento foi criado no formato anterior e ainda não suporta
            alteração das parcelas futuras.
          </p>
        ) : !canEditFinancial ? (
          <p className="form-help" role="status">
            Todas as parcelas já foram consolidadas.
          </p>
        ) : (
          <p className="form-help">
            Parcelas já consolidadas permanecem inalteradas.
          </p>
        )}
        <label className="field">
          <span>Descrição</span>
          <input
            value={form.title}
            onChange={(event) =>
              setForm({ ...form, title: event.target.value })
            }
            required
          />
        </label>
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
        <fieldset className="prospective-fields" disabled={!canEditFinancial}>
          <legend>Parcelas futuras</legend>
          <div className="form-grid">
            <label className="field">
              <span>Total futuro restante</span>
              <MoneyInput
                value={form.futureTotalAmount}
                onValueChange={(futureTotalAmount) =>
                  setForm({ ...form, futureTotalAmount })
                }
                required={canEditFinancial}
              />
            </label>
            <label className="field">
              <span>Quantidade de parcelas futuras</span>
              <input
                type="number"
                min="1"
                value={form.futureInstallmentCount}
                onChange={(event) =>
                  setForm({
                    ...form,
                    futureInstallmentCount: event.target.value,
                  })
                }
                required={canEditFinancial}
              />
            </label>
          </div>
          <div className="form-grid">
            <label className="field">
              <span>Primeira competência futura</span>
              <input
                type="month"
                value={form.firstFutureInvoiceReferenceMonth}
                onChange={(event) =>
                  setForm({
                    ...form,
                    firstFutureInvoiceReferenceMonth: event.target.value,
                  })
                }
              />
            </label>
            <label className="field">
              <span>Primeiro vencimento futuro</span>
              <DateInput
                value={form.firstFutureDueDate}
                onValueChange={(firstFutureDueDate) =>
                  setForm({ ...form, firstFutureDueDate })
                }
              />
            </label>
          </div>
          <label className="field">
            <span>Cartão das parcelas futuras</span>
            <select
              value={form.futureCreditCardId}
              onChange={(event) =>
                setForm({ ...form, futureCreditCardId: event.target.value })
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
        </fieldset>
        {error ? <small role="alert">{error}</small> : null}
        <button type="submit" className="primary-button">
          <Check size={17} /> Salvar alterações
        </button>
      </form>
    </FormDialog>
  );
}
