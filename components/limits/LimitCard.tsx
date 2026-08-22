type LimitCardProps = {
  title: string;
  spent: number;
  limit: number;
  formatMoney: (value: number) => string;
  onEdit?: () => void;
};

export function LimitCard({ title, spent, limit, formatMoney, onEdit }: LimitCardProps) {
  const percentage = limit > 0 ? Math.min((spent / limit) * 100, 100) : 0;
  const remaining = Math.max(limit - spent, 0);

  return (
    <article className="card limit-card">
      <div className="card-header">
        <div>
          <span className="eyebrow">Limite</span>
          <h3>{title}</h3>
        </div>
        {onEdit ? (
          <button type="button" className="icon-button" onClick={onEdit} aria-label={`Editar limite de ${title}`}>
            ✎
          </button>
        ) : null}
      </div>
      <div className="limit-values">
        <strong>{formatMoney(spent)}</strong>
        <span>de {formatMoney(limit)}</span>
      </div>
      <div className="progress-track" role="progressbar" aria-valuemin={0} aria-valuemax={limit} aria-valuenow={Math.min(spent, limit)}>
        <div className="progress-fill" style={{ width: `${percentage}%` }} />
      </div>
      <small>{formatMoney(remaining)} restantes</small>
    </article>
  );
}
