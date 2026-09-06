import type { ReactNode } from "react";
import { FinancialSnapshot } from "./components/FinancialSnapshot/FinancialSnapshot";
import { DashboardMetrics } from "./components/DashboardMetrics/DashboardMetrics";
import { Home } from "./Home";

type NewHomeProps = {
  profile: string;
  monthLabel: string;
  balance: number;
  income: number;
  extraIncome: number;
  expenses: number;
  formatMoney: (value: number) => string;
  insights?: ReactNode;
  limits?: ReactNode;
  upcoming?: ReactNode;
};

export function NewHome({
  profile: _profile,
  monthLabel: _monthLabel,
  balance,
  income,
  extraIncome,
  expenses,
  formatMoney,
  insights,
  limits,
  upcoming,
}: NewHomeProps) {
  return (
    <Home
      metrics={<DashboardMetrics budget={income} expenses={expenses} extraIncome={extraIncome} balance={balance} formatMoney={formatMoney} />}
      overview={<FinancialSnapshot balance={balance} income={income} expenses={expenses} formatMoney={formatMoney} />}
      insights={insights}
      limits={limits}
      content={upcoming}
    />
  );
}
