import { LimitCard } from "./LimitCard";

type LimitsGridProps = {
  limits: Record<string, { spent: number; limit: number }>;
  formatMoney: (value: number) => string;
  onEdit?: (name: string) => void;
};

export function LimitsGrid({ limits, formatMoney, onEdit }: LimitsGridProps) {
  return (
    <div className="limits-grid">
      {Object.entries(limits).map(([name, values]) => (
        <LimitCard
          key={name}
          title={name}
          spent={values.spent}
          limit={values.limit}
          formatMoney={formatMoney}
          onEdit={onEdit ? () => onEdit(name) : undefined}
        />
      ))}
    </div>
  );
}
