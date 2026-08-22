import styles from "./BalanceCard.module.css";

type BalanceCardProps = {
  balance: number;
  income: number;
  expenses: number;
  formatMoney: (value: number) => string;
};

export function BalanceCard({ balance, income, expenses, formatMoney }: BalanceCardProps) {
  return (
    <section className={styles.card} aria-label="Saldo do mês">
      <div className={styles.header}>
        <div>
          <span className={styles.eyebrow}>Visão do mês</span>
          <h2 className={styles.title}>Saldo</h2>
        </div>
      </div>

      <strong className={styles.value}>{formatMoney(balance)}</strong>

      <div className={styles.breakdown}>
        <span>
          <small>Entradas</small>
          {formatMoney(income)}
        </span>
        <span>
          <small>Gastos</small>
          {formatMoney(expenses)}
        </span>
      </div>
    </section>
  );
}
