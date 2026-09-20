import type { SupabaseClient } from "@supabase/supabase-js";
import type { AppFinancialData } from "../app/AppTypes";
import type {
  FinancialImportTarget,
  LocalMigrationPreview,
} from "./LocalSnapshotMigration";

export type RemoteSnapshot = {
  settings: {
    income: number;
    budgets: AppFinancialData["budgets"];
    limits: AppFinancialData["limits"];
    personal_limits: AppFinancialData["personalLimits"];
    active_profile: AppFinancialData["activeProfile"];
    view_month: string;
  };
  expenses: Array<{
    legacy_id: number;
    title: string;
    category: string;
    responsible: AppFinancialData["expenses"][number]["who"];
    amount: number;
    occurred_on: string;
    personal_limit_bucket:
      | AppFinancialData["expenses"][number]["personalLimitBucket"]
      | null;
    credit_card_legacy_id: number | null;
  }>;
  installments: Array<{
    legacy_id: number;
    title: string;
    category: string;
    responsible: AppFinancialData["installments"][number]["who"];
    amount: number;
    total_installments: number;
    paid_installments: number;
    next_due: string;
    credit_card_legacy_id: number | null;
  }>;
  receivables: Array<{
    legacy_id: number;
    person: string;
    amount: number;
    paid: number;
    destination: AppFinancialData["debts"][number]["destination"];
    note: string;
    competence_month: string;
    received_month: string | null;
  }>;
  income_entries: Array<{
    legacy_id: number;
    title: string;
    amount: number;
    responsible: AppFinancialData["incomeEntries"][number]["who"];
    occurred_on: string;
    destination: AppFinancialData["incomeEntries"][number]["destination"];
    note: string;
  }>;
  credit_cards: Array<{
    legacy_id: number;
    name: string;
    issuer: string | null;
    owner: AppFinancialData["creditCards"][number]["owner"];
    credit_limit: number;
    closing_day: number;
    due_day: number;
    appearance: AppFinancialData["creditCards"][number]["appearance"] | null;
    active: boolean;
  }>;
  invoice_payments: Array<{
    legacy_id: number;
    card_legacy_id: number;
    reference_month: string;
    paid_at: string;
    amount: number;
  }>;
};

type RpcImportResult = { imported: boolean; snapshot: RemoteSnapshot };

const monthDate = (month: string) => `${month.slice(0, 7)}-01`;
const monthValue = (date: string) => date.slice(0, 7);

export function toRemoteSnapshot(snapshot: AppFinancialData): RemoteSnapshot {
  return {
    settings: {
      income: snapshot.income,
      budgets: snapshot.budgets,
      limits: snapshot.limits,
      personal_limits: snapshot.personalLimits,
      active_profile: snapshot.activeProfile,
      view_month: monthDate(snapshot.viewMonth),
    },
    expenses: [...snapshot.expenses]
      .sort((a, b) => a.id - b.id)
      .map((expense) => ({
        legacy_id: expense.id,
        title: expense.title,
        category: expense.cat,
        responsible: expense.who,
        amount: expense.amount,
        occurred_on: expense.date,
        personal_limit_bucket: expense.personalLimitBucket ?? null,
        credit_card_legacy_id: expense.creditCardId ?? null,
      })),
    installments: [...snapshot.installments]
      .sort((a, b) => a.id - b.id)
      .map((installment) => ({
        legacy_id: installment.id,
        title: installment.title,
        category: installment.category,
        responsible: installment.who,
        amount: installment.amount,
        total_installments: installment.totalInstallments,
        paid_installments: installment.paidInstallments,
        next_due: installment.nextDue,
        credit_card_legacy_id: installment.creditCardId ?? null,
      })),
    receivables: [...snapshot.debts]
      .sort((a, b) => a.id - b.id)
      .map((debt) => ({
        legacy_id: debt.id,
        person: debt.person,
        amount: debt.amount,
        paid: debt.paid,
        destination: debt.destination,
        note: debt.note,
        competence_month: monthDate(debt.month),
        received_month: debt.receivedMonth
          ? monthDate(debt.receivedMonth)
          : null,
      })),
    income_entries: [...snapshot.incomeEntries]
      .sort((a, b) => a.id - b.id)
      .map((entry) => ({
        legacy_id: entry.id,
        title: entry.title,
        amount: entry.amount,
        responsible: entry.who,
        occurred_on: entry.date,
        destination: entry.destination,
        note: entry.note,
      })),
    credit_cards: [...snapshot.creditCards]
      .sort((a, b) => a.id - b.id)
      .map((card) => ({
        legacy_id: card.id,
        name: card.name,
        issuer: card.issuer ?? null,
        owner: card.owner,
        credit_limit: card.creditLimit,
        closing_day: card.closingDay,
        due_day: card.dueDay,
        appearance: card.appearance ?? null,
        active: card.active,
      })),
    invoice_payments: [...snapshot.invoicePayments]
      .sort((a, b) => a.id - b.id)
      .map((payment) => ({
        legacy_id: payment.id,
        card_legacy_id: payment.cardId,
        reference_month: monthDate(payment.referenceMonth),
        paid_at: payment.paidAt,
        amount: payment.amount,
      })),
  };
}

