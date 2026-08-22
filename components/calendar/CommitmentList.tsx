type Commitment = {
  id: string | number;
  date: string;
  title: string;
  amount: number;
  recurring?: boolean;
};

type CommitmentListProps = {
  commitments: Commitment[];
  formatMoney: (value: number) => string;
  formatDate: (value: string) => string;
  onEdit?: (commitment: Commitment) => void;
};

export function CommitmentList({ commitments, formatMoney, formatDate, onEdit }: CommitmentListProps) {
  if (!commitments.length) return <div className="empty-state">Nenhum compromisso neste período.</div>;

  return (
    <div className="commitment-list">
      {commitments.map((commitment) => (
        <div className="commitment-row" key={commitment.id}>
          <div>
            <strong>{commitment.title}</strong>
            <span>{formatDate(commitment.date)}{commitment.recurring ? " · Recorrente" : ""}</span>
          </div>
          <strong>{formatMoney(commitment.amount)}</strong>
          {onEdit && <button type="button" className="text-button" onClick={() => onEdit(commitment)}>Editar</button>}
        </div>
      ))}
    </div>
  );
}
