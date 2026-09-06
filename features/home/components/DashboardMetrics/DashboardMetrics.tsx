import { ArrowDownRight, ArrowUpRight, WalletCards } from "lucide-react";
import styles from "./DashboardMetrics.module.css";

type DashboardMetricsProps = {
  budget: number;
  expenses: number;
  extraIncome: number;
  balance: number;
  formatMoney: (value: number) => string;
};

export function DashboardMetrics({ budget, expenses, extraIncome, balance, formatMoney }: DashboardMetricsProps) {
  const spentPercentage = budget > 0 ? Math.min(100, Math.round((expenses / budget) * 100)) : 0;
  const metrics = [
    { label: "Orçamento mensal", value: budget, detail: "Renda total", icon: <WalletCards size={18} />, tone: "green" },
    { label: "Gasto até agora", value: expenses, detail: `${spentPercentage}% do orçamento`, icon: <ArrowDownRight size={18} />, tone: "orange", progress: spentPercentage },
    { label: "O que entra", value: extraIncome, detail: "Entradas no mês", icon: <ArrowUpRight size={18} />, tone: "green" },
    { label: "Saldo disponível", value: balance, detail: "Previsto para o mês", icon: <WalletCards size={18} />, tone: "blue" },
  ] as const;

  return <section className={styles.grid} aria-label="Resumo financeiro do mês">{metrics.map((metric) => (
    <article className={styles.card} key={metric.label}>
      <div className={styles.heading}><span>{metric.label}</span><i className={styles[metric.tone]} aria-hidden="true">{metric.icon}</i></div>
      <strong>{formatMoney(metric.value)}</strong><small>{metric.detail}</small>
      {"progress" in metric ? <div className={styles.track}><span style={{ width: `${metric.progress}%` }} /></div> : null}
    </article>
  ))}</section>;
}
