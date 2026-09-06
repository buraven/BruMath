import type { ReactNode } from "react";
import { ExpenseList } from "../../../../components/finance/ExpenseList";

type HomeExpense = {
  id: number;
  title: string;
  cat: string;
  who: "Bruna" | "Matheus" | "Casal";
  amount: number;
  date: string;
};
type HomeExpensesProps = {
  monthLabel: string;
  expenses: HomeExpense[];
  onEdit: (expense: HomeExpense) => void;
  onDelete: (id: number) => void;
  formatMoney: (value: number) => string;
  formatDate: (value: string) => string;
  renderIcon: (category: string) => ReactNode;
};

export function HomeExpenses({
  monthLabel,
  expenses,
  onEdit,
  onDelete,
  formatMoney,
  formatDate,
  renderIcon,
}: HomeExpensesProps) {
  return (
    <section className="section">
      <div className="section-title">
        <h2>Gastos de {monthLabel}</h2>
        <span className="muted">{expenses.length} registros</span>
      </div>
      <ExpenseList
        expenses={expenses}
        onEdit={onEdit}
        onDelete={onDelete}
        formatMoney={formatMoney}
        formatDate={formatDate}
        renderIcon={renderIcon}
      />
    </section>
  );
}
