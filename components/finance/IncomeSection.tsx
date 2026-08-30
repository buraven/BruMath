import { Pencil, Plus, Trash2, WalletCards } from "lucide-react";

type IncomeItem = {
  id: number;
  title: string;
  amount: number;
  who: "Bruna" | "Matheus" | "Casal";
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
    <section className="section">
      <div className="page-heading">
        <div>
          <span className="eyebrow"><WalletCards size={15} /> O que entra</span>
          <h1>Entradas de {monthName}</h1>
          <p>Salário, reembolsos e recebimentos ficam separados dos gastos. A renda base é editada em Orçamento.</p>
        </div>
        <button type="button" className="primary-button compact" onClick={onCreate}><Plus size={17} /> Nova entrada</button>
      </div>
      <div className="future-summary">
        <div><span>Renda base</span><strong>{formatMoney(income)}</strong></div>
        <div><span>Entradas extras</span><strong>{formatMoney(extraIncome)}</strong></div>
        <div><span>Total disponível antes dos gastos</span><strong>{formatMoney(totalAvailable)}</strong></div>
      </div>
      <div className="income-list">
        {entries.length ? entries.map(entry => (
          <div className="income-row" key={entry.id}>
            <div className="income-icon"><WalletCards size={18} /></div>
            <div><strong>{entry.title}</strong><span>{entry.who} · {entry.destination === "cartao" ? "cartão" : "conta"}{entry.note ? ` · ${entry.note}` : ""}</span></div>
            <strong>{formatMoney(entry.amount)}</strong>
            <button type="button" className="icon-button" onClick={() => onEdit(entry)}><Pencil size={15} /></button>
            <button type="button" className="icon-button danger-icon" onClick={() => onDelete(entry.id)}><Trash2 size={15} /></button>
          </div>
        )) : <div className="empty-state">Nenhuma entrada extra neste mês.</div>}
      </div>
    </section>
  );
}
