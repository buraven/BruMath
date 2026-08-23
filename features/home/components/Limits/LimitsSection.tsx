import { calculateLimitUsages, type CategoryLimit } from "../../../../lib/finance/limits";
import { LimitCard } from "./LimitCard";
import styles from "./LimitsSection.module.css";

type LimitsSectionProps = {
  limits: CategoryLimit[];
  spentByLimit: Record<string, number>;
  formatMoney: (value: number) => string;
};

export function LimitsSection({ limits, spentByLimit, formatMoney }: LimitsSectionProps) {
  const usages = calculateLimitUsages(limits, spentByLimit);

  if (!usages.length) return null;

  return (
    <section className={styles.section} aria-labelledby="home-limits-title">
      <div className={styles.heading}>
        <div>
          <span>Controle</span>
          <h2 id="home-limits-title">Meus limites</h2>
        </div>
      </div>
      <div className={styles.grid}>
        {usages.map((limit) => (
          <LimitCard
            key={limit.id}
            label={limit.label}
            spent={limit.spent}
            limit={limit.amount}
            formatMoney={formatMoney}
          />
        ))}
      </div>
    </section>
  );
}
