import type { SupabaseClient } from "@supabase/supabase-js";
import type { AppFinancialData, Category } from "../app/AppTypes";
import type {
  FinancialImportTarget,
  LocalMigrationPreview,
} from "./LocalSnapshotMigration";

export type RemoteSnapshot = {
  categories?: Array<{
    legacy_id: string;
    name: string;
    icon: string | null;
    active: boolean;
    sort_order: number;
  }>;
  settings: {
    income: number;
    budgets: AppFinancialData["budgets"];
    category_budgets?: Record<string, number>;
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
    invoice_reference_month?: string | null;
    category_legacy_id?: string | null;
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
    category_legacy_id?: string | null;
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
  invoice_adjustments?: Array<{
    legacy_id: number;
    card_legacy_id: number;
    reference_month: string;
    adjustment_type: NonNullable<
      AppFinancialData["invoiceAdjustments"]
    >[number]["type"];
    amount: number;
    description: string;
    occurred_on: string | null;
  }>;
  installment_invoice_events?: Array<{
    legacy_id: number;
    installment_legacy_id: number;
    card_legacy_id: number;
    reference_month: string;
    installment_number: number;
    amount: number;
    event_type: NonNullable<
      AppFinancialData["installmentInvoiceEvents"]
    >[number]["type"];
    occurred_on: string | null;
  }>;
  installment_reimbursement_allocations?: Array<{
    legacy_id: number;
    installment_legacy_id: number;
    person: string;
    installment_number: number;
    amount: number;
    expected_month: string;
    status: NonNullable<
      AppFinancialData["installmentReimbursementAllocations"]
    >[number]["status"];
    debt_legacy_id: number | null;
  }>;
};

type RpcImportResult = { imported: boolean; snapshot: RemoteSnapshot };

type SafeRpcError = {
  code?: unknown;
  message?: unknown;
  details?: unknown;
  hint?: unknown;
  status?: unknown;
};

export type RemotePersistenceDiagnostic = {
  stage: "replace_financial_snapshot_v4" | "remote_snapshot_reconciliation";
  function: string;
  rpcStarted: boolean;
  rpcResponded: boolean;
  code?: string;
  message: string;
  details?: string;
  hint?: string;
  status?: number;
};

const sanitizeDiagnosticText = (value: unknown) => {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim().slice(0, 500);
  if (!normalized) return undefined;
  if (/[{}\[\]]/.test(normalized)) return "Detalhe estruturado omitido.";
  return normalized
    .replace(/\bBearer\s+\S+/gi, "Bearer [redigido]")
    .replace(/\beyJ[\w-]+\.[\w-]+\.[\w-]+\b/g, "[token redigido]")
    .replace(/\b(?:sbp|sb_secret|service_role)[\w-]*\b/gi, "[segredo redigido]")
    .replace(/\b[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}\b/g, "[e-mail redigido]")
    .replace(/\([^)]*=\s*[^)]*\)/g, "(valor redigido)")
    .replace(/R\$\s*[\d.,]+/g, "R$ [valor redigido]");
};

export class SupabaseSnapshotWriteError extends Error {
  readonly diagnostic: RemotePersistenceDiagnostic;

  constructor(
    error: SafeRpcError | undefined,
    {
      rpcStarted,
      rpcResponded,
    }: Pick<RemotePersistenceDiagnostic, "rpcStarted" | "rpcResponded">,
  ) {
    const message =
      sanitizeDiagnosticText(error?.message) ??
      (rpcResponded
        ? "A RPC não retornou dados."
        : "A RPC não retornou resposta.");
    super(message);
    this.name = "SupabaseSnapshotWriteError";
    this.diagnostic = {
      stage: "replace_financial_snapshot_v4",
      function: "replaceSupabaseFinancialSnapshot",
      rpcStarted,
      rpcResponded,
      ...(typeof error?.code === "string" ? { code: error.code } : {}),
      message,
      ...(sanitizeDiagnosticText(error?.details)
        ? { details: sanitizeDiagnosticText(error?.details) }
        : {}),
      ...(sanitizeDiagnosticText(error?.hint)
        ? { hint: sanitizeDiagnosticText(error?.hint) }
        : {}),
      ...(typeof error?.status === "number" ? { status: error.status } : {}),
    };
  }
}

