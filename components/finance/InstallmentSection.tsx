import type { ReactNode } from "react";
import { CalendarDays, Pencil, Plus, Trash2 } from "lucide-react";

type InstallmentItem = {
  id: number;
  title: string;
  category: string;
  who: "Bruna" | "Matheus" | "Casal";
  amount: number;
  totalInstallments: number;
  paidInstallments: number;
  nextDue: string;
};

type InstallmentSectionProps = {
  monthName: string;
  activeCount: number;
  futureMonthly: number;
  remainingInstallments: number;
  installments: InstallmentItem[];
  formatMoney: (value: number) => string;
  formatDate: (value: string) => string;
  renderIcon: (category: string) => ReactNode;
  onCreate: () => void;
  onPay: (id: number, count: number) => void;
  onAdvance: (installment: InstallmentItem) => void;
  onEdit: (installment: InstallmentItem) => void;
  onDelete: (id: number) => void;
};

export function InstallmentSection({
  monthName,
  activeCount,
  futureMonthly,
  remainingInstallments,
  installments,
  formatMoney,
  formatDate,
  renderIcon,
  onCreate,
  onPay,
  onAdvance,
  onEdit,
  onDelete,
}: InstallmentSectionProps) {
  return (
    <section className="section">
      <div className="page-heading">
        <div>
          <span className="eyebrow"><CalendarDays size={15} /> Futuro</span>
          <h1>Parcelas e compromissos</h1>
          <p>As parcelas têm vencimento próprio. Ao pagar, o próximo vencimento avança automaticamente para o mês seguinte.</p>
        </div>
        <button type="button" className="primary-button compact" onClick={onCreate}><Plus size={17} /> Nova parcela</button>
      </div>
      <div className="future-summary">
        <div><span>Ativas</span><strong>{activeCount}</strong></div>
        <div><span>Compromisso em {monthName}</span><strong>{formatMoney(futureMonthly)}</strong></div>
        <div><span>Restantes</span><strong>{remainingInstallments}</strong></div>
      </div>
      <div className="installment-list">
        {installments.length === 0 ? <div className="empty-state">Nenhuma parcela cadastrada.</div> : installments.map(installment => {
          const left = Math.max(0, installment.totalInstallments - installment.paidInstallments);
          const progress = installment.totalInstallments ? installment.paidInstallments / installment.totalInstallments * 100 : 0;

          return (
            <article className="installment-card" key={installment.id}>
              <div className="installment-icon">{renderIcon(installment.category)}</div>
              <div className="installment-main">
                <div className="installment-title-row"><div><strong>{installment.title}</strong><span>{installment.category} · {installment.who}</span></div><strong>{formatMoney(installment.amount)}/mês</strong></div>
                <div className="installment-details"><div><span>Pagas</span><b>{installment.paidInstallments}</b></div><div><span>Faltam</span><b>{left}</b></div><div><span>Total</span><b>{installment.totalInstallments}</b></div><div><span>Próximo</span><b>{left ? formatDate(installment.nextDue) : "Quitada"}</b></div></div>
                <div className="installment-progress"><div className="progress-track small"><div className="progress-fill" style={{ width: `${progress}%` }} /></div><span>{Math.round(progress)}% pago</span></div>
                <div className="installment-actions"><button type="button" disabled={!left} onClick={() => onPay(installment.id, 1)}>Pagar 1</button><button type="button" disabled={left < 2} onClick={() => onAdvance(installment)}>Adiantar</button><button type="button" disabled={!left} onClick={() => onPay(installment.id, left)}>Quitar</button><button type="button" onClick={() => onEdit(installment)}><Pencil size={14} /> Editar</button><button type="button" className="danger-action" onClick={() => onDelete(installment.id)}><Trash2 size={14} /> Excluir</button></div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
