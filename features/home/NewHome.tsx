import type { ReactNode } from "react";
import { BalanceCard } from "./components/BalanceCard/BalanceCard";
import { FinancialSnapshot } from "./components/FinancialSnapshot/FinancialSnapshot";
import { HomeHeader } from "./components/HomeHeader/HomeHeader";
import { SummaryCards } from "./components/Summary/SummaryCards";
import { Home } from "./Home";

type NewHomeProps = {
  profile: string;
  monthLabel: string;
  balance: number;
  income: number;
  expenses: number;
  formatMoney: (value: number) => string;
  insights?: ReactNode;
  limits?: ReactNode;
  upcoming?: ReactNode;
};

export function NewHome({
  profile,
  monthLabel,
  balance,
  income,
  expenses,
  formatMoney,
  insights,
  limits,
  upcoming,
}: NewHomeProps) {
  return (
    <Home
      header={<HomeHeader profile={profile} monthLabel={monthLabel} />}
      balance={<BalanceCard balance={balance} income={income} expenses={expenses} formatMoney={formatMoney} />}
      summary={<SummaryCards income={income} expenses={expenses} formatMoney={formatMoney} />}
      insights={insights}
      limits={limits}
      upcoming={upcoming ?? <FinancialSnapshot balance={balance} income={income} expenses={expenses} formatMoney={formatMoney} />}
    />
  );
}
