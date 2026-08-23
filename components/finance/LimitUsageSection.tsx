"use client";

import { useEffect, useMemo, useState } from "react";
import type { CategoryLimit, LimitUsage } from "../../lib/finance/limits";
import { getLimitUsagesForMonth } from "../../lib/finance/limitsService";
import { LocalStorageTransactionRepository } from "../../lib/finance/LocalStorageTransactionRepository";
import styles from "./LimitUsageSection.module.css";

type LimitUsageSectionProps = {
  month: string;
  limits: CategoryLimit[];
};

const money = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function LimitUsageSection({ month, limits }: LimitUsageSectionProps) {
  const [usages, setUsages] = useState<LimitUsage[]>([]);
  const [loading, setLoading] = useState(true);
  const repository = useMemo(() => new LocalStorageTransactionRepository(), []);
  const configuredLimits = useMemo(() => limits.filter((limit) => limit.amount > 0), [limits]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    getLimitUsagesForMonth(repository, configuredLimits, month)
      .then((nextUsages) => {
        if (!cancelled) setUsages(nextUsages);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [configuredLimits, month, repository]);

  return (
    <section className={styles.section} aria-labelledby="limit-usage-title">
      <div className={styles.header}>
        <div>
          <span className={styles.eyebrow}>Limites</span>
          <h2 id="limit-usage-title">Quanto ainda posso gastar?</h2>
        </div>
        <span className={styles.month}>{month}</span>
      </div>

      {loading ? (
        <div className={styles.state}>Calculando gastos reais...</div>
      ) : usages.length === 0 ? (
        <div className={styles.state}>Nenhum limite configurado.</div>
      ) : (
        <div className={styles.grid}>
          {usages.map((usage) => {
            const percentage = Math.min(100, Math.max(0, usage.percentage));

            return (
              <article className={styles.card} key={usage.id}>
                <div className={styles.cardHeader}>
                  <div>
                    <strong>{usage.label}</strong>
                    <span>{usage.owner}</span>
                  </div>
                  <strong>{money(usage.remaining)}</strong>
                </div>

                <div className={styles.track} aria-hidden="true">
                  <div
                    className={`${styles.fill} ${usage.exceeded ? styles.exceeded : ""}`}
                    style={{ width: `${percentage}%` }}
                  />
                </div>

                <div className={styles.meta}>
                  <span>{money(usage.spent)} usados</span>
                  <span>{Math.round(usage.percentage)}%</span>
                  <span>de {money(usage.amount)}</span>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
