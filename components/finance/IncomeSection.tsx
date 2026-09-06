import { Pencil, Plus, Trash2, WalletCards } from "lucide-react";
import styles from "./Receipts.module.css";

type IncomeItem = {
  id: number;
  title: string;
  amount: number;
  who: "Bruna" | "Matheus" | "Casal";
  date: string;
  destination: "conta" | "cartao";
  note: string;
};

type IncomeSectionProps = {
  monthName: string;
  income: number;
  extraIncome: number;
  totalAvailable: number;
  entries: IncomeItem[];
  formatMoney: (value: number) => string;
  onCreate: () => void;
  onEdit: (entry: IncomeItem) => void;
  onDelete: (id: number) => void;
};

export function IncomeSection({
  monthName,
  income,
  extraIncome,
  totalAvailable,
  entries,
  formatMoney,
  onCreate,
  onEdit,
  onDelete,
}: IncomeSectionProps) {
  return (
    <section className={`${styles.screen} ${styles.income}`}>
      <div className="page-heading">
        <div>
          <span className="eyebrow">
            <WalletCards size={15} /> O que entra
          </span>
          <h1>Entradas de {monthName}</h1>
          <p>
            Salário, reembolsos e recebimentos ficam separados dos gastos. A
            renda base é editada em Orçamento.
          </p>
        </div>
        <button
          type="button"
          className="primary-button compact"
          onClick={onCreate}
        >
          <Plus size={17} /> Nova entrada
        </button>
      </div>
      <div className={styles.summary}>
        <article>
          <span>Renda base</span>
          <strong>{formatMoney(income)}</strong>
          <small>Configurada no orçamento</small>
        </article>
        <article>
          <span>Entradas extras</span>
          <strong>{formatMoney(extraIncome)}</strong>
          <small>Recebimentos adicionais no mês</small>
        </article>
        <article>
          <span>Total disponível antes dos gastos</span>
          <strong>{formatMoney(totalAvailable)}</strong>
          <small>Conforme o mês selecionado</small>
        </article>
      </div>
      <div className={styles.list}>
        <div className={styles.listHeading}>
          <h2>O que entra</h2>
          <span>{entries.length} entradas extras</span>
        </div>
        {entries.length ? (
          entries.map((entry) => (
            <article className={styles.row} key={entry.id}>
              <div className={styles.details}>
                <strong>{entry.title}</strong>
                <span>
                  {entry.who} ·{" "}
                  {entry.destination === "cartao" ? "cartão" : "conta"}
                  {entry.note ? ` · ${entry.note}` : ""}
                </span>
                <time dateTime={entry.date}>
                  {entry.date.split("-").reverse().join("/")}
                </time>
              </div>
              <div className={styles.amount}>
                <small>Entrada</small>
                <strong className={styles.received}>
                  {formatMoney(entry.amount)}
                </strong>
              </div>
              <div className={styles.actions}>
                <button
                  type="button"
                  className="icon-button"
                  aria-label={`Editar entrada ${entry.title}`}
                  onClick={() => onEdit(entry)}
                >
                  <Pencil size={15} />
                </button>
                <button
                  type="button"
                  className="icon-button danger-icon"
                  aria-label={`Excluir entrada ${entry.title}`}
                  onClick={() => onDelete(entry.id)}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </article>
          ))
        ) : (
          <div className="empty-state">Nenhuma entrada extra neste mês.</div>
        )}
      </div>
    </section>
  );
}
