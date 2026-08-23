import type { ReactNode } from "react";
import { MetricCard } from "./MetricCard";
import styles from "./MetricGrid.module.css";

type Metric = {
  label: string;
  value: string;
  detail: string;
  icon?: ReactNode;
  onClick?: () => void;
};

type MetricGridProps = {
  metrics: Metric[];
};

export function MetricGrid({ metrics }: MetricGridProps) {
  return (
    <div className={styles.grid}>
      {metrics.map((metric) => (
        <MetricCard key={`${metric.label}-${metric.value}`} {...metric} />
      ))}
    </div>
  );
}
