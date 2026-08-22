type IncomeSummaryProps = {
  income: number;
  formatMoney: (value: number) => string;
  onEdit?: () => void;
};

export function IncomeSummary({ income, formatMoney, onEdit }: IncomeSummaryProps) {
  return (
    <section className="card income-summary-card" aria-label="Resumo de entradas">
      <div className="card-header">
        <div>
          <span className="eyebrow">Entrada principal</span>
          <h3>Salário</h3>
        </div>
        {onEdit ? (
          <button type="button" className="icon-button" onClick={onEdit} aria-label="Editar salário">
            ✎
          </button>
        ) : null}
      </div>
      <strong className="summary-value">{formatMoney(income)}</strong>
      <p>Recebimento previsto para o dia 27.</p>
    </section>
  );
}
