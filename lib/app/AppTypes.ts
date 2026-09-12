export type Person = "Bruna" | "Matheus" | "Casal";
export type NavigationTab =
  | "limits"
  | "categories"
  | "home"
  | "chat"
  | "stats"
  | "future"
  | "debts"
  | "income"
  | "preferences";
export type Tab = NavigationTab;
export type ThemeMode = "light" | "dark" | "system";
export type DebtDestination = "cartao" | "bruna" | "matheus" | "casal";

export type Expense = {
  id: number;
  title: string;
  cat: string;
  who: Person;
  amount: number;
  date: string;
};

export type Installment = {
  id: number;
  title: string;
  category: string;
  who: Person;
  amount: number;
  totalInstallments: number;
  paidInstallments: number;
  nextDue: string;
};

export type Debt = {
  id: number;
  person: string;
  amount: number;
  destination: DebtDestination;
  note: string;
  paid: number;
  month: string;
  receivedMonth?: string;
};

export type IncomeEntry = {
  id: number;
  title: string;
  amount: number;
  who: Person;
  date: string;
  destination: "conta" | "cartao";
  note: string;
};

export type ChatMessage = {
  id: number;
  role: "assistant" | "user";
  text: string;
  status?: "pending";
};

export type CompactAssistantMessage = { text: string; status?: "pending" };

export type Confirmation = {
  title: string;
  description: string;
  confirmLabel: string;
  details?: readonly { label: string; value: string }[];
  destructive?: boolean;
  onConfirm: () => void;
};

export type AppModal =
  | "none"
  | "expense"
  | "installment"
  | "debt"
  | "income"
  | "receive"
  | "advance"
  | "settings";

export type AppFinancialData = {
  expenses: Expense[];
  installments: Installment[];
  debts: Debt[];
  incomeEntries: IncomeEntry[];
  income: number;
  budgets: Record<string, number>;
  limits: Record<"Bruna" | "Matheus", number>;
  activeProfile: Person;
  viewMonth: string;
};
