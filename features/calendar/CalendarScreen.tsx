"use client";

import {
  CalendarDays,
  CircleDollarSign,
  FastForward,
  Pencil,
  Plus,
  Trash2,
  WalletCards,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { Installment } from "../../lib/app/AppTypes";
import type { CalendarItemType } from "../../lib/finance/calendar";
import type { CalendarProjection } from "../../lib/finance/calendar";
import { isWithinProfileScope } from "../../lib/finance/profileScope";
import type { Person } from "../../lib/app/AppTypes";
import { CalendarDayAgenda } from "./CalendarDayAgenda";
import { CalendarGrid } from "./CalendarGrid";
import styles from "./CalendarScreen.module.css";

type Props = {
  month: string;
  monthLabel: string;
  projection: CalendarProjection;
  profile: Person;
  installments: readonly Installment[];
  formatMoney: (value: number) => string;
  formatDate: (value: string) => string;
  onPayInstallment: (id: number) => void;
  onAdvanceInstallment: (installment: Installment) => void;
  onQuitInstallment: (installment: Installment) => void;
  onCreateInstallment: () => void;
  onEditInstallment: (installment: Installment) => void;
  onDeleteInstallment: (id: number) => void;
  onOpenInvoices: () => void;
};

type Filter = "all" | "history" | "commitments";

function includesFilter(type: CalendarItemType, filter: Filter) {
  if (filter === "all") return true;
  const historical = type === "expense" || type === "income";
  return filter === "history" ? historical : !historical;
}

export function CalendarScreen({
  month,
  monthLabel,
  projection,
  profile,
  installments,
  formatMoney,
  formatDate,
  onPayInstallment,
  onAdvanceInstallment,
  onQuitInstallment,
  onCreateInstallment,
  onEditInstallment,
  onDeleteInstallment,
  onOpenInvoices,
}: Props) {
  const [filter, setFilter] = useState<Filter>("all");
  const [selectedDate, setSelectedDate] = useState(`${month}-01`);

  useEffect(() => {
    setSelectedDate(`${month}-01`);
  }, [month]);

  const visibleItems = useMemo(
    () => projection.items.filter((item) => includesFilter(item.type, filter)),
    [filter, projection.items],
  );
  const visibleByDate = useMemo(() => {
    const byDate = new Map<string, typeof visibleItems>();
    for (const item of visibleItems) {
      byDate.set(item.date, [...(byDate.get(item.date) ?? []), item]);
    }
    return byDate;
  }, [visibleItems]);
  const selectedItems = visibleByDate.get(selectedDate) ?? [];

  const findInstallment = (id: number) =>
    installments.find((item) => item.id === id);
  const activeInstallments = installments.filter(
    (item) =>
      item.paidInstallments < item.totalInstallments &&
      isWithinProfileScope(item.who, profile),
  );

  return (
    <section
      className={styles.screen}
      data-calendar-screen
      aria-labelledby="calendar-title"
    >
      <header className={styles.header}>
        <div>
          <span className={styles.eyebrow}>
            <CalendarDays size={15} /> Calendário & compromissos
          </span>
          <h1 id="calendar-title">Planeje o mês com clareza</h1>
          <p>{monthLabel} · Movimentações reais e compromissos conhecidos.</p>
        </div>
        <div className={styles.headerActions}>
          <div className={styles.legend} aria-label="Legenda do calendário">
            <span>
              <i className={styles.expense} /> Histórico
            </span>
            <span>
              <i className={styles.installment_due} /> Compromisso
            </span>
            <span>
              <i className={styles.invoice_due} /> Fatura
            </span>
          </div>
          <button
            type="button"
            className="primary-button compact"
            onClick={onCreateInstallment}
          >
            <Plus size={16} /> Nova parcela
          </button>
        </div>
      </header>

      <div className={styles.summary} aria-label="Resumo do calendário">
        <article>
          <span>Saldo base</span>
          <strong>{formatMoney(projection.forecast.baseBalance)}</strong>
          <small>Sem recalcular o mês</small>
        </article>
        <article>
          <span>Compromissos conhecidos</span>
          <strong>
            {formatMoney(projection.forecast.knownFutureCommitments)}
          </strong>
          <small>Parcelas sem cartão ainda a vencer</small>
        </article>
        <article>
          <span>Saldo projetado</span>
          <strong>{formatMoney(projection.forecast.projectedBalance)}</strong>
          <small>Sem duplicar compras de cartão</small>
        </article>
        <article>
          <span>Itens no mês</span>
          <strong>{projection.items.length}</strong>
          <small>Histórico e compromissos</small>
        </article>
      </div>

      <div className={styles.filters} aria-label="Filtrar calendário">
        {(["all", "history", "commitments"] as const).map((value) => (
          <button
            key={value}
            type="button"
            className={filter === value ? styles.activeFilter : ""}
            onClick={() => setFilter(value)}
          >
            {value === "all"
              ? "Todos"
              : value === "history"
                ? "Histórico"
                : "Compromissos"}
          </button>
        ))}
      </div>

      <div className={styles.mainGrid}>
        <CalendarGrid
          month={month}
          itemsByDate={visibleByDate}
          selectedDate={selectedDate}
          onSelectDate={setSelectedDate}
        />
        <CalendarDayAgenda
          date={selectedDate}
          items={selectedItems}
          formatDate={formatDate}
          formatMoney={formatMoney}
          onPayInstallment={onPayInstallment}
          onAdvanceInstallment={(id) => {
            const item = findInstallment(id);
            if (item) onAdvanceInstallment(item);
          }}
          onQuitInstallment={(id) => {
            const item = findInstallment(id);
            if (item) onQuitInstallment(item);
          }}
          onOpenInvoices={onOpenInvoices}
        />
      </div>

      <section
        className={styles.installments}
        aria-labelledby="calendar-installments-title"
      >
        <header>
          <div>
            <span className={styles.eyebrow}>
              <WalletCards size={15} /> Parcelas ativas
            </span>
            <h2 id="calendar-installments-title">
              Acompanhe seus compromissos
            </h2>
          </div>
          <span>{activeInstallments.length} ativos</span>
        </header>
        {activeInstallments.length ? (
          activeInstallments.map((item) => (
            <article key={item.id} className={styles.installmentRow}>
              <div>
                <strong>{item.title}</strong>
                <small>
                  {item.category} · Próximo: {formatDate(item.nextDue)}
                </small>
              </div>
              <span>
                {item.paidInstallments} pagas ·{" "}
                {item.totalInstallments - item.paidInstallments} restantes
              </span>
              <b>{formatMoney(item.amount)}/mês</b>
              <div className={styles.installmentActions}>
                <button type="button" onClick={() => onPayInstallment(item.id)}>
                  <CircleDollarSign size={13} /> Pagar 1
                </button>
                <button
                  type="button"
                  onClick={() => onAdvanceInstallment(item)}
                >
                  <FastForward size={13} /> Adiantar
                </button>
                <button type="button" onClick={() => onQuitInstallment(item)}>
                  Quitar
                </button>
                <button
                  type="button"
                  aria-label={`Editar ${item.title}`}
                  onClick={() => onEditInstallment(item)}
                >
                  <Pencil size={13} />
                </button>
                <button
                  type="button"
                  aria-label={`Excluir ${item.title}`}
                  onClick={() => onDeleteInstallment(item.id)}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </article>
          ))
        ) : (
          <div className={styles.emptyAgenda}>Nenhuma parcela ativa.</div>
        )}
      </section>
    </section>
  );
}
