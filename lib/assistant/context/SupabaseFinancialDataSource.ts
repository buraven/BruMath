import type { SupabaseClient } from "@supabase/supabase-js";
import type { AppFinancialData } from "../../app/AppTypes";
import { replaceSupabaseFinancialSnapshot } from "../../persistence/SupabaseFinancialImportTarget";
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
      adjustments,
      installmentEvents,
      reimbursementAllocations,
      categories,
    ] = await Promise.all([
      scope("financial_settings").single(),
      scope("expenses"),
      scope("installments"),
      scope("receivables"),
      scope("income_entries"),
      scope("credit_cards"),
      scope("invoice_payments"),
      scope("invoice_adjustments"),
      scope("installment_invoice_events"),
      scope("installment_reimbursement_allocations"),
      scope("financial_categories"),
    ]);
    const failed = [
      settings,
      expenses,
      installments,
      debts,
      incomeEntries,
      cards,
      payments,
      adjustments,
      installmentEvents,
      reimbursementAllocations,
      categories,
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
      categories: (categories.data ?? []).map((row: any) => ({
        id: row.legacy_id,
        name: row.name,
        ...(row.icon ? { icon: row.icon } : {}),
        active: row.active,
        sortOrder: row.sort_order,
      })),
      income: Number(configuration.income),
      budgets: configuration.budgets,
      categoryBudgets: configuration.category_budgets ?? {},
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
        ...(row.invoice_reference_month
          ? { invoiceReferenceMonth: row.invoice_reference_month.slice(0, 7) }
          : {}),
        ...(row.category_legacy_id
          ? { categoryId: row.category_legacy_id }
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
        ...(row.category_legacy_id
          ? { categoryId: row.category_legacy_id }
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
      invoiceAdjustments: (adjustments.data ?? []).map((row: any) => ({
        id: row.legacy_id,
        cardId: row.card_legacy_id,
        referenceMonth: row.reference_month.slice(0, 7),
        type: row.adjustment_type,
        amount: Number(row.amount),
        description: row.description,
        ...(row.occurred_on ? { date: row.occurred_on } : {}),
      })),
      installmentInvoiceEvents: (installmentEvents.data ?? []).map(
        (row: any) => ({
          id: row.legacy_id,
          installmentId: row.installment_legacy_id,
          cardId: row.card_legacy_id,
          referenceMonth: row.reference_month.slice(0, 7),
          installmentNumber: row.installment_number,
          amount: Number(row.amount),
          type: row.event_type,
          ...(row.occurred_on ? { date: row.occurred_on } : {}),
        }),
      ),
      installmentReimbursementAllocations: (
        reimbursementAllocations.data ?? []
      ).map((row: any) => ({
        id: row.legacy_id,
        installmentId: row.installment_legacy_id,
        person: row.person,
        installmentNumber: row.installment_number,
        amount: Number(row.amount),
        expectedMonth: row.expected_month.slice(0, 7),
        status: row.status,
        ...(row.debt_legacy_id ? { debtId: row.debt_legacy_id } : {}),
      })),
      activeProfile: configuration.active_profile,
      viewMonth: configuration.view_month.slice(0, 7),
      hasStoredData: true,
    };
  }

  async write(
    snapshot: AppFinancialData,
    revisionHash: string,
  ): Promise<AppFinancialData> {
    return replaceSupabaseFinancialSnapshot({
      client: this.client,
      householdId: this.householdId,
      snapshot,
      revisionHash,
    });
  }
}
