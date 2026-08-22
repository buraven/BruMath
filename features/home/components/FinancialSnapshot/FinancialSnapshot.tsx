import styles from "./FinancialSnapshot.module.css";

type FinancialSnapshotProps = {
  balance: number;
  income: number;
  expenses: number;
  formatMoney: (value: number) => string;
};

export function FinancialSnapshot({ balance, income, expenses, formatMoney }: FinancialSnapshotProps) {
  const balanceLabel = balance >= 0 ? "Saldo disponível" : "Saldo negativo";

  return (
    <section className={styles.card} aria-label="Visão financeira">
      <div className={styles.header}>
        <div>
          <span className={styles.eyebrow}>Resumo</span>
          <h2>{balanceLabel}</h2>
        </div>
        <strong>{formatMoney(balance)}</strong>
      </div>
      <div className={styles.progress} aria-hidden="true">
        <span style={{ width: `${Math.min(100, income > 0 ? Math.max(0, (expenses / income) * 100) : 0)}%` }} />
      </div>
      <p>
        {formatMoney(expenses)} gastos de {formatMoney(income)} em entradas neste mês.
      </p>
    </section>
  );
}
