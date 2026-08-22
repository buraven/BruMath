type BalanceCardProps = {
  balance: number;
  income: number;
  expenses: number;
  formatMoney: (value: number) => string;
};

export function BalanceCard({ balance, income, expenses, formatMoney }: BalanceCardProps) {
  return (
    <section className="card balance-card" aria-label="Saldo do mês">
      <div className="card-header">
        <div>
          <span className="eyebrow">Visão do mês</span>
          <h2>Saldo</h2>
        </div>
      </div>
      <strong className="balance-value">{formatMoney(balance)}</strong>
      <div className="balance-breakdown">
        <span>Entradas {formatMoney(income)}</span>
        <span>Gastos {formatMoney(expenses)}</span>
      </div>
    </section>
  );
}
