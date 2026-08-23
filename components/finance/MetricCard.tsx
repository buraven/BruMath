import type { ReactNode } from "react";
import styles from "./MetricCard.module.css";

type MetricCardProps = {
  label: string;
  value: string;
  detail: string;
  icon?: ReactNode;
  onClick?: () => void;
};

export function MetricCard({ label, value, detail, icon, onClick }: MetricCardProps) {
  const content = (
    <>
      <div className={styles.header}>
        <span>{label}</span>
        {icon ? <span className={styles.icon}>{icon}</span> : null}
      </div>
      <strong>{value}</strong>
      <small>{detail}</small>
    </>
  );

  if (onClick) {
    return <button type="button" className={styles.card} onClick={onClick}>{content}</button>;
  }

  return <div className={styles.card}>{content}</div>;
}
