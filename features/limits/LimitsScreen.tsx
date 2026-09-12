"use client";

import { useState } from "react";
import { Settings, Tag } from "lucide-react";
import type { ReactNode } from "react";
import { MoneyInput } from "../../components/ui/MoneyInput";
import styles from "./LimitsScreen.module.css";
import { LimitsDialog } from "./LimitsDialog";

type Item = { id: string; label: string; amount: number; spent: number };
type Props = {
  monthLabel: string;
  items: Item[];
  compact?: boolean;
  onConfigure: () => void;
  onSave?: (values: Record<string, number>) => void;
  renderIcon?: (category: string) => ReactNode;
};
const money = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function LimitsScreen({
  monthLabel,
  items,
  compact = false,
  onConfigure,
  onSave,
  renderIcon,
}: Props) {
  const [draft, setDraft] = useState<Record<string, string> | null>(null);
  const alerts = items.filter(
    (item) => item.amount > 0 && item.spent >= item.amount * 0.8,
  );
  const visible = compact
    ? items.filter((item) => item.amount > 0).slice(0, 6)
    : items;
  return (
    <section
      className={`${styles.screen} ${compact ? styles.compact : styles.full}`}
      aria-label="Limites e categorias"
    >
      <header className={styles.header}>
        <div>
          {compact ? <h2>Limites do mês</h2> : <h1>Limites e categorias</h1>}
          <p>{monthLabel} · Gastos reais do mês</p>
        </div>
        <button
          type="button"
          className={styles.secondary}
          onClick={() => {
            if (compact) onConfigure();
            else
              setDraft(
                Object.fromEntries(
                  items.map((item) => [item.id, String(item.amount)]),
                ),
              );
          }}
        >
          <Settings size={16} /> Configurar limites
        </button>
      </header>
      {!compact && (
        <p className={styles.notice}>
          {alerts.length
            ? `${alerts.length} limites chegaram a 80% ou mais. Confira os valores abaixo.`
            : "Os limites configurados estão abaixo de 80% de uso."}{" "}
          Limites pessoais e por categoria se sobrepõem e não devem ser somados.
        </p>
      )}
      {draft && (
        <LimitsDialog onClose={() => setDraft(null)}>
          <form
            className={styles.editor}
            onSubmit={(event) => {
              event.preventDefault();
              const values = Object.fromEntries(
                Object.entries(draft).map(([id, value]) => [id, Number(value)]),
              );
              if (
                Object.values(values).some(
                  (value) => !Number.isFinite(value) || value < 0,
                )
              )
                return;
              onSave?.(values);
              setDraft(null);
            }}
          >
            <p>
              Os limites valem para todos os meses. Use zero para deixar sem
              limite.
            </p>
            <div className={styles.fields}>
              {items.map((item) => (
                <label className="field" key={item.id}>
                  <span>{item.label}</span>
                  <MoneyInput
                    value={draft[item.id]}
                    onValueChange={(value) =>
                      setDraft({ ...draft, [item.id]: value })
                    }
                  />
                </label>
              ))}
            </div>
            <div className={styles.actions}>
              <button type="submit" className={styles.primary}>
                Salvar limites
              </button>
              <button
                type="button"
                className={styles.secondary}
                onClick={() => setDraft(null)}
              >
                Cancelar
              </button>
            </div>
          </form>
        </LimitsDialog>
      )}
      <div className={styles.list}>
        {visible.map((item) => {
          const percentage =
            item.amount > 0 ? (item.spent / item.amount) * 100 : 0;
          const exceeded = item.amount > 0 && item.spent > item.amount;
          const tone = exceeded
            ? styles.danger
            : percentage >= 80
              ? styles.warning
              : styles.normal;
          return (
            <article key={item.id} className={styles.item}>
              <span className={styles.icon} aria-hidden="true">
                {item.id.startsWith("category:") && renderIcon ? (
                  renderIcon(item.label)
                ) : (
                  <Tag size={18} />
                )}
              </span>
              <div className={styles.content}>
                <div className={styles.title}>
                  <strong>{item.label}</strong>
                  <span>
                    {item.amount > 0
                      ? `${Math.round(percentage)}%`
                      : "Sem limite"}
                  </span>
                </div>
                <p>
                  {money(item.spent)} gastos
                  {item.amount > 0 && ` / ${money(item.amount)}`}
                </p>
                {item.amount > 0 && (
                  <>
                    <progress
                      className={tone}
                      value={Math.min(100, Math.max(0, percentage))}
                      max={100}
                      aria-label={`Consumo do limite ${item.label}`}
                    />
                    <small className={tone}>
                      {exceeded
                        ? `${money(item.spent - item.amount)} acima do limite`
                        : `${money(item.amount - item.spent)} disponíveis${percentage >= 80 ? " · Atenção ao limite" : ""}`}
                    </small>
                  </>
                )}
              </div>
            </article>
          );
        })}
      </div>
      {compact && (
        <button
          type="button"
          className={styles.secondary}
          onClick={onConfigure}
        >
          Ver todos os limites e categorias
        </button>
      )}
    </section>
  );
}
