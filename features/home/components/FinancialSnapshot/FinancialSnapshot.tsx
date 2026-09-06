import type { CSSProperties } from "react";
import styles from "./FinancialSnapshot.module.css";

type FinancialSnapshotProps = {
  balance: number;
  income: number;
  expenses: number;
  formatMoney: (value: number) => string;
};

export function FinancialSnapshot({
  balance,
  income,
  expenses,
  formatMoney,
}: FinancialSnapshotProps) {
  const spentPercentage =
    income > 0 ? Math.min(100, Math.max(0, (expenses / income) * 100)) : 0;
  const balanceLabel = balance >= 0 ? "Saldo disponível" : "Saldo negativo";

  return (
    <section className={styles.card} aria-label="Visão geral do mês">
      <header>
        <h2>Visão geral do mês</h2>
        <span>{Math.round(spentPercentage)}% usado</span>
      </header>
      <div className={styles.body}>
        <div
          className={styles.donut}
          style={{ "--spent": `${spentPercentage}%` } as CSSProperties}
        >
          <div>
            <small>Gastos</small>
            <strong>{formatMoney(expenses)}</strong>
            <span>{Math.round(spentPercentage)}%</span>
          </div>
        </div>
        <div className={styles.legend}>
          <div>
            <i className={styles.spent} />
            <span>Gasto até agora</span>
            <strong>{formatMoney(expenses)}</strong>
          </div>
          <div>
            <i className={styles.available} />
            <span>{balanceLabel}</span>
            <strong>{formatMoney(balance)}</strong>
          </div>
          <div>
            <i className={styles.income} />
            <span>Orçamento mensal</span>
            <strong>{formatMoney(income)}</strong>
          </div>
        </div>
      </div>
      <footer>Os valores acompanham o mês selecionado.</footer>
    </section>
  );
}
