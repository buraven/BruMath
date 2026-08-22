import { LimitCard } from "./LimitCard";

type LimitValue = { spent: number; limit: number };

type PersonalLimitsProps = {
  limits: Record<string, LimitValue>;
  formatMoney: (value: number) => string;
  onEdit?: (name: string) => void;
};

export const DEFAULT_PERSONAL_LIMIT_NAMES = [
  "Delivery",
  "Gasolina",
  "Comprinhas",
  "Restaurantes",
  "Gastos Bru",
  "Gastos Mat",
] as const;

export function PersonalLimits({ limits, formatMoney, onEdit }: PersonalLimitsProps) {
  return (
    <section aria-label="Limites pessoais">
      <div className="section-heading">
        <div>
          <span className="eyebrow">Controle de gastos</span>
          <h2>Limites</h2>
        </div>
        <span className="section-hint">Bru e Mat</span>
      </div>
      <div className="limits-grid">
        {DEFAULT_PERSONAL_LIMIT_NAMES.map((name) => {
          const value = limits[name] ?? { spent: 0, limit: 0 };
          return (
            <LimitCard
              key={name}
              title={name}
              spent={value.spent}
              limit={value.limit}
              formatMoney={formatMoney}
              onEdit={onEdit ? () => onEdit(name) : undefined}
            />
          );
        })}
      </div>
    </section>
  );
}
