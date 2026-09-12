import { ArrowDownLeft, CalendarClock, HandCoins } from "lucide-react";
import type { Debt, Installment } from "../../../../lib/app/AppTypes";
import styles from "./HomeFinancialHighlights.module.css";

type Props = {
  baseIncome: number;
  extraIncome: number;
  debts: readonly Debt[];
  installments: readonly Installment[];
  formatMoney: (value: number) => string;
  formatDate: (value: string) => string;
  onOpenIncome: () => void;
  onOpenDebts: () => void;
  onOpenFuture: () => void;
};

export function HomeFinancialHighlights({
  baseIncome,
  extraIncome,
  debts,
  installments,
  formatMoney,
  formatDate,
  onOpenIncome,
  onOpenDebts,
  onOpenFuture,
}: Props) {
  const openDebts = debts.filter((debt) => debt.amount > debt.paid);
  const receivableTotal = openDebts.reduce(
    (total, debt) => total + Math.max(0, debt.amount - debt.paid),
    0,
  );
  const upcoming = installments
    .filter(
      (installment) =>
        installment.paidInstallments < installment.totalInstallments,
    )
    .slice(0, 3);

  return (
    <section className={styles.grid} aria-label="Resumos financeiros">
      <article className={styles.card}>
        <header>
          <span className={styles.icon}>
            <ArrowDownLeft size={18} aria-hidden="true" />
          </span>
          <div>
            <h2>O que entra</h2>
            <p>Valores registrados neste mês</p>
          </div>
        </header>
        <strong>{formatMoney(baseIncome + extraIncome)}</strong>
        <dl>
          <div>
            <dt>Renda-base</dt>
            <dd>{formatMoney(baseIncome)}</dd>
          </div>
          <div>
            <dt>Entradas extras</dt>
            <dd>{formatMoney(extraIncome)}</dd>
          </div>
        </dl>
        <button type="button" onClick={onOpenIncome}>
          Ver entradas
        </button>
      </article>

      <article className={styles.card}>
        <header>
          <span className={`${styles.icon} ${styles.receivable}`}>
            <HandCoins size={18} aria-hidden="true" />
          </span>
          <div>
            <h2>Quem me deve</h2>
            <p>
              {openDebts.length
                ? `${openDebts.length} registro${openDebts.length === 1 ? "" : "s"} em aberto`
                : "Nenhum valor pendente"}
            </p>
          </div>
        </header>
        <strong>{formatMoney(receivableTotal)}</strong>
        <p className={styles.detail}>
          {openDebts.length
            ? openDebts
                .slice(0, 2)
                .map((debt) => debt.person)
                .join(" · ")
            : "Registre valores a receber para acompanhá-los aqui."}
        </p>
        <button type="button" onClick={onOpenDebts}>
          Ver valores a receber
        </button>
      </article>

      <article className={styles.card}>
        <header>
          <span className={`${styles.icon} ${styles.upcoming}`}>
            <CalendarClock size={18} aria-hidden="true" />
          </span>
          <div>
            <h2>Próximos pagamentos</h2>
            <p>Parcelas e compromissos registrados</p>
          </div>
        </header>
        {upcoming.length ? (
          <ul className={styles.upcomingList}>
            {upcoming.map((installment) => (
              <li key={installment.id}>
                <span>
                  <strong>{installment.title}</strong>
                  <small>{formatDate(installment.nextDue)}</small>
                </span>
                <b>{formatMoney(installment.amount)}</b>
              </li>
            ))}
          </ul>
        ) : (
          <p className={styles.detail}>
            Nenhuma parcela ativa para acompanhar.
          </p>
        )}
        <button type="button" onClick={onOpenFuture}>
          Ver compromissos
        </button>
      </article>
    </section>
  );
}