/** Returns only structured, redacted error metadata — never a snapshot or auth. */
export function remotePersistenceDiagnostic(
  error: unknown,
): RemotePersistenceDiagnostic {
  if (error instanceof SupabaseSnapshotWriteError) return error.diagnostic;
  return {
    stage: "remote_snapshot_reconciliation",
    function: "RemoteSnapshotWriteQueue.enqueue",
    rpcStarted: false,
    rpcResponded: false,
    message:
      sanitizeDiagnosticText(
        error instanceof Error ? error.message : undefined,
      ) ?? "A persistência remota falhou antes de retornar um diagnóstico.",
  };
}

/** Contains only PostgREST error metadata; never includes the snapshot or auth. */
export class SupabaseImportRpcError extends Error {
  readonly rpcStarted = true;
  readonly rpcResponded: boolean;
  readonly code?: string;
  readonly details?: string;
  readonly hint?: string;
  readonly status?: number;

  constructor(error: SafeRpcError | undefined, rpcResponded: boolean) {
    const message =
      typeof error?.message === "string"
        ? error.message
        : rpcResponded
          ? "A RPC não retornou dados."
          : "A RPC não retornou resposta.";
    super(message);
    this.name = "SupabaseImportRpcError";
    this.rpcResponded = rpcResponded;
    this.code = typeof error?.code === "string" ? error.code : undefined;
    this.details =
      typeof error?.details === "string" ? error.details : undefined;
    this.hint = typeof error?.hint === "string" ? error.hint : undefined;
    this.status = typeof error?.status === "number" ? error.status : undefined;
  }

  diagnostic() {
    return {
      stage: "import_financial_snapshot_v4",
      function: "SupabaseFinancialImportTarget.importAtomically",
      rpcStarted: this.rpcStarted,
      rpcResponded: this.rpcResponded,
      ...(this.code ? { code: this.code } : {}),
      message: this.message,
      ...(this.details ? { details: this.details } : {}),
      ...(this.hint ? { hint: this.hint } : {}),
      ...(this.status ? { status: this.status } : {}),
    };
  }
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const monthDate = (month: string, field = "competência") => {
  assert(/^\d{4}-\d{2}$/.test(month), `${field} deve usar o formato YYYY-MM.`);
  return `${month}-01`;
};

const civilDate = (date: string, field: string) => {
  assert(
    /^\d{4}-\d{2}-\d{2}$/.test(date),
    `${field} deve usar o formato YYYY-MM-DD.`,
  );
  return date;
};
const monthValue = (date: string) => date.slice(0, 7);

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

export function toRemoteSnapshot(snapshot: AppFinancialData): RemoteSnapshot {
  return {
    ...(snapshot.categories
      ? {
          categories: [...snapshot.categories]
            .sort(
              (a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id),
            )
            .map((category) => ({
              legacy_id: category.id,
              name: category.name,
              icon: category.icon ?? null,
              active: category.active,
              sort_order: category.sortOrder,
            })),
        }
      : {}),
    settings: {
      income: snapshot.income,
      budgets: snapshot.budgets,
      category_budgets: snapshot.categoryBudgets ?? {},
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
        occurred_on: civilDate(expense.date, `Despesa ${expense.id}.date`),
        personal_limit_bucket: expense.personalLimitBucket ?? null,
        credit_card_legacy_id: expense.creditCardId ?? null,
        invoice_reference_month: expense.invoiceReferenceMonth
          ? monthDate(expense.invoiceReferenceMonth)
          : null,
        ...(expense.categoryId
          ? { category_legacy_id: expense.categoryId }
          : {}),
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
        next_due: civilDate(
          installment.nextDue,
          `Parcela ${installment.id}.nextDue`,
        ),
        credit_card_legacy_id: installment.creditCardId ?? null,
        ...(installment.categoryId
          ? { category_legacy_id: installment.categoryId }
          : {}),
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
        paid_at: civilDate(payment.paidAt, `Pagamento ${payment.id}.paidAt`),
        amount: payment.amount,
      })),
    invoice_adjustments: [...(snapshot.invoiceAdjustments ?? [])]
      .sort((a, b) => a.id - b.id)
      .map((adjustment) => ({
        legacy_id: adjustment.id,
        card_legacy_id: adjustment.cardId,
        reference_month: monthDate(adjustment.referenceMonth),
        adjustment_type: adjustment.type,
        amount: adjustment.amount,
        description: adjustment.description,
        occurred_on: adjustment.date
          ? civilDate(adjustment.date, `Ajuste ${adjustment.id}.date`)
          : null,
      })),
    installment_invoice_events: [...(snapshot.installmentInvoiceEvents ?? [])]
      .sort((a, b) => a.id - b.id)
      .map((event) => ({
        legacy_id: event.id,
        installment_legacy_id: event.installmentId,
        card_legacy_id: event.cardId,
        reference_month: monthDate(event.referenceMonth),
        installment_number: event.installmentNumber,
        amount: event.amount,
        event_type: event.type,
        occurred_on: event.date
          ? civilDate(event.date, `Evento ${event.id}.date`)
          : null,
      })),
    installment_reimbursement_allocations: [
      ...(snapshot.installmentReimbursementAllocations ?? []),
    ]
      .sort((a, b) => a.id - b.id)
      .map((allocation) => ({
        legacy_id: allocation.id,
        installment_legacy_id: allocation.installmentId,
        person: allocation.person,
        installment_number: allocation.installmentNumber,
        amount: allocation.amount,
        expected_month: monthDate(allocation.expectedMonth),
        status: allocation.status,
        debt_legacy_id: allocation.debtId ?? null,
      })),
  };
}

