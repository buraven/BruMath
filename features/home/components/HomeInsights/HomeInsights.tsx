import { AlertTriangle, ChartNoAxesCombined, ReceiptText } from "lucide-react";
import styles from "./HomeInsights.module.css";

export type HomeInsight = {
  id: "limit" | "installments" | "receivable" | "empty";
  title: string;
  detail: string;
  tone: "attention" | "info" | "positive";
};

const icons = {
  limit: AlertTriangle,
  installments: ReceiptText,
  receivable: ChartNoAxesCombined,
  empty: ChartNoAxesCombined,
};

export function HomeInsights({ items }: { items: readonly HomeInsight[] }) {
  return (
    <section className={styles.card} aria-label="Insights para você">
      <header>
        <h2>Insights para você</h2>
      </header>
      <div className={styles.items}>
        {items.map((item) => {
          const Icon = icons[item.id];
          return (
            <article className={styles.item} key={item.id}>
              <span className={`${styles.icon} ${styles[item.tone]}`}>
                <Icon size={17} aria-hidden="true" />
              </span>
              <div>
                <strong>{item.title}</strong>
                <p>{item.detail}</p>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
