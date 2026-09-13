"use client";

import { ArrowLeft, ChevronRight, Settings2, Tag } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { ExpenseList } from "../../components/finance/ExpenseList";
import type { Expense, Person } from "../../lib/app/AppTypes";
import {
  deriveCategoryDetails,
  type CategoryDetail,
} from "../app/financialSelectors";
import styles from "./CategoriesScreen.module.css";

type Props = {
  monthLabel: string;
  profile: Person;
  expenses: readonly Expense[];
  budgets: Readonly<Record<string, number>>;
  onConfigureLimits: () => void;
  onEditExpense: (expense: Expense) => void;
  onDeleteExpense: (id: number) => void;
  formatMoney: (value: number) => string;
  formatDate: (value: string) => string;
  renderIcon: (category: string) => ReactNode;
};

const statusLabel: Record<CategoryDetail["status"], string> = {
  normal: "Dentro do limite",
  warning: "Atenção ao limite",
  exceeded: "Limite excedido",
  unlimited: "Sem limite definido",
};

export function CategoriesScreen({
  monthLabel,
  profile,
  expenses,
  budgets,
  onConfigureLimits,
  onEditExpense,
  onDeleteExpense,
  formatMoney,
  formatDate,
  renderIcon,
}: Props) {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const categories = useMemo(
    () => deriveCategoryDetails({ expenses, budgets, profile }),
    [budgets, expenses, profile],
  );
  const detail = categories.find((item) => item.category === selectedCategory);

  if (detail) {
    return (
      <CategoryDetailScreen
        detail={detail}
        monthLabel={monthLabel}
        profile={profile}
        formatMoney={formatMoney}
        formatDate={formatDate}
        renderIcon={renderIcon}
        onBack={() => setSelectedCategory(null)}
        onConfigureLimits={onConfigureLimits}
        onEditExpense={onEditExpense}
        onDeleteExpense={onDeleteExpense}
      />
    );
  }

  return (
    <section className={styles.screen} aria-labelledby="categories-title">
      <header className={styles.header}>
        <div>
          <span className={styles.eyebrow}>
            <Tag size={15} /> Organização financeira
          </span>
          <h1 id="categories-title">Categorias</h1>
          <p>
            {monthLabel} · {profile}
          </p>
        </div>
        <button
          type="button"
          className={styles.secondary}
          onClick={onConfigureLimits}
        >
          <Settings2 size={16} /> Configurar limites
        </button>
      </header>

      {categories.length ? (
        <div className={styles.grid}>
          {categories.map((category) => (
            <CategoryCard
              category={category}
              key={category.category}
              formatMoney={formatMoney}
              renderIcon={renderIcon}
              onOpen={() => setSelectedCategory(category.category)}
            />
          ))}
        </div>
      ) : (
        <div className={styles.empty}>
          <span className={styles.emptyIcon} aria-hidden="true">
            <Tag size={22} />
          </span>
          <h2>Nenhuma categoria para este período</h2>
          <p>
            Registre um gasto ou configure limites para acompanhar suas
            categorias.
          </p>
          <button
            type="button"
            className={styles.secondary}
            onClick={onConfigureLimits}
          >
            Configurar limites
          </button>
        </div>
      )}
    </section>
  );
}

