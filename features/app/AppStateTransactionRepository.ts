"use client";

import type { Dispatch, SetStateAction } from "react";
import type { Expense } from "../../lib/app/AppTypes";
import type { TransactionRepository } from "../../lib/finance/TransactionRepository";
import type { Transaction } from "../../lib/finance/transactions";

/**
 * Adapts assistant actions to the same React snapshot used by the manual UI.
 * Persistence remains the responsibility of usePersistedFinancialState.
 */
export class AppStateTransactionRepository implements TransactionRepository {
  constructor(
    private readonly setExpenses: Dispatch<SetStateAction<Expense[]>>,
  ) {}

  async getAll(): Promise<Transaction[]> {
    return [];
  }

  async getById(id: string): Promise<Transaction | null> {
    return (await this.getAll()).find((item) => item.id === id) ?? null;
  }

  async save(transaction: Transaction): Promise<void> {
    if (transaction.type !== "expense") {
      throw new Error(
        "Income actions are not supported by the app state adapter.",
      );
    }
    const id = Number(transaction.id.replace("expense:", ""));
    if (!Number.isInteger(id))
      throw new Error("Invalid expense transaction id.");
    this.setExpenses((current) => [
      {
        id,
        title: transaction.description,
        cat: transaction.category,
        who: transaction.owner,
        amount: transaction.amount,
        date: transaction.date,
      },
      ...current,
    ]);
  }

  async update(): Promise<void> {
    throw new Error(
      "Updating transactions is not supported by this action adapter.",
    );
  }

  async delete(): Promise<void> {
    throw new Error(
      "Deleting transactions is not supported by this action adapter.",
    );
  }
}
