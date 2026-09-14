"use client";

import {
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  CreditCard,
  Gauge,
  Plus,
  ReceiptText,
  WalletCards,
} from "lucide-react";
import { type ReactNode, useMemo, useState } from "react";
import { ExpenseList } from "../../components/finance/ExpenseList";
import type {
  CreditCard as CreditCardModel,
  Expense,
} from "../../lib/app/AppTypes";
import {
  filterInvoices,
  type DerivedInvoice,
  type InvoiceFilter,
} from "../../lib/finance/invoices";
import styles from "./InvoicesScreen.module.css";

type Props = {
  monthLabel: string;
  invoices: readonly DerivedInvoice[];
  cards: readonly CreditCardModel[];
  formatMoney: (value: number) => string;
  formatDate: (value: string) => string;
  onCreateCard: () => void;
  onEditCard: (card: CreditCardModel) => void;
  onPay: (invoice: DerivedInvoice) => void;
  onEditExpense: (expense: Expense) => void;
  onDeleteExpense: (id: number) => void;
};

export function InvoicesScreen(props: Props) {
  const [filter, setFilter] = useState<InvoiceFilter>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = props.invoices.find((invoice) => invoice.id === selectedId);
  const visible = useMemo(
    () => filterInvoices(props.invoices, filter),
    [filter, props.invoices],
  );

  if (selected) {
    return (
      <InvoiceDetail
        invoice={selected}
        {...props}
        onBack={() => setSelectedId(null)}
      />
    );
  }

  const open = props.invoices.filter((invoice) => invoice.status === "open");
  const total = open.reduce((sum, invoice) => sum + invoice.total, 0);
  const paid = props.invoices
    .filter((invoice) => invoice.status === "paid")
    .reduce((sum, invoice) => sum + invoice.total, 0);
  const nextDue = open.map((invoice) => invoice.dueDate).sort()[0];

  return (
    <section className={styles.screen} aria-labelledby="invoices-title">
      <header className={styles.header}>
        <div>
          <h1 id="invoices-title">Faturas</h1>
          <p>{props.monthLabel} · Acompanhe seus fechamentos e pagamentos.</p>
        </div>
        <button
          type="button"
          className="primary-button compact"
          onClick={props.onCreateCard}
        >
          <Plus size={17} /> Novo cartão
        </button>
      </header>

      <div className={styles.metrics} aria-label="Resumo das faturas">
        <Metric
          icon={<WalletCards size={18} />}
          label="Total a pagar"
          value={props.formatMoney(total)}
          detail={`${open.length} fatura${open.length === 1 ? "" : "s"} aberta${open.length === 1 ? "" : "s"}`}
        />
        <Metric
          icon={<CalendarClock size={18} />}
          label="Próximo vencimento"
          value={nextDue ? props.formatDate(nextDue) : "—"}
          detail={nextDue ? "Fatura em aberto" : "Sem faturas abertas"}
        />
        <Metric
          icon={<Gauge size={18} />}
          label="Total previsto"
          value={props.formatMoney(
            props.invoices.reduce((sum, invoice) => sum + invoice.total, 0),
          )}
          detail="Faturas do período"
        />
        <Metric
          icon={<CheckCircle2 size={18} />}
          label="Total pago"
          value={props.formatMoney(paid)}
          detail="Faturas quitadas"
        />
      </div>

      <div className={styles.toolbar}>
        <div className={styles.filters} aria-label="Filtrar faturas">
          {(
            [
              ["all", "Todas"],
              ["open", "Abertas"],
              ["due", "A vencer"],
              ["paid", "Pagas"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              className={filter === value ? styles.activeFilter : ""}
              onClick={() => setFilter(value)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {visible.length ? (
        <div className={styles.list}>
          {visible.map((invoice) => (
            <InvoiceCard
              key={invoice.id}
              invoice={invoice}
              formatMoney={props.formatMoney}
              formatDate={props.formatDate}
              onOpen={() => setSelectedId(invoice.id)}
            />
          ))}
        </div>
      ) : (
        <div className={styles.empty}>
          <CreditCard size={25} />
          <h2>
            {props.cards.length
              ? "Nenhuma fatura neste filtro"
              : "Comece cadastrando um cartão"}
          </h2>
          <p>
            {props.cards.length
              ? "Altere o filtro para ver os cartões e faturas disponíveis neste período."
              : "Cadastre um cartão para acompanhar faturas, fechamento e limite de crédito."}
          </p>
          {!props.cards.length && (
            <button
              type="button"
              className="primary-button"
              onClick={props.onCreateCard}
            >
              <Plus size={17} /> Novo cartão
            </button>
          )}
        </div>
      )}
    </section>
  );
}

function Metric({
  icon,
  label,
  value,
  detail,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <article>
      <span className={styles.metricIcon}>{icon}</span>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        <small>{detail}</small>
      </div>
    </article>
  );
}

function InvoiceCard({
  invoice,
  formatMoney,
  formatDate,
  onOpen,
}: {
  invoice: DerivedInvoice;
  formatMoney: Props["formatMoney"];
  formatDate: Props["formatDate"];
  onOpen: () => void;
}) {
  const used = Math.min(100, invoice.utilization);
  const isEmpty = invoice.total === 0;
  return (
    <article className={styles.invoiceCard}>
      <section className={styles.cardIdentity}>
        <div className={styles.invoiceHead}>
          <span
            className={`${styles.cardIcon} ${styles[invoice.card.appearance ?? "purple"]}`}
          >
            {invoice.card.name.slice(0, 2)}
          </span>
          <div className={styles.cardTitle}>
            <strong>{invoice.card.name}</strong>
            <small>{invoice.card.issuer ?? invoice.card.owner}</small>
          </div>
          <span
            className={invoice.status === "paid" ? styles.paid : styles.open}
          >
            {invoice.status === "paid" ? "Paga" : "Aberta"}
          </span>
        </div>
        <div className={styles.cycle}>
          <span>Fecha em</span>
          <strong>{formatDate(invoice.closingDate)}</strong>
          <small>Vence em {formatDate(invoice.dueDate)}</small>
        </div>
      </section>

      <section className={styles.invoiceValue}>
        <span>Valor atual da fatura</span>
        <strong>{formatMoney(invoice.total)}</strong>
        <div className={styles.progressMeta}>
          <span>{Math.round(invoice.utilization)}% do limite utilizado</span>
          <strong>{formatMoney(invoice.availableCredit)} disponível</strong>
        </div>
        <progress
          value={used}
          max={100}
          aria-label={`Uso do limite ${invoice.card.name}`}
        />
      </section>

      <section className={styles.categorySummary}>
        <header>
          <strong>Resumo da fatura</strong>
          <span>{isEmpty ? "Sem lançamentos" : "Por categoria"}</span>
        </header>
        {isEmpty ? (
          <p>As compras vinculadas a este cartão aparecerão neste ciclo.</p>
        ) : (
          invoice.categoryTotals.slice(0, 4).map((item) => (
            <span key={item.category}>
              {item.category}
              <strong>{formatMoney(item.amount)}</strong>
            </span>
          ))
        )}
        <button type="button" className={styles.detailButton} onClick={onOpen}>
          Ver detalhes da fatura
        </button>
      </section>
    </article>
  );
}

function InvoiceDetail({
  invoice,
  formatMoney,
  formatDate,
  onBack,
  onEditCard,
  onPay,
  onEditExpense,
  onDeleteExpense,
}: Props & { invoice: DerivedInvoice; onBack: () => void }) {
  return (
    <section className={styles.screen} aria-labelledby="invoice-detail-title">
      <button className={styles.back} type="button" onClick={onBack}>
        <ArrowLeft size={16} /> Voltar para faturas
      </button>
      <header className={styles.detailHeader}>
        <div>
          <span className={styles.eyebrow}>
            <ReceiptText size={15} /> Fatura
          </span>
          <h1 id="invoice-detail-title">{invoice.card.name}</h1>
          <p>
            Fecha {formatDate(invoice.closingDate)} · Vence{" "}
            {formatDate(invoice.dueDate)}
          </p>
        </div>
        <button
          type="button"
          className="secondary-button"
          onClick={() => onEditCard(invoice.card)}
        >
          Editar cartão
        </button>
      </header>
      <div className={styles.detailGrid}>
        <aside className={styles.invoiceSummary}>
          <span>Valor atual da fatura</span>
          <strong>{formatMoney(invoice.total)}</strong>
          <progress value={Math.min(100, invoice.utilization)} max={100} />
          <p>
            {formatMoney(invoice.availableCredit)} disponível de{" "}
            {formatMoney(invoice.card.creditLimit)}
          </p>
          {invoice.status === "open" ? (
            <button
              type="button"
              className="primary-button"
              onClick={() => onPay(invoice)}
            >
              <CheckCircle2 size={17} /> Pagar fatura
            </button>
          ) : (
            <p className={styles.paid}>Fatura paga</p>
          )}
        </aside>
        <section className={styles.entries}>
          <header>
            <h2>Lançamentos</h2>
            <span>
              {invoice.expenses.length + invoice.installments.length} itens
            </span>
          </header>
          {invoice.expenses.length ? (
            <ExpenseList
              expenses={[...invoice.expenses]}
              onEdit={onEditExpense}
              onDelete={onDeleteExpense}
              formatMoney={formatMoney}
              formatDate={formatDate}
            />
          ) : (
            <p className={styles.noEntries}>Nenhum lançamento neste ciclo.</p>
          )}
          {invoice.installments.length > 0 && (
            <ul className={styles.installments} aria-label="Parcelas da fatura">
              {invoice.installments.map((installment) => (
                <li key={installment.id}>
                  <span>
                    <strong>{installment.title}</strong>
                    <small>
                      {installment.category} · parcela{" "}
                      {installment.currentInstallment}/
                      {installment.totalInstallments}
                    </small>
                  </span>
                  <strong>{formatMoney(installment.amount)}</strong>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </section>
  );
}