function CategoryCard({
  category,
  formatMoney,
  renderIcon,
  onOpen,
}: {
  category: CategoryDetail;
  formatMoney: (value: number) => string;
  renderIcon: (category: string) => ReactNode;
  onOpen: () => void;
}) {
  const progress = Math.min(100, Math.max(0, category.percentage ?? 0));
  const remainingText =
    category.remaining === null
      ? "Sem limite definido"
      : category.remaining < 0
        ? `${formatMoney(Math.abs(category.remaining))} acima do limite`
        : `${formatMoney(category.remaining)} restantes`;

  return (
    <article className={styles.card}>
      <div className={styles.cardTop}>
        <span className={styles.icon} aria-hidden="true">
          {renderIcon(category.category)}
        </span>
        <span className={`${styles.status} ${styles[category.status]}`}>
          {statusLabel[category.status]}
        </span>
      </div>
      <h2>{category.category}</h2>
      <div className={styles.values}>
        <strong>{formatMoney(category.spent)}</strong>
        <span>
          {category.limit === null
            ? "gastos no período"
            : `de ${formatMoney(category.limit)}`}
        </span>
      </div>
      {category.limit !== null && (
        <>
          <div className={styles.progressMeta}>
            <span>{Math.round(category.percentage ?? 0)}% usado</span>
            <span>{remainingText}</span>
          </div>
          <progress
            className={`${styles.progress} ${styles[category.status]}`}
            value={progress}
            max={100}
            aria-label={`Consumo do limite de ${category.category}`}
          />
        </>
      )}
      {category.limit === null && (
        <p className={styles.noLimit}>{remainingText}</p>
      )}
      <button type="button" className={styles.detailButton} onClick={onOpen}>
        Ver gastos da categoria <ChevronRight size={16} />
      </button>
    </article>
  );
}

function CategoryDetailScreen({
  detail,
  monthLabel,
  profile,
  formatMoney,
  formatDate,
  renderIcon,
  onBack,
  onConfigureLimits,
  onEditExpense,
  onDeleteExpense,
}: {
  detail: CategoryDetail;
  monthLabel: string;
  profile: Person;
  formatMoney: (value: number) => string;
  formatDate: (value: string) => string;
  renderIcon: (category: string) => ReactNode;
  onBack: () => void;
  onConfigureLimits: () => void;
  onEditExpense: (expense: Expense) => void;
  onDeleteExpense: (id: number) => void;
}) {
  const progress = Math.min(100, Math.max(0, detail.percentage ?? 0));
  const remaining =
    detail.remaining === null
      ? "Sem limite definido"
      : detail.remaining < 0
        ? `${formatMoney(Math.abs(detail.remaining))} acima do limite`
        : `${formatMoney(detail.remaining)} restantes`;

  return (
    <section className={styles.screen} aria-labelledby="category-detail-title">
      <button type="button" className={styles.back} onClick={onBack}>
        <ArrowLeft size={16} /> Voltar para categorias
      </button>
      <header className={styles.detailHeader}>
        <span className={styles.detailIcon} aria-hidden="true">
          {renderIcon(detail.category)}
        </span>
        <div>
          <span className={styles.eyebrow}>Detalhamento da categoria</span>
          <h1 id="category-detail-title">{detail.category}</h1>
          <p>
            {monthLabel} · {profile}
          </p>
        </div>
      </header>

      <div className={styles.detailLayout}>
        <aside className={styles.summary} aria-label="Resumo da categoria">
          <span>Total gasto</span>
          <strong>{formatMoney(detail.spent)}</strong>
          <dl>
            <div>
              <dt>Limite</dt>
              <dd>
                {detail.limit === null
                  ? "Sem limite definido"
                  : formatMoney(detail.limit)}
              </dd>
            </div>
            <div>
              <dt>Disponível</dt>
              <dd>{remaining}</dd>
            </div>
            <div>
              <dt>Uso</dt>
              <dd>
                {detail.percentage === null
                  ? "—"
                  : `${Math.round(detail.percentage)}%`}
              </dd>
            </div>
          </dl>
          {detail.limit !== null && (
            <progress
              className={`${styles.progress} ${styles[detail.status]}`}
              value={progress}
              max={100}
              aria-label={`Consumo do limite de ${detail.category}`}
            />
          )}
          <button
            type="button"
            className={styles.secondary}
            onClick={onConfigureLimits}
          >
            <Settings2 size={16} /> Ajustar limites
          </button>
        </aside>

        <div className={styles.expenses}>
          <div className={styles.expensesHeading}>
            <div>
              <h2>Gastos em {detail.category}</h2>
              <p>{detail.expenses.length} registro(s) no período</p>
            </div>
          </div>
          <ExpenseList
            expenses={[...detail.expenses]}
            onEdit={onEditExpense}
            onDelete={onDeleteExpense}
            formatMoney={formatMoney}
            formatDate={formatDate}
            renderIcon={renderIcon}
          />
        </div>
      </div>
    </section>
  );
}
