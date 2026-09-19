import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  FinancialDataSnapshot,
  FinancialDataSource,
  PersistedCreditCard,
  PersistedDebt,
  PersistedExpense,
  PersistedIncomeEntry,
  PersistedInstallment,
  PersistedInvoicePayment,
} from "./FinancialDataSource";

type HouseholdData = { household_id: string };

/**
 * Read-only adapter used by Financial Context. It deliberately owns no financial
 * calculation and uses the authenticated Supabase client, therefore RLS remains
 * the authorization boundary.
 */
export class SupabaseFinancialDataSource implements FinancialDataSource {
  constructor(
    private readonly client: SupabaseClient,
    private readonly householdId: string,
  ) {}

  async read(): Promise<FinancialDataSnapshot> {
    const scope = (table: string) =>
      this.client.from(table).select("*").eq("household_id", this.householdId);
    const [
      settings,
      expenses,
      installments,
      debts,
      incomeEntries,
      cards,
      payments,
    ] = await Promise.all([
      scope("financial_settings").single(),
      scope("expenses"),
      scope("installments"),
      scope("receivables"),
      scope("income_entries"),
      scope("credit_cards"),
      scope("invoice_payments"),
    ]);
    const failed = [
      settings,
      expenses,
      installments,
      debts,
      incomeEntries,
      cards,
      payments,
    ].find((result) => result.error && result.error.code !== "PGRST116");
    if (failed?.error)
      throw new Error("Não foi possível carregar os dados financeiros.");
    const configuration = settings.data ?? {
      income: 0,
      budgets: {},
      limits: {},
      personal_limits: {},
    };
    return {
      income: Number(configuration.income),
      budgets: configuration.budgets,
      limits: configuration.limits,
      personalLimits: configuration.personal_limits,
      expenses: (expenses.data ?? []).map((row: any) => ({
        id: row.legacy_id,
        title: row.title,
        cat: row.category,
        who: row.responsible,
        amount: Number(row.amount),
        date: row.occurred_on,
        ...(row.personal_limit_bucket
          ? { personalLimitBucket: row.personal_limit_bucket }
          : {}),
        ...(row.credit_card_legacy_id
          ? { creditCardId: row.credit_card_legacy_id }
          : {}),
      })) as PersistedExpense[],
      installments: (installments.data ?? []).map((row: any) => ({
        id: row.legacy_id,
        title: row.title,
        category: row.category,
        who: row.responsible,
        amount: Number(row.amount),
        totalInstallments: row.total_installments,
        paidInstallments: row.paid_installments,
        nextDue: row.next_due,
        ...(row.credit_card_legacy_id
          ? { creditCardId: row.credit_card_legacy_id }
          : {}),
      })) as PersistedInstallment[],
      debts: (debts.data ?? []).map((row: any) => ({
        id: row.legacy_id,
        person: row.person,
        amount: Number(row.amount),
        paid: Number(row.paid),
        destination: row.destination,
        note: row.note,
        month: row.competence_month.slice(0, 7),
        ...(row.received_month
          ? { receivedMonth: row.received_month.slice(0, 7) }
          : {}),
      })) as PersistedDebt[],
      incomeEntries: (incomeEntries.data ?? []).map((row: any) => ({
        id: row.legacy_id,
        title: row.title,
        amount: Number(row.amount),
        who: row.responsible,
        date: row.occurred_on,
        destination: row.destination,
        note: row.note,
      })) as PersistedIncomeEntry[],
      creditCards: (cards.data ?? []).map((row: any) => ({
        id: row.legacy_id,
        name: row.name,
        issuer: row.issuer ?? undefined,
        owner: row.owner,
        creditLimit: Number(row.credit_limit),
        closingDay: row.closing_day,
        dueDay: row.due_day,
        appearance: row.appearance ?? undefined,
        active: row.active,
      })) as PersistedCreditCard[],
      invoicePayments: (payments.data ?? []).map((row: any) => ({
        id: row.legacy_id,
        cardId: row.card_legacy_id,
        referenceMonth: row.reference_month.slice(0, 7),
        paidAt: row.paid_at,
        amount: Number(row.amount),
      })) as PersistedInvoicePayment[],
      hasStoredData: true,
    };
  }
}