/**
 * Canonical identity of the financial state persisted by Supabase. It accepts
 * harmless React/JSON round-trip differences (optional fields, object order,
 * month serialization) while retaining every stored financial value.
 */
export function normalizePersistedFinancialSnapshot(
  snapshot: AppFinancialData,
) {
  return stableJson(toRemoteSnapshot(snapshot));
}

/**
 * The original import RPC owns the legacy collections only. This projection is
 * intentionally identical to the v2 SQL boundary: additive history fields are
 * absent while every legacy financial value remains available for its guardrail.
 */
export function toLegacyImportSnapshot(
  snapshot: RemoteSnapshot,
): RemoteSnapshot {
  const {
    invoice_adjustments: _invoiceAdjustments,
    installment_invoice_events: _installmentInvoiceEvents,
    installment_reimbursement_allocations: _installmentReimbursementAllocations,
    ...legacy
  } = snapshot;
  return {
    ...legacy,
    expenses: snapshot.expenses.map(
      ({ invoice_reference_month: _invoiceReferenceMonth, ...expense }) =>
        expense,
    ),
  };
}

/**
 * Mirrors the v2 RPC's legacy projection followed by its additive overlay.
 * It is used before an import so the browser cannot approve a source snapshot
 * that the server-side reconciliation contract would reject structurally.
 */
export function simulateImportV2RoundTrip(
  snapshot: AppFinancialData,
): AppFinancialData {
  const source = toRemoteSnapshot(snapshot);
  const legacy = toLegacyImportSnapshot(source);
  const persisted: RemoteSnapshot = {
    ...legacy,
    expenses: source.expenses,
    invoice_adjustments: source.invoice_adjustments ?? [],
    installment_invoice_events: source.installment_invoice_events ?? [],
    installment_reimbursement_allocations:
      source.installment_reimbursement_allocations ?? [],
  };
  return fromRemoteSnapshot(persisted);
}

