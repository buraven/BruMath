import { Pencil, Plus, Trash2, WalletCards } from "lucide-react";

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
    <section className="section">
      <div className="page-heading">
        <div>
          <span className="eyebrow"><WalletCards size={15} /> Quem me deve</span>
          <h1>Valores a receber</h1>
          <p>Cadastre quem deve e quanto deve. Se ficar saldo em aberto, ele continua automaticamente nos meses seguintes até ser quitado.</p>
        </div>
        <button type="button" className="primary-button compact" onClick={onCreate}><Plus size={17} /> Novo valor</button>
      </div>
      <div className="debt-total-card"><span>Valores pendentes em {monthName}</span><strong>{formatMoney(totalPending)}</strong><small>{openCount} pessoas/valores em aberto neste mês</small></div>
      <div className="debt-list">
        {debts.length ? debts.map(debt => (
          <div className="debt-row" key={debt.id}>
            <div><strong>{debt.person}</strong><span>{debt.note || "Valor a receber"} · {destinationLabel(debt.destination)} · {formatMonth(debt.month || fallbackMonth)}</span></div>
            <strong>{formatMoney(Math.max(0, debt.amount - debt.paid))}</strong>
            <button type="button" className="icon-button" onClick={() => onEdit(debt)} aria-label="Editar dívida"><Pencil size={15} /></button>
            <button type="button" className="icon-button danger-icon" onClick={() => onDelete(debt.id)} aria-label="Excluir dívida"><Trash2 size={15} /></button>
            <button type="button" className="primary-button compact" onClick={() => onReceive(debt)} disabled={debt.paid >= debt.amount}>{debt.paid >= debt.amount ? "Recebido" : "Recebi"}</button>
          </div>
        )) : <div className="empty-state">Nenhum valor a receber em {monthName}. Use "Novo valor" para cadastrar uma cobrança neste mês.</div>}
      </div>
    </section>
  );
}
