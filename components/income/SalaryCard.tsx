type SalaryCardProps = {
  amount: number;
  formatMoney: (value: number) => string;
  onEdit?: () => void;
};

export function SalaryCard({ amount, formatMoney, onEdit }: SalaryCardProps) {
  return (
    <section className="card income-summary-card" aria-label="Salário">
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
      <strong className="summary-value">{formatMoney(amount)}</strong>
      <p>Recebimento previsto para o dia 27.</p>
    </section>
  );
}