export function fromRemoteSnapshot(snapshot: RemoteSnapshot): AppFinancialData {
  return {
    ...(snapshot.categories
      ? {
          categories: snapshot.categories.map(
            (category): Category => ({
              id: category.legacy_id,
              name: category.name,
              ...(category.icon ? { icon: category.icon } : {}),
              active: category.active,
              sortOrder: category.sort_order,
            }),
          ),
        }
      : {}),
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
      ...(expense.invoice_reference_month
        ? { invoiceReferenceMonth: monthValue(expense.invoice_reference_month) }
        : {}),
      ...(expense.category_legacy_id
        ? { categoryId: expense.category_legacy_id }
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
      ...(installment.category_legacy_id
        ? { categoryId: installment.category_legacy_id }
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
    ...(snapshot.settings.category_budgets &&
    Object.keys(snapshot.settings.category_budgets).length
      ? { categoryBudgets: snapshot.settings.category_budgets }
      : {}),
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
    invoiceAdjustments: (snapshot.invoice_adjustments ?? []).map(
      (adjustment) => ({
        id: adjustment.legacy_id,
        cardId: adjustment.card_legacy_id,
        referenceMonth: monthValue(adjustment.reference_month),
        type: adjustment.adjustment_type,
        amount: Number(adjustment.amount),
        description: adjustment.description,
        ...(adjustment.occurred_on ? { date: adjustment.occurred_on } : {}),
      }),
    ),
    installmentInvoiceEvents: (snapshot.installment_invoice_events ?? []).map(
      (event) => ({
        id: event.legacy_id,
        installmentId: event.installment_legacy_id,
        cardId: event.card_legacy_id,
        referenceMonth: monthValue(event.reference_month),
        installmentNumber: event.installment_number,
        amount: Number(event.amount),
        type: event.event_type,
        ...(event.occurred_on ? { date: event.occurred_on } : {}),
      }),
    ),
    installmentReimbursementAllocations: (
      snapshot.installment_reimbursement_allocations ?? []
    ).map((allocation) => ({
      id: allocation.legacy_id,
      installmentId: allocation.installment_legacy_id,
      person: allocation.person,
      installmentNumber: allocation.installment_number,
      amount: Number(allocation.amount),
      expectedMonth: monthValue(allocation.expected_month),
      status: allocation.status,
      ...(allocation.debt_legacy_id !== null
        ? { debtId: allocation.debt_legacy_id }
        : {}),
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
    const arguments_ = {
      p_household_id: householdId,
      p_source_hash: sourceHash,
      p_snapshot: toRemoteSnapshot(snapshot),
      p_summary: summary,
    };
    let result: Awaited<ReturnType<SupabaseClient["rpc"]>>;
    try {
      result = await this.client.rpc(
        "import_financial_snapshot_v4",
        arguments_,
      );
    } catch (error) {
      throw new SupabaseImportRpcError(
        error && typeof error === "object"
          ? (error as SafeRpcError)
          : undefined,
        false,
      );
    }
    if (result.error || !result.data)
      throw new SupabaseImportRpcError(
        result.error as SafeRpcError | undefined,
        true,
      );
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
  let remoteSnapshot: RemoteSnapshot;
  try {
    remoteSnapshot = toRemoteSnapshot(snapshot);
  } catch (error) {
    throw new SupabaseSnapshotWriteError(
      error && typeof error === "object" ? (error as SafeRpcError) : undefined,
      { rpcStarted: false, rpcResponded: false },
    );
  }
  let result: Awaited<ReturnType<SupabaseClient["rpc"]>>;
  try {
    result = await client.rpc("replace_financial_snapshot_v4", {
      p_household_id: householdId,
      p_snapshot: remoteSnapshot,
      p_revision_hash: revisionHash,
    });
  } catch (error) {
    throw new SupabaseSnapshotWriteError(
      error && typeof error === "object" ? (error as SafeRpcError) : undefined,
      { rpcStarted: true, rpcResponded: false },
    );
  }
  if (result.error || !result.data)
    throw new SupabaseSnapshotWriteError(
      result.error as SafeRpcError | undefined,
      { rpcStarted: true, rpcResponded: true },
    );
  return fromRemoteSnapshot(result.data as RemoteSnapshot);
}
