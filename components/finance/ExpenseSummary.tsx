import { MetricGrid } from "./MetricGrid";

type ExpenseSummaryProps = {
  receivableCount: number;
  extraIncome: string;
  extraIncomeCount: number;
  totalSpent: string;
  expenseCount: number;
  installmentCount: number;
  remainingInstallments: number;
  onReceivablesClick: () => void;
  onExtraIncomeClick: () => void;
  onExpensesClick: () => void;
  onInstallmentsClick: () => void;
};

export function ExpenseSummary({
  receivableCount,
  extraIncome,
  extraIncomeCount,
  totalSpent,
  expenseCount,
  installmentCount,
  remainingInstallments,
  onReceivablesClick,
  onExtraIncomeClick,
  onExpensesClick,
  onInstallmentsClick,
}: ExpenseSummaryProps) {
  return (
    <section className="summary-grid">
      <MetricGrid
        metrics={[
          {
            label: "A receber",
            value: String(receivableCount),
            detail: "em aberto",
            onClick: onReceivablesClick,
          },
          {
            label: "Entradas extras",
            value: extraIncome,
            detail: `${extraIncomeCount} registros`,
            onClick: onExtraIncomeClick,
          },
          {
            label: "Gastos",
            value: totalSpent,
            detail: `${expenseCount} registros`,
            onClick: onExpensesClick,
          },
          {
            label: "Parcelas",
            value: String(installmentCount),
            detail: `${remainingInstallments} parcelas restantes`,
            onClick: onInstallmentsClick,
          },
        ]}
      />
    </section>
  );
}
