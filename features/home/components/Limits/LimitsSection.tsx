import { LimitCard } from "./LimitCard";
import styles from "./LimitsSection.module.css";

type Limit = {
  id: string;
  label: string;
  spent: number;
  limit: number;
};

type LimitsSectionProps = {
  limits: Limit[];
  formatMoney: (value: number) => string;
};

export function LimitsSection({ limits, formatMoney }: LimitsSectionProps) {
  if (!limits.length) return null;

  return (
    <section className={styles.section} aria-labelledby="home-limits-title">
      <div className={styles.heading}>
        <div>
          <span>Controle</span>
          <h2 id="home-limits-title">Meus limites</h2>
        </div>
      </div>
      <div className={styles.grid}>
        {limits.map((limit) => (
          <LimitCard key={limit.id} {...limit} formatMoney={formatMoney} />
        ))}
      </div>
    </section>
  );
}
