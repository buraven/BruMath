"use client";

import {
  CalendarClock,
  CircleDollarSign,
  FastForward,
  ReceiptText,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import type { CalendarItem } from "../../lib/finance/calendar";
import styles from "./CalendarScreen.module.css";

type Props = {
  date: string;
  items: readonly CalendarItem[];
  formatDate: (date: string) => string;
  formatMoney: (value: number) => string;
  onPayInstallment: (id: number) => void;
  onAdvanceInstallment: (id: number) => void;
  onQuitInstallment: (id: number) => void;
  onOpenInvoices: () => void;
};

function itemMeta(item: CalendarItem) {
  switch (item.type) {
    case "expense":
      return { label: "Gasto registrado", icon: <TrendingDown size={15} /> };
    case "income":
      return { label: "Entrada registrada", icon: <TrendingUp size={15} /> };
    case "installment_due":
      return { label: "Compromisso", icon: <CalendarClock size={15} /> };
    case "invoice_due":
      return {
        label: item.status === "paid" ? "Fatura paga" : "Vencimento de fatura",
        icon: <ReceiptText size={15} />,
      };
    case "invoice_closing":
      return {
        label: "Fechamento do cartão",
        icon: <CalendarClock size={15} />,
      };
  }
}

export function CalendarDayAgenda({
  date,
  items,
  formatDate,
  formatMoney,
  onPayInstallment,
  onAdvanceInstallment,
  onQuitInstallment,
  onOpenInvoices,
}: Props) {
  return (
    <aside className={styles.agenda} aria-label="Agenda do dia">
      <header>
        <span>Agenda do dia</span>
        <h2 id="calendar-agenda-title">{formatDate(date)}</h2>
      </header>
      {items.length ? (
        <div className={styles.agendaItems}>
          {items.map((item) => {
            const meta = itemMeta(item);
            return (
              <article className={styles.agendaItem} key={item.id}>
                <span className={`${styles.itemIcon} ${styles[item.type]}`}>
                  {meta.icon}
                </span>
                <div>
                  <strong>{item.title}</strong>
                  <small>
                    {meta.label}
                    {item.category ? ` · ${item.category}` : ""}
                    {item.owner ? ` · ${item.owner}` : ""}
                  </small>
                </div>
                {typeof item.amount === "number" ? (
                  <b>{formatMoney(item.amount)}</b>
                ) : null}
                {item.type === "installment_due" && item.installmentId ? (
                  <div className={styles.itemActions}>
                    <button
                      type="button"
                      onClick={() => onPayInstallment(item.installmentId!)}
                    >
                      <CircleDollarSign size={13} /> Pagar 1
                    </button>
                    <button
                      type="button"
                      onClick={() => onAdvanceInstallment(item.installmentId!)}
                    >
                      <FastForward size={13} /> Adiantar
                    </button>
                    <button
                      type="button"
                      onClick={() => onQuitInstallment(item.installmentId!)}
                    >
                      Quitar
                    </button>
                  </div>
                ) : null}
                {(item.type === "invoice_due" ||
                  item.type === "invoice_closing") && (
                  <button
                    type="button"
                    className={styles.invoiceLink}
                    onClick={onOpenInvoices}
                  >
                    Ver faturas
                  </button>
                )}
              </article>
            );
          })}
        </div>
      ) : (
        <div className={styles.emptyAgenda}>
          Nenhuma movimentação ou compromisso neste dia.
        </div>
      )}
    </aside>
  );
}
