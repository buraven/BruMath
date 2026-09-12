import type { ReactNode } from "react";
import styles from "./HomeLimits.module.css";

type Item = { id: string; label: string; amount: number; spent: number };
const money = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function HomeLimits({
  items,
  onConfigure,
  renderIcon,
}: {
  items: Item[];
  onConfigure: () => void;
  renderIcon: (category: string) => ReactNode;
}) {
  const personal = items.filter(
    (item) => item.id === "Bruna" || item.id === "Matheus",
  );
  const categories = items
    .filter((item) => item.id.startsWith("category:"))
    .map((item, order) => ({ ...item, order }));
  categories.sort(
    (a, b) =>
      (b.amount > 0 ? b.spent / b.amount : 0) -
        (a.amount > 0 ? a.spent / a.amount : 0) || a.order - b.order,
  );
  return (
    <section className={styles.card} aria-label="Resumo dos limites">
      <header>
        <h2>Limites do mês</h2>
        <button type="button" onClick={onConfigure}>
          Configurar limites
        </button>
      </header>
      {[...personal, ...categories.slice(0, 3)].map((item) => {
        const percentage =
          item.amount > 0 ? (item.spent / item.amount) * 100 : 0;
        return (
          <div className={styles.row} key={item.id}>
            <div className={styles.title}>
              <span className={styles.identity}>
                {item.id.startsWith("category:") ? (
                  <i aria-hidden="true">{renderIcon(item.label)}</i>
                ) : null}
                <strong>{item.label}</strong>
              </span>
              <span>
                {item.amount > 0 ? `${Math.round(percentage)}%` : "Sem limite"}
              </span>
            </div>
            <small>
              {money(item.spent)} gastos
              {item.amount > 0 ? ` / ${money(item.amount)}` : ""}
            </small>
            {item.amount > 0 && (
              <progress
                aria-label={`Consumo de ${item.label}`}
                max={100}
                value={Math.min(100, Math.max(0, percentage))}
                className={
                  percentage > 100
                    ? styles.danger
                    : percentage >= 80
                      ? styles.warning
                      : ""
                }
              />
            )}
          </div>
        );
      })}
      <button type="button" className={styles.all} onClick={onConfigure}>
        Ver todos os limites e categorias
      </button>
    </section>
  );
}
