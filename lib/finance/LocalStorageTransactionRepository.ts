import type { TransactionRepository } from "./TransactionRepository";
import type { Transaction, TransactionOwner } from "./transactions";

type StoredExpense = {
  id: number;
  title: string;
  cat: string;
  who: TransactionOwner;
  amount: number;
  date: string;
};

type StoredIncome = {
  id: number;
  title: string;
  amount: number;
  who: TransactionOwner;
  date: string;
  destination: "conta" | "cartao";
  note: string;
};

type StorageData = {
  expenses?: StoredExpense[];
  incomeEntries?: StoredIncome[];
};

const STORAGE_KEY = "brumath-data";

function assertBrowser() {
  if (typeof window === "undefined") {
    throw new Error("Transaction storage is only available in the browser.");
  }
}

function readData(): StorageData {
  assertBrowser();
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return {};

  try {
    const parsed = JSON.parse(raw) as StorageData;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeData(data: StorageData) {
  assertBrowser();
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function expenseToTransaction(expense: StoredExpense): Transaction {
  return {
    id: `expense:${expense.id}`,
    description: expense.title,
    amount: expense.amount,
    category: expense.cat,
    owner: expense.who,
    type: "expense",
    date: expense.date,
  };
}

function incomeToTransaction(income: StoredIncome): Transaction {
  return {
    id: `income:${income.id}`,
    description: income.title,
    amount: income.amount,
    category: "Renda",
    owner: income.who,
    type: "income",
    date: income.date,
  };
}

function transactionToStoredExpense(transaction: Transaction): StoredExpense {
  const id = Number(transaction.id.replace("expense:", ""));
  if (!Number.isInteger(id)) throw new Error("Invalid expense transaction id.");

  return {
    id,
    title: transaction.description,
    cat: transaction.category,
    who: transaction.owner,
    amount: transaction.amount,
    date: transaction.date,
  };
}

function transactionToStoredIncome(transaction: Transaction): StoredIncome {
  const id = Number(transaction.id.replace("income:", ""));
  if (!Number.isInteger(id)) throw new Error("Invalid income transaction id.");

  return {
    id,
    title: transaction.description,
    amount: transaction.amount,
    who: transaction.owner,
    date: transaction.date,
    destination: "conta",
    note: "",
  };
}

export class LocalStorageTransactionRepository implements TransactionRepository {
  async getAll(): Promise<Transaction[]> {
    const data = readData();
    return [
      ...(data.expenses ?? []).map(expenseToTransaction),
      ...(data.incomeEntries ?? []).map(incomeToTransaction),
    ];
  }

  async getById(id: string): Promise<Transaction | null> {
    const transactions = await this.getAll();
    return transactions.find((transaction) => transaction.id === id) ?? null;
  }

  async save(transaction: Transaction): Promise<void> {
    const data = readData();

    if (transaction.type === "expense") {
      data.expenses = [...(data.expenses ?? []), transactionToStoredExpense(transaction)];
    } else {
      data.incomeEntries = [...(data.incomeEntries ?? []), transactionToStoredIncome(transaction)];
    }

    writeData(data);
  }

  async update(transaction: Transaction): Promise<void> {
    const data = readData();

    if (transaction.type === "expense") {
      const expenses = data.expenses ?? [];
      const updated = transactionToStoredExpense(transaction);
      const index = expenses.findIndex((expense) => expense.id === updated.id);
      if (index < 0) throw new Error("Expense transaction not found.");
      data.expenses = expenses.map((expense, currentIndex) => currentIndex === index ? updated : expense);
    } else {
      const incomeEntries = data.incomeEntries ?? [];
      const updated = transactionToStoredIncome(transaction);
      const index = incomeEntries.findIndex((income) => income.id === updated.id);
      if (index < 0) throw new Error("Income transaction not found.");
      data.incomeEntries = incomeEntries.map((income, currentIndex) => currentIndex === index ? updated : income);
    }

    writeData(data);
  }

  async delete(id: string): Promise<void> {
    const data = readData();

    if (id.startsWith("expense:")) {
      const numericId = Number(id.replace("expense:", ""));
      data.expenses = (data.expenses ?? []).filter((expense) => expense.id !== numericId);
    } else if (id.startsWith("income:")) {
      const numericId = Number(id.replace("income:", ""));
      data.incomeEntries = (data.incomeEntries ?? []).filter((income) => income.id !== numericId);
    } else {
      throw new Error("Invalid transaction id.");
    }

    writeData(data);
  }
}
