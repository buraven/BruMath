import { Pencil, Trash2 } from "lucide-react";

type Expense = {
  id: number;
  title: string;
  cat: string;
  who: string;
  amount: number;
  date: string;
};

type ExpenseListProps = {
  expenses: Expense[];
  onEdit: (expense: Expense) => void;
  onDelete: (id: number) => void;
  formatMoney: (value: number) => string;
  formatDate: (value: string) => string;
  renderCategoryIcon: (category: string) => React.ReactNode;
};

export function ExpenseList({ expenses, onEdit, onDelete, formatMoney, formatDate, renderCategoryIcon }: ExpenseListProps) {
  return (
    <div className="expense-list">
      {expenses.length ? expenses.map((expense) => (
        <div className="expense-row" key={expense.id}>
          <div className="expense-icon">{renderCategoryIcon(expense.cat)}</div>
          <div className="expense-info">
            <strong>{expense.title}</strong>
            <span>{expense.cat} · {expense.who} · {formatDate(expense.date)}</span>
          </div>
          <strong className="expense-amount">{formatMoney(expense.amount)}</strong>
          <div className="row-actions">
            <button type="button" className="icon-button" onClick={() => onEdit(expense)} aria-label="Editar gasto">
              <Pencil size={15} />
            </button>
            <button type="button" className="icon-button danger-icon" onClick={() => onDelete(expense.id)} aria-label="Excluir gasto">
              <Trash2 size={15} />
            </button>
          </div>
        </div>
      )) : (
        <div className="empty-state">Nenhum gasto registrado neste mês.</div>
      )}
    </div>
  );
}
