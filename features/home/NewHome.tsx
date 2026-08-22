import { BalanceCard } from "./components/BalanceCard/BalanceCard";
import { HomeHeader } from "./components/HomeHeader/HomeHeader";
import { Home } from "./Home";

type NewHomeProps = {
  profile: string;
  monthLabel: string;
  balance: number;
  income: number;
  expenses: number;
  formatMoney: (value: number) => string;
};

export function NewHome({ profile, monthLabel, balance, income, expenses, formatMoney }: NewHomeProps) {
  return (
    <Home
      header={<HomeHeader profile={profile} monthLabel={monthLabel} />}
      balance={
        <BalanceCard
          balance={balance}
          income={income}
          expenses={expenses}
          formatMoney={formatMoney}
        />
      }
    />
  );
}
