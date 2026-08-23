import styles from "./LimitCard.module.css";

type LimitCardProps = {
  label: string;
  spent: number;
  limit: number;
  formatMoney: (value: number) => string;
};

export function LimitCard({ label, spent, limit, formatMoney }: LimitCardProps) {
  const percentage = limit > 0 ? (spent / limit) * 100 : 0;
  const progress = Math.min(100, Math.max(0, percentage));
  const remaining = Math.max(0, limit - spent);
  const exceeded = spent > limit;

  return (
    <article className={`${styles.card} ${exceeded ? styles.exceeded : ""}`}>
      <div className={styles.header}>
        <div>
          <span className={styles.label}>{label}</span>
          <strong>{formatMoney(spent)}</strong>
        </div>
        <span className={styles.limit}>de {formatMoney(limit)}</span>
      </div>
      <div className={styles.track} aria-hidden="true">
        <span style={{ width: `${progress}%` }} />
      </div>
      <div className={styles.footer}>
        <span>{exceeded ? "Limite excedido" : `${formatMoney(remaining)} restantes`}</span>
        <span>{Math.round(percentage)}%</span>
      </div>
    </article>
  );
}
