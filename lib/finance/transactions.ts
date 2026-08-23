export type TransactionType = "expense" | "income";
export type TransactionOwner = "Bruna" | "Matheus" | "Casal";

export type Transaction = {
  id: string;
  description: string;
  amount: number;
  category: string;
  owner: TransactionOwner;
  type: TransactionType;
  date: string;
  installment?: {
    current: number;
    total: number;
  };
};

export function normalizeTransactionAmount(transaction: Transaction): number {
  return Math.max(0, transaction.amount);
}

export function isExpense(transaction: Transaction): boolean {
  return transaction.type === "expense";
}

export function isIncome(transaction: Transaction): boolean {
  return transaction.type === "income";
}
