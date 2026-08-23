import styles from "./SummaryCards.module.css";

type SummaryCardsProps = {
  income: number;
  expenses: number;
  formatMoney: (value: number) => string;
};

export function SummaryCards({ income, expenses, formatMoney }: SummaryCardsProps) {
  const items = [
    { label: "Entradas", value: income, tone: "positive" },
    { label: "Gastos", value: expenses, tone: "negative" },
  ] as const;

  return (
    <section className={styles.grid} aria-label="Resumo financeiro">
      {items.map((item) => (
        <article className={`${styles.card} ${styles[item.tone]}`} key={item.label}>
          <span>{item.label}</span>
          <strong>{formatMoney(item.value)}</strong>
        </article>
      ))}
    </section>
  );
}
