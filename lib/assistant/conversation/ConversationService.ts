import { createFinancialContextProvider } from "../context/createFinancialContextProvider";
import { LocalStorageFinancialDataSource } from "../context/LocalStorageFinancialDataSource";
import type { AssistantProfile } from "../contracts";
import {
  createFinancialToolRegistry,
  type FinancialToolName,
} from "../tools/financialTools";
import type {
  ConversationApiResponse,
  ConversationPlan,
  ConversationToolResult,
} from "./contracts";
import { createTemporalContext } from "./temporalContext";

const toolNames = new Set<FinancialToolName>([
  "getFinancialSummary",
  "getExpenses",
  "getCategorySpending",
  "getAvailableBalance",
  "getLimits",
  "getInstallments",
  "getReceivables",
  "getExtraIncome",
]);

function isProfile(value: unknown): value is AssistantProfile {
  return value === "Bruna" || value === "Matheus" || value === "Casal";
}

function isMonth(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}$/.test(value);
}

function asCurrency(value: number): string {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function formatToolResult(name: FinancialToolName, value: unknown): string {
  if (!value || typeof value !== "object") {
    return "Não encontrei dados suficientes para responder com segurança.";
  }
  const data = (value as { data?: unknown }).data;
  if (name === "getFinancialSummary" && data && typeof data === "object") {
    const summary = data as Record<string, unknown>;
    return `Renda base: ${asCurrency(Number(summary.baseIncome) || 0)}. Entradas extras: ${asCurrency(Number(summary.extraIncome) || 0)}. Gastos: ${asCurrency(Number(summary.expenses) || 0)}. Saldo disponível: ${asCurrency(Number(summary.available) || 0)}.`;
  }
  if (name === "getAvailableBalance" && data && typeof data === "object") {
    return `O saldo disponível é ${asCurrency(Number((data as { available?: number }).available) || 0)}.`;
  }
  if (name === "getCategorySpending" && data && typeof data === "object") {
    const spending = data as { category?: string; total?: number };
    return `Em ${spending.category ?? "essa categoria"}, os gastos somam ${asCurrency(Number(spending.total) || 0)}.`;
  }
  if (Array.isArray(data)) {
    const labels: Record<string, string> = {
      getExpenses: "gasto(s)",
      getLimits: "limite(s)",
      getInstallments: "parcelamento(s) ativo(s)",
      getReceivables: "valor(es) a receber",
    };
    return `Encontrei ${data.length} ${labels[name] ?? "registro(s)"} no contexto consultado.`;
  }
  if (name === "getExtraIncome" && data && typeof data === "object") {
    return `As entradas extras no período somam ${asCurrency(Number((data as { total?: number }).total) || 0)}.`;
  }
  return "Consulta concluída com dados financeiros determinísticos.";
}

export async function requestConversationPlan(request: {
  message: string;
  activeProfile: AssistantProfile;
  selectedMonth: string;
  toolResults?: readonly ConversationToolResult[];
  requestId?: string;
  responseMode?: "compact" | "full";
  quickAction?:
    | "financial-summary"
    | "insights"
    | "installments"
    | "receivables"
    | "incoming-summary";
  conversationContext?: { summary: string };
}): Promise<ConversationApiResponse> {
  const startedAt = performance.now();
  const response = await fetch("/api/assistant", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...request,
      temporalContext: createTemporalContext(),
    }),
  });
  console.info("assistant_client_provider_round", {
    requestId: request.requestId,
    phase: request.toolResults?.length ? "explanation" : "planning",
    durationMs: Math.round(performance.now() - startedAt),
    serverTiming: response.headers.get("Server-Timing"),
  });
  const body = (await response.json()) as ConversationApiResponse;
  if (!response.ok || !body.ok) {
    return body.ok
      ? {
          ok: false,
          code: "provider-failed",
          message: "Não foi possível responder agora.",
        }
      : body;
  }
  return body;
}

export async function resolveConversationPlan(
  plan: ConversationPlan,
  defaults: { activeProfile: AssistantProfile; selectedMonth: string },
): Promise<
  | { kind: "message"; message: string }
  | { kind: "tool-results"; results: readonly ConversationToolResult[] }
  | ConversationPlan
> {
  if (plan.kind !== "tool-call" && plan.kind !== "tool-calls") return plan;
  const calls = plan.kind === "tool-call" ? [plan] : plan.calls;
  if (calls.some((call) => !toolNames.has(call.toolName))) {
    return {
      kind: "message",
      message: "Não reconheci essa consulta financeira.",
    };
  }
  const registry = createFinancialToolRegistry();
  const financialContext = createFinancialContextProvider(
    new LocalStorageFinancialDataSource(),
  );
  const toolsStartedAt = performance.now();
  const results = await Promise.all(
    calls.map(async (call) => {
      const toolStartedAt = performance.now();
      const profile = isProfile(call.input.profile)
        ? call.input.profile
        : defaults.activeProfile;
      const month = isMonth(call.input.month)
        ? call.input.month
        : defaults.selectedMonth;
      const category =
        typeof call.input.category === "string" && call.input.category.trim()
          ? call.input.category.trim()
          : undefined;
      const result = await registry.require(call.toolName).execute(
        {
          ...(category ? { category } : {}),
          ...(typeof call.input.dueInSelectedMonth === "boolean"
            ? { dueInSelectedMonth: call.input.dueInSelectedMonth }
            : {}),
        },
        {
          scope: { profile, month, ...(category ? { category } : {}) },
          financialContext,
        },
      );
      console.info("assistant_tool_completed", {
        toolName: call.toolName,
        durationMs: Math.round(performance.now() - toolStartedAt),
      });
      return result;
    }),
  );
  console.info("assistant_tools_completed", {
    toolCount: calls.length,
    durationMs: Math.round(performance.now() - toolsStartedAt),
  });
  const failure = results.find((result) => !result.ok);
  if (failure && !failure.ok)
    return { kind: "message", message: failure.message };
  return {
    kind: "tool-results",
    results: results.map(
      (result) => (result as { ok: true; value: ConversationToolResult }).value,
    ),
  };
}
