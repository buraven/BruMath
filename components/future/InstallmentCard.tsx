import { CreditCard } from "lucide-react";

type Installment = {
  id: number;
  title: string;
  category: string;
  who: string;
  amount: number;
  totalInstallments: number;
  paidInstallments: number;
  nextDue: string;
};

type InstallmentCardProps = {
  installment: Installment;
  formatMoney: (value: number) => string;
  formatDate: (value: string) => string;
  onEdit?: (installment: Installment) => void;
};

export function InstallmentCard({ installment, formatMoney, formatDate, onEdit }: InstallmentCardProps) {
  const remaining = Math.max(installment.totalInstallments - installment.paidInstallments, 0);
  return (
    <article className="future-card">
      <div className="future-card-icon"><CreditCard size={18} /></div>
      <div className="future-card-content">
        <strong>{installment.title}</strong>
        <span>{installment.category} · {installment.who}</span>
        <small>{remaining} parcelas restantes · próxima {formatDate(installment.nextDue)}</small>
      </div>
      <div className="future-card-value">
        <strong>{formatMoney(installment.amount)}</strong>
        {onEdit && <button type="button" className="text-button" onClick={() => onEdit(installment)}>Editar</button>}
      </div>
    </article>
  );
}
