import { Pencil, Plus, Trash2, WalletCards } from "lucide-react";
import styles from "./Receipts.module.css";

type DebtItem = {
  id: number;
  person: string;
  amount: number;
  destination: "cartao" | "bruna" | "matheus" | "casal";
  note: string;
  paid: number;
  month: string;
  receivedMonth?: string;
};

type DebtSectionProps = {
  monthName: string;
  fallbackMonth: string;
  totalPending: number;
  openCount: number;
  debts: DebtItem[];
  formatMoney: (value: number) => string;
  formatMonth: (value: string) => string;
  onCreate: () => void;
  onEdit: (debt: DebtItem) => void;
  onDelete: (id: number) => void;
  onReceive: (debt: DebtItem) => void;
};

const destinationLabel = (destination: DebtItem["destination"]) => {
  if (destination === "cartao") return "vai para o cartão";
  if (destination === "bruna") return "vai para Bruna";
  if (destination === "matheus") return "vai para Matheus";
  return "vai para o casal";
};

export function DebtSection({
  monthName,
  fallbackMonth,
  totalPending,
  openCount,
  debts,
  formatMoney,
  formatMonth,
  onCreate,
  onEdit,
  onDelete,
  onReceive,
}: DebtSectionProps) {
  return (
    <section className={`${styles.screen} ${styles.debts}`}>
      <div className="page-heading">
        <div>
          <span className="eyebrow">
            <WalletCards size={15} /> Quem me deve
          </span>
          <h1>Valores a receber</h1>
          <p>
            Cadastre quem deve e quanto deve. Se ficar saldo em aberto, ele
            continua automaticamente nos meses seguintes até ser quitado.
          </p>
        </div>
        <button
          type="button"
          className="primary-button compact"
          onClick={onCreate}
        >
          <Plus size={17} /> Novo valor
        </button>
      </div>
      <div className={styles.summary}>
        <article>
          <span>Valores pendentes em {monthName}</span>
          <strong>{formatMoney(totalPending)}</strong>
          <small>{openCount} pessoas/valores em aberto neste mês</small>
        </article>
        <article>
          <span>Recebido dos valores listados</span>
          <strong>
            {formatMoney(debts.reduce((total, debt) => total + debt.paid, 0))}
          </strong>
          <small>Inclui recebimentos de meses anteriores</small>
        </article>
        <article>
          <span>Total dos valores listados</span>
          <strong>
            {formatMoney(debts.reduce((total, debt) => total + debt.amount, 0))}
          </strong>
          <small>{debts.length} cobranças no período selecionado</small>
        </article>
      </div>
      <div className={styles.list}>
        <div className={styles.listHeading}>
          <h2>
            Quem me deve <small>(Extras)</small>
          </h2>
          <span>{openCount} em aberto</span>
        </div>
        {debts.length ? (
          debts.map((debt) => {
            const remaining = Math.max(0, debt.amount - debt.paid);
            return (
              <article className={styles.row} key={debt.id}>
                <div className={styles.details}>
                  <strong>{debt.person}</strong>
                  <span>
                    {debt.note || "Valor a receber"} ·{" "}
                    {destinationLabel(debt.destination)} ·{" "}
                    {formatMonth(debt.month || fallbackMonth)}
                  </span>
                  <div className={styles.receiptAmounts}>
                    <small className={styles.received}>
                      {formatMoney(debt.paid)} recebidos
                    </small>
                    <small
                      className={
                        remaining > 0 ? styles.pending : styles.received
                      }
                    >
                      {remaining > 0
                        ? `${formatMoney(remaining)} em aberto`
                        : "Quitado"}
                    </small>
                  </div>
                  <progress
                    className={styles.progress}
                    max={Math.max(debt.amount, 1)}
                    value={Math.min(
                      Math.max(debt.paid, 0),
                      Math.max(debt.amount, 1),
                    )}
                    aria-label={`Valor recebido de ${debt.person}`}
                  />
                </div>
                <div className={styles.amount}>
                  <small>Valor total</small>
                  <strong>{formatMoney(debt.amount)}</strong>
                </div>
                <div className={styles.actions}>
                  <button
                    type="button"
                    className="icon-button"
                    onClick={() => onEdit(debt)}
                    aria-label={`Editar dívida de ${debt.person}`}
                  >
                    <Pencil size={15} />
                  </button>
                  <button
                    type="button"
                    className="icon-button danger-icon"
                    onClick={() => onDelete(debt.id)}
                    aria-label={`Excluir dívida de ${debt.person}`}
                  >
                    <Trash2 size={15} />
                  </button>
                  <button
                    type="button"
                    className="primary-button compact"
                    onClick={() => onReceive(debt)}
                    disabled={remaining <= 0}
                  >
                    {remaining <= 0 ? "Recebido" : "Recebi"}
                  </button>
                </div>
              </article>
            );
          })
        ) : (
          <div className="empty-state">
            Nenhum valor a receber em {monthName}. Use &quot;Novo valor&quot;
            para cadastrar uma cobrança neste mês.
          </div>
        )}
      </div>
    </section>
  );
}
