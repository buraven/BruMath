import { Pencil, Trash2 } from "lucide-react";
import type { ReactNode } from "react";
import styles from "./ExpenseList.module.css";

type Expense = {
  id: number;
  title: string;
  cat: string;
  who: "Bruna" | "Matheus" | "Casal";
  amount: number;
  date: string;
};

type ExpenseListProps = {
  expenses: Expense[];
  onEdit: (expense: Expense) => void;
  onDelete: (id: number) => void;
  formatMoney?: (value: number) => string;
  formatDate?: (value: string) => string;
  renderIcon?: (category: string) => ReactNode;
};

export function ExpenseList({ expenses, onEdit, onDelete, formatMoney, formatDate, renderIcon }: ExpenseListProps) {
  const money = formatMoney ?? ((value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }));
  const date = formatDate ?? ((value: string) => value ? new Date(`${value}T12:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) : "—");

  return (
    <div className={styles.list}>
      {expenses.length ? expenses.map((expense) => (
        <div className={styles.row} key={expense.id}>
          <div className={styles.icon}>{renderIcon?.(expense.cat)}</div>
          <div className={styles.info}>
            <strong>{expense.title}</strong>
            <span>{expense.cat} · {expense.who} · {date(expense.date)}</span>
          </div>
          <strong className={styles.amount}>{money(expense.amount)}</strong>
          <div className={styles.actions}>
            <button type="button" className="icon-button" onClick={() => onEdit(expense)} aria-label="Editar gasto"><Pencil size={15} /></button>
            <button type="button" className="icon-button danger-icon" onClick={() => onDelete(expense.id)} aria-label="Excluir gasto"><Trash2 size={15} /></button>
          </div>
        </div>
      )) : <div className="empty-state">Nenhum gasto registrado neste mês.</div>}
    </div>
  );
}
