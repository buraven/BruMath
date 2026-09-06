"use client";

import { Pencil, Plus, Receipt, Search, Trash2 } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import styles from "./ExpensesScreen.module.css";

type Expense = {
  id: number;
  title: string;
  cat: string;
  who: "Bruna" | "Matheus" | "Casal";
  amount: number;
  date: string;
};

type ExpensesScreenProps = {
  monthLabel: string;
  expenses: Expense[];
  formatMoney: (value: number) => string;
  formatDate: (value: string) => string;
  renderIcon: (category: string) => ReactNode;
  onCreate: () => void;
  onEdit: (expense: Expense) => void;
  onDelete: (id: number) => void;
};

export function ExpensesScreen({
  monthLabel,
  expenses,
  formatMoney,
  formatDate,
  renderIcon,
  onCreate,
  onEdit,
  onDelete,
}: ExpensesScreenProps) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("Todas");
  const categories = useMemo(
    () => Array.from(new Set(expenses.map((expense) => expense.cat))).sort(),
    [expenses],
  );
  const filteredExpenses = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("pt-BR");
    return expenses.filter((expense) => {
      const matchesCategory = category === "Todas" || expense.cat === category;
      const searchable =
        `${expense.title} ${expense.cat} ${expense.who}`.toLocaleLowerCase(
          "pt-BR",
        );
      return matchesCategory && (!query || searchable.includes(query));
    });
  }, [category, expenses, search]);
  const groups = useMemo(() => {
    return filteredExpenses.reduce<Record<string, Expense[]>>(
      (result, expense) => {
        result[expense.cat] ??= [];
        result[expense.cat].push(expense);
        return result;
      },
      {},
    );
  }, [filteredExpenses]);
  const total = filteredExpenses.reduce(
    (sum, expense) => sum + expense.amount,
    0,
  );

  return (
    <section className={styles.screen} aria-labelledby="expenses-title">
      <header className={styles.header}>
        <div>
          <span className={styles.eyebrow}>
            <Receipt size={15} /> Lançamentos
          </span>
          <h1 id="expenses-title">Gastos de {monthLabel}</h1>
          <p>Encontre, revise e organize tudo o que saiu neste mês.</p>
        </div>
        <button
          type="button"
          className="primary-button compact"
          onClick={onCreate}
        >
          <Plus size={17} /> Novo gasto
        </button>
      </header>

      <div className={styles.summary}>
        <div>
          <span>Gasto filtrado</span>
          <strong>{formatMoney(total)}</strong>
          <small>
            {filteredExpenses.length} lançamento
            {filteredExpenses.length === 1 ? "" : "s"}
          </small>
        </div>
        <span className={styles.month}>{monthLabel}</span>
      </div>

      <div className={styles.toolbar}>
        <label className={styles.search}>
          <Search size={17} aria-hidden="true" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar lançamento"
          />
        </label>
        <div className={styles.filters} aria-label="Filtrar por categoria">
          <button
            type="button"
            className={category === "Todas" ? styles.activeFilter : ""}
            onClick={() => setCategory("Todas")}
          >
            Todas
          </button>
          {categories.map((item) => (
            <button
              key={item}
              type="button"
              className={category === item ? styles.activeFilter : ""}
              onClick={() => setCategory(item)}
            >
              {item}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.list}>
        {Object.entries(groups).length ? (
          Object.entries(groups).map(([group, items]) => (
            <section
              className={styles.group}
              key={group}
              aria-label={`Gastos de ${group}`}
            >
              <header>
                <span className={styles.categoryIcon}>{renderIcon(group)}</span>
                <strong>{group}</strong>
                <small>
                  {formatMoney(
                    items.reduce((sum, item) => sum + item.amount, 0),
                  )}
                </small>
              </header>
              {items.map((expense) => (
                <article className={styles.row} key={expense.id}>
                  <div className={styles.rowIcon}>
                    {renderIcon(expense.cat)}
                  </div>
                  <div className={styles.description}>
                    <strong>{expense.title}</strong>
                    <span>
                      {expense.who} · {formatDate(expense.date)}
                    </span>
                  </div>
                  <strong className={styles.amount}>
                    {formatMoney(expense.amount)}
                  </strong>
                  <div className={styles.actions}>
                    <button
                      type="button"
                      className="icon-button"
                      onClick={() => onEdit(expense)}
                      aria-label={`Editar ${expense.title}`}
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      type="button"
                      className="icon-button danger-icon"
                      onClick={() => onDelete(expense.id)}
                      aria-label={`Excluir ${expense.title}`}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </article>
              ))}
            </section>
          ))
        ) : (
          <div className="empty-state">
            Nenhum gasto encontrado para este filtro.
          </div>
        )}
      </div>
    </section>
  );
}
