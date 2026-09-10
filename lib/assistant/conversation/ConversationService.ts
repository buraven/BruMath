import { createFinancialContextProvider } from "../context/createFinancialContextProvider";
import { LocalStorageFinancialDataSource } from "../context/LocalStorageFinancialDataSource";
import type { AssistantProfile } from "../contracts";
import {
  createFinancialToolRegistry,
  type FinancialToolName,
} from "../tools/financialTools";
import type { ConversationApiResponse, ConversationPlan } from "./contracts";

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
}): Promise<ConversationApiResponse> {
  const response = await fetch("/api/assistant", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
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
): Promise<{ kind: "message"; message: string } | ConversationPlan> {
  if (plan.kind !== "tool-call") return plan;
  if (!toolNames.has(plan.toolName)) {
    return {
      kind: "message",
      message: "Não reconheci essa consulta financeira.",
    };
  }

  const profile = isProfile(plan.input.profile)
    ? plan.input.profile
    : defaults.activeProfile;
  const month = isMonth(plan.input.month)
    ? plan.input.month
    : defaults.selectedMonth;
  const category =
    typeof plan.input.category === "string" && plan.input.category.trim()
      ? plan.input.category.trim()
      : undefined;
  const registry = createFinancialToolRegistry();
  const tool = registry.require(plan.toolName);
  const result = await tool.execute(
    {
      ...(category ? { category } : {}),
      ...(typeof plan.input.dueInSelectedMonth === "boolean"
        ? { dueInSelectedMonth: plan.input.dueInSelectedMonth }
        : {}),
    },
    {
      scope: { profile, month, ...(category ? { category } : {}) },
      financialContext: createFinancialContextProvider(
        new LocalStorageFinancialDataSource(),
      ),
    },
  );
  if (!result.ok) return { kind: "message", message: result.message };
  return {
    kind: "message",
    message: formatToolResult(plan.toolName, result.value),
  };
}
