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
  | "invoices"
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
  /** Optional by design: historic records never consume a personal allowance. */
  personalLimitBucket?: PersonalLimitBucket;
  /** A purchase may be linked to a card but remains one expense. */
  creditCardId?: number;
  /** Historical imports may retain the issuer's explicit invoice competence. */
  invoiceReferenceMonth?: string;
};

export type InvoiceAdjustmentType =
  | "previous_balance"
  | "credit"
  | "debit"
  | "reversal"
  | "discount"
  | "installment_anticipation_discount";

export type InvoiceAdjustment = {
  id: number;
  cardId: number;
  referenceMonth: string;
  type: InvoiceAdjustmentType;
  /** Signed amount: positive debits increase the invoice; credits reduce it. */
  amount: number;
  description: string;
  date?: string;
};

export type CreditCard = {
  id: number;
  name: string;
  issuer?: string;
  owner: Person;
  creditLimit: number;
  closingDay: number;
  dueDay: number;
  appearance?: "purple" | "orange" | "blue";
  active: boolean;
};

/** Persisted payment state only; invoice totals and entries are derived. */
export type InvoicePayment = {
  id: number;
  cardId: number;
  referenceMonth: string;
  paidAt: string;
  amount: number;
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
  /** Optional by design: an installment can be paid outside a credit card. */
  creditCardId?: number;
};

export type InstallmentInvoiceEventType =
  | "regular"
  | "anticipated"
  | "historical";

export type InstallmentInvoiceEvent = {
  id: number;
  installmentId: number;
  cardId: number;
  referenceMonth: string;
  installmentNumber: number;
  amount: number;
  type: InstallmentInvoiceEventType;
  date?: string;
};

export type InstallmentReimbursementStatus =
  | "future"
  | "due"
  | "received"
  | "cancelled";

/** Traces an independent third-party reimbursement back to a card installment. */
export type InstallmentReimbursementAllocation = {
  id: number;
  installmentId: number;
  person: string;
  installmentNumber: number;
  amount: number;
  expectedMonth: string;
  status: InstallmentReimbursementStatus;
  debtId?: number;
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
  | "income-base"
  | "receive"
  | "advance"
  | "settings"
  | "card";

export type AppFinancialData = {
  expenses: Expense[];
  installments: Installment[];
  debts: Debt[];
  incomeEntries: IncomeEntry[];
  income: number;
  budgets: Record<string, number>;
  limits: Record<"Bruna" | "Matheus", number>;
  personalLimits: PersonalLimitConfiguration;
  creditCards: CreditCard[];
  invoicePayments: InvoicePayment[];
  invoiceAdjustments?: InvoiceAdjustment[];
  installmentInvoiceEvents?: InstallmentInvoiceEvent[];
  installmentReimbursementAllocations?: InstallmentReimbursementAllocation[];
  activeProfile: Person;
  viewMonth: string;
};
import type { PersonalLimitBucket } from "../finance/personalLimitBuckets";
import type { PersonalLimitConfiguration } from "../finance/personalLimits";