export function fromRemoteSnapshot(snapshot: RemoteSnapshot): AppFinancialData {
  return {
    expenses: snapshot.expenses.map((expense) => ({
      id: expense.legacy_id,
      title: expense.title,
      cat: expense.category,
      who: expense.responsible,
      amount: Number(expense.amount),
      date: expense.occurred_on,
      ...(expense.personal_limit_bucket
        ? { personalLimitBucket: expense.personal_limit_bucket }
        : {}),
      ...(expense.credit_card_legacy_id !== null
        ? { creditCardId: expense.credit_card_legacy_id }
        : {}),
    })),
    installments: snapshot.installments.map((installment) => ({
      id: installment.legacy_id,
      title: installment.title,
      category: installment.category,
      who: installment.responsible,
      amount: Number(installment.amount),
      totalInstallments: installment.total_installments,
      paidInstallments: installment.paid_installments,
      nextDue: installment.next_due,
      ...(installment.credit_card_legacy_id !== null
        ? { creditCardId: installment.credit_card_legacy_id }
        : {}),
    })),
    debts: snapshot.receivables.map((debt) => ({
      id: debt.legacy_id,
      person: debt.person,
      amount: Number(debt.amount),
      paid: Number(debt.paid),
      destination: debt.destination,
      note: debt.note,
      month: monthValue(debt.competence_month),
      ...(debt.received_month
        ? { receivedMonth: monthValue(debt.received_month) }
        : {}),
    })),
    incomeEntries: snapshot.income_entries.map((entry) => ({
      id: entry.legacy_id,
      title: entry.title,
      amount: Number(entry.amount),
      who: entry.responsible,
      date: entry.occurred_on,
      destination: entry.destination,
      note: entry.note,
    })),
    income: Number(snapshot.settings.income),
    budgets: snapshot.settings.budgets,
    limits: snapshot.settings.limits,
    personalLimits: snapshot.settings.personal_limits,
    creditCards: snapshot.credit_cards.map((card) => ({
      id: card.legacy_id,
      name: card.name,
      ...(card.issuer ? { issuer: card.issuer } : {}),
      owner: card.owner,
      creditLimit: Number(card.credit_limit),
      closingDay: card.closing_day,
      dueDay: card.due_day,
      ...(card.appearance ? { appearance: card.appearance } : {}),
      active: card.active,
    })),
    invoicePayments: snapshot.invoice_payments.map((payment) => ({
      id: payment.legacy_id,
      cardId: payment.card_legacy_id,
      referenceMonth: monthValue(payment.reference_month),
      paidAt: payment.paid_at,
      amount: Number(payment.amount),
    })),
    activeProfile: snapshot.settings.active_profile,
    viewMonth: monthValue(snapshot.settings.view_month),
  };
}

/**
 * The import RPC owns the only remote write path for local snapshots.  It is
 * intentionally not wired into normal application persistence until the remote
 * migration is reviewed and applied.
 */
export class SupabaseFinancialImportTarget implements FinancialImportTarget {
  constructor(private readonly client: SupabaseClient) {}

  async hasImport(householdId: string, sourceHash: string): Promise<boolean> {
    const result = await this.client
      .from("local_imports")
      .select("id")
      .eq("household_id", householdId)
      .eq("source_hash", sourceHash)
      .maybeSingle();
    if (result.error)
      throw new Error("Não foi possível verificar a migração local.");
    return result.data !== null;
  }

  async importAtomically(
    householdId: string,
    snapshot: AppFinancialData,
    sourceHash: string,
    summary: LocalMigrationPreview["counts"],
  ): Promise<AppFinancialData> {
    const result = await this.client.rpc("import_financial_snapshot", {
      p_household_id: householdId,
      p_source_hash: sourceHash,
      p_snapshot: toRemoteSnapshot(snapshot),
      p_summary: summary,
    });
    if (result.error || !result.data)
      throw new Error("Não foi possível importar os dados financeiros locais.");
    const payload = result.data as RpcImportResult;
    if (!payload.snapshot)
      throw new Error("A importação não retornou um snapshot válido.");
    return fromRemoteSnapshot(payload.snapshot);
  }
}

/**
 * Persists one complete application snapshot through the authenticated,
 * transactional RPC. Runtime revisions are intentionally separate from
 * `local_imports`, which remains the record of an explicit local migration.
 */
export async function replaceSupabaseFinancialSnapshot({
  client,
  householdId,
  snapshot,
  revisionHash,
}: {
  client: SupabaseClient;
  householdId: string;
  snapshot: AppFinancialData;
  revisionHash: string;
}): Promise<AppFinancialData> {
  const result = await client.rpc("replace_financial_snapshot", {
    p_household_id: householdId,
    p_snapshot: toRemoteSnapshot(snapshot),
    p_revision_hash: revisionHash,
  });
  if (result.error || !result.data)
    throw new Error("Não foi possível salvar os dados financeiros remotos.");
  return fromRemoteSnapshot(result.data as RemoteSnapshot);
}
