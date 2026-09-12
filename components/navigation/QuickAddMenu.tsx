import {
  CreditCard,
  HandCoins,
  Plus,
  Receipt,
  WalletCards,
  X,
} from "lucide-react";

type Props = {
  open: boolean;
  onToggle: () => void;
  onExpense: () => void;
  onInstallment: () => void;
  onIncome: () => void;
  onReceivable: () => void;
};

const actions = [
  {
    id: "expense",
    label: "Adicionar gasto",
    detail: "Registre uma saída",
    icon: Receipt,
  },
  {
    id: "installment",
    label: "Adicionar parcela",
    detail: "Acompanhe um compromisso",
    icon: CreditCard,
  },
  {
    id: "income",
    label: "Adicionar entrada",
    detail: "Inclua um valor recebido",
    icon: WalletCards,
  },
  {
    id: "receivable",
    label: "Valor a receber",
    detail: "Registre quem ficou de pagar",
    icon: HandCoins,
  },
] as const;

export function QuickAddMenu({
  open,
  onToggle,
  onExpense,
  onInstallment,
  onIncome,
  onReceivable,
}: Props) {
  const handlers = {
    expense: onExpense,
    installment: onInstallment,
    income: onIncome,
    receivable: onReceivable,
  } as const;
  return (
    <div className="fab-wrap">
      {open ? (
        <div className="quick-add-menu" aria-label="Adicionar movimentação">
          <p>Adicionar</p>
          {actions.map(({ id, label, detail, icon: Icon }) => (
            <button key={id} type="button" onClick={handlers[id]}>
              <span className="quick-add-icon">
                <Icon size={17} aria-hidden="true" />
              </span>
              <span>
                <strong>{label}</strong>
                <small>{detail}</small>
              </span>
            </button>
          ))}
        </div>
      ) : null}
      <button
        type="button"
        className={`floating-add ${open ? "is-open" : ""}`}
        onClick={onToggle}
        aria-label="Adicionar"
        aria-expanded={open}
      >
        {open ? <X size={23} /> : <Plus size={25} />}
      </button>
    </div>
  );
}
