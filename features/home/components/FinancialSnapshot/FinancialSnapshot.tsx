import type { CSSProperties } from "react";
import type { CategorySpending } from "../../../app/financialSelectors";
import styles from "./FinancialSnapshot.module.css";

type FinancialSnapshotProps = {
  balance: number;
  income: number;
  expenses: number;
  categories: readonly CategorySpending[];
  formatMoney: (value: number) => string;
};

export function FinancialSnapshot({
  balance,
  income,
  expenses,
  categories,
  formatMoney,
}: FinancialSnapshotProps) {
  const spentPercentage =
    income > 0 ? Math.min(100, Math.max(0, (expenses / income) * 100)) : 0;
  let accumulatedPercentage = 0;
  const stops = categories.map((category, index) => {
    const start = accumulatedPercentage;
    accumulatedPercentage += category.percentage;
    return `var(--category-${(index % 6) + 1}) ${start}% ${accumulatedPercentage}%`;
  });
  const donutStyle = {
    "--spent": `${spentPercentage}%`,
    "--categories": stops.length
      ? stops.join(", ")
      : "var(--surface-soft) 0 100%",
  } as CSSProperties;

  return (
    <section className={styles.card} aria-label="Visão geral do mês">
      <header>
        <h2>Visão geral do mês</h2>
        <span>
          {categories.length ? `${categories.length} categorias` : "Sem gastos"}
        </span>
      </header>
      <div className={styles.body}>
        <div className={styles.donut} style={donutStyle}>
          <div>
            <small>{categories.length ? "Gastos" : "Sem gastos"}</small>
            <strong>{formatMoney(expenses)}</strong>
            <span>{Math.round(spentPercentage)}%</span>
          </div>
        </div>
        <div className={styles.legend}>
          {categories.length ? (
            categories.map((category, index) => (
              <div key={category.category}>
                <i className={styles[`category${(index % 6) + 1}`]} />
                <span>{category.category}</span>
                <strong>
                  {formatMoney(category.amount)} ·{" "}
                  {Math.round(category.percentage)}%
                </strong>
              </div>
            ))
          ) : (
            <div className={styles.emptyLegend}>
              <span>
                Registre gastos para acompanhar a distribuição por categoria.
              </span>
            </div>
          )}
        </div>
      </div>
      <footer>
        {categories.length
          ? `${formatMoney(expenses)} de gastos · ${Math.round(spentPercentage)}% da renda do mês.`
          : `${formatMoney(balance)} disponíveis no mês selecionado.`}
      </footer>
    </section>
  );
}
