"use client";

import {
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  FastForward,
  Pencil,
  Plus,
  CircleDollarSign,
  ReceiptText,
  Trash2,
} from "lucide-react";
import { useMemo, type ReactNode } from "react";
import styles from "./FutureScreen.module.css";

type Installment = {
  id: number;
  title: string;
  category: string;
  who: "Bruna" | "Matheus" | "Casal";
  amount: number;
  totalInstallments: number;
  paidInstallments: number;
  nextDue: string;
};

type FutureScreenProps = {
  monthKey: string;
  monthLabel: string;
  available: number;
  installments: Installment[];
  formatMoney: (value: number) => string;
  formatDate: (value: string) => string;
  renderIcon: (category: string) => ReactNode;
  onCreate: () => void;
  onPay: (id: number, count: number) => void;
  onAdvance: (installment: Installment) => void;
  onQuit: (installment: Installment) => void;
  onEdit: (installment: Installment) => void;
  onDelete: (id: number) => void;
};

export function FutureScreen({
  monthKey,
  monthLabel,
  available,
  installments,
  formatMoney,
  formatDate,
  renderIcon,
  onCreate,
  onPay,
  onAdvance,
  onQuit,
  onEdit,
  onDelete,
}: FutureScreenProps) {
  const activeInstallments = installments.filter(
    (item) => item.paidInstallments < item.totalInstallments,
  );
  const dueThisMonth = useMemo(
    () =>
      activeInstallments.filter((item) => item.nextDue.startsWith(monthKey)),
    [activeInstallments, monthKey],
  );
  const dueTotal = dueThisMonth.reduce((sum, item) => sum + item.amount, 0);
  const remaining = activeInstallments.reduce(
    (sum, item) => sum + item.totalInstallments - item.paidInstallments,
    0,
  );

  return (
    <section className={styles.screen} aria-labelledby="future-title">
      <header className={styles.header}>
        <div>
          <span className={styles.eyebrow}>
            <CalendarDays size={15} /> Futuro
          </span>
          <h1 id="future-title">Compromissos e parcelas</h1>
          <p>Planeje o que vence e veja o impacto dos próximos pagamentos.</p>
        </div>
        <button
          type="button"
          className="primary-button compact"
          onClick={onCreate}
        >
          <Plus size={17} /> Novo compromisso
        </button>
      </header>

      <div className={styles.summary}>
        <article>
          <span>Compromissos em {monthLabel}</span>
          <strong>{formatMoney(dueTotal)}</strong>
          <small>{dueThisMonth.length} com vencimento neste mês</small>
        </article>
        <article>
          <span>Saldo após compromissos</span>
          <strong>{formatMoney(available - dueTotal)}</strong>
          <small>Previsão com os vencimentos abaixo</small>
        </article>
        <article>
          <span>Parcelas restantes</span>
          <strong>{remaining}</strong>
          <small>{activeInstallments.length} parcelados ativos</small>
        </article>
      </div>

      <div className={styles.columns}>
        <section
          className={styles.commitments}
          aria-labelledby="upcoming-title"
        >
          <header className={styles.sectionHeader}>
            <div>
              <span className={styles.eyebrow}>
                <ReceiptText size={15} /> Próximos compromissos
              </span>
              <h2 id="upcoming-title">{monthLabel}</h2>
            </div>
            <span>{dueThisMonth.length} itens</span>
          </header>

          {dueThisMonth.length ? (
            <div className={styles.commitmentList}>
              {dueThisMonth.map((item) => (
                <article className={styles.commitment} key={item.id}>
                  <div className={styles.icon}>{renderIcon(item.category)}</div>
                  <div>
                    <strong>{item.title}</strong>
                    <span>
                      {item.category} · vence {formatDate(item.nextDue)}
                    </span>
                  </div>
                  <strong>{formatMoney(item.amount)}</strong>
                </article>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              Nenhum compromisso vence neste mês.
            </div>
          )}
        </section>

        <aside className={styles.planning}>
          <CalendarDays size={20} aria-hidden="true" />
          <strong>Planeje-se com antecedência</strong>
          <p>
            Marcar uma parcela como paga avança o próximo vencimento
            automaticamente.
          </p>
          <span>Saldo disponível hoje: {formatMoney(available)}</span>
        </aside>
      </div>

      <section
        className={styles.installments}
        aria-labelledby="installments-title"
      >
        <header className={styles.sectionHeader}>
          <div>
            <span className={styles.eyebrow}>
              <CalendarDays size={15} /> Parcelas ativas
            </span>
            <h2 id="installments-title">Acompanhe cada compromisso</h2>
          </div>
          <span>{activeInstallments.length} ativos</span>
        </header>

        <div className={styles.installmentList}>
          {activeInstallments.length ? (
            activeInstallments.map((item) => {
              const left = item.totalInstallments - item.paidInstallments;
              const progress = item.totalInstallments
                ? (item.paidInstallments / item.totalInstallments) * 100
                : 0;

              return (
                <article className={styles.installment} key={item.id}>
                  <div className={styles.icon}>{renderIcon(item.category)}</div>
                  <div className={styles.installmentMain}>
                    <div className={styles.installmentTitle}>
                      <div>
                        <strong>{item.title}</strong>
                        <span>
                          {item.category} · {item.who}
                        </span>
                      </div>
                      <strong>{formatMoney(item.amount)}/mês</strong>
                    </div>
                    <div
                      className={styles.progress}
                      aria-label={`${Math.round(progress)}% pago`}
                    >
                      <span style={{ width: `${progress}%` }} />
                    </div>
                    <div className={styles.meta}>
                      <span>{item.paidInstallments} pagas</span>
                      <span>{left} restantes</span>
                      <span>Próximo: {formatDate(item.nextDue)}</span>
                    </div>
                    <div className={styles.actions}>
                      <button type="button" onClick={() => onPay(item.id, 1)}>
                        <CircleDollarSign size={14} /> Pagar 1
                      </button>
                      <button
                        type="button"
                        disabled={left < 2}
                        onClick={() => onAdvance(item)}
                      >
                        <FastForward size={14} /> Adiantar
                      </button>
                      <button type="button" onClick={() => onQuit(item)}>
                        <CheckCircle2 size={14} /> Quitar
                      </button>
                      <button
                        type="button"
                        aria-label={`Editar ${item.title}`}
                        onClick={() => onEdit(item)}
                      >
                        <Pencil size={14} /> Editar
                      </button>
                      <button
                        type="button"
                        className={styles.delete}
                        aria-label={`Excluir ${item.title}`}
                        onClick={() => onDelete(item.id)}
                      >
                        <Trash2 size={14} /> Excluir
                      </button>
                    </div>
                  </div>
                  <ChevronRight
                    className={styles.chevron}
                    size={18}
                    aria-hidden="true"
                  />
                </article>
              );
            })
          ) : (
            <div className="empty-state">Nenhuma parcela ativa.</div>
          )}
        </div>
      </section>
    </section>
  );
}
