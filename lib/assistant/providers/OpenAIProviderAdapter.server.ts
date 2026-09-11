import OpenAI from "openai";
import type {
  ConversationApiRequest,
  ConversationApiResponse,
  ConversationPlan,
  ConversationToolResult,
} from "../conversation/contracts";
import {
  conversationResponseStyleInstructions,
  responseModeInstructions,
} from "../conversation/responseStyle";
import { quickActionInstruction } from "../conversation/quickActions";
import { contextSummary } from "../conversation/conversationContext";
import {
  deduplicateToolCalls,
  isWithinToolBudget,
  toolBudgetUserMessage,
} from "../conversation/toolPlanning";
import type { ConversationProviderAdapter } from "./ConversationProviderAdapter.server";
import type { FinancialToolName } from "../tools/financialTools";
import {
  parseFunctionPlan as parseSharedFunctionPlan,
  profiles,
} from "./ConversationPlanParser";

const toolNames = new Set<FinancialToolName>([
  "getFinancialSummary",
  "getExpenses",
  "getExpenseRanking",
  "getCategorySpending",
  "getAvailableBalance",
  "getLimits",
  "getInstallments",
  "getReceivables",
  "getExtraIncome",
]);

const toolDefinitions = [
  "getFinancialSummary",
  "getExpenses",
  "getExpenseRanking",
  "getCategorySpending",
  "getAvailableBalance",
  "getLimits",
  "getInstallments",
  "getReceivables",
  "getExtraIncome",
].map((name) => ({
  type: "function" as const,
  name,
  description: `Solicita a consulta determinística ${name} no BruMath.`,
  strict: true,
  parameters: {
    type: "object",
    properties: {
      profile: { type: ["string", "null"], enum: [...profiles, null] },
      month: { type: ["string", "null"], description: "YYYY-MM ou null" },
      category: { type: ["string", "null"] },
      dueInSelectedMonth: { type: ["boolean", "null"] },
    },
    required: ["profile", "month", "category", "dueInSelectedMonth"],
    additionalProperties: false,
  },
}));

const actionDefinition = {
  type: "function" as const,
  name: "propose_register_expense",
  description:
    "Propõe registrar um gasto. Nunca confirma nem executa a ação; use somente quando descrição, valor e categoria estiverem claros.",
  strict: true,
  parameters: {
    type: "object",
    properties: {
      description: { type: "string" },
      amount: { type: "number", minimum: 0.01 },
      category: { type: "string" },
      owner: { type: ["string", "null"], enum: [...profiles, null] },
      date: { type: ["string", "null"], description: "YYYY-MM-DD ou null" },
    },
    required: ["description", "amount", "category", "owner", "date"],
    additionalProperties: false,
  },
};

const clarificationDefinition = {
  type: "function" as const,
  name: "clarify_register_expense",
  description:
    "Mantém um cadastro de gasto pendente quando ainda falta descrição ou categoria. Nunca persiste nada.",
  strict: true,
  parameters: {
    type: "object",
    properties: {
      amount: { type: ["number", "null"] },
      description: { type: ["string", "null"] },
      category: { type: ["string", "null"] },
    },
    required: ["amount", "description", "category"],
    additionalProperties: false,
  },
};

const cancelPendingIntentDefinition = {
  type: "function" as const,
  name: "cancel_pending_intent",
  description:
    "Cancela a intenção pendente atual sem executar ou persistir qualquer alteração.",
  strict: true,
  parameters: {
    type: "object",
    properties: {},
    required: [],
    additionalProperties: false,
  },
};

function textPlan(message: string): ConversationPlan {
  return { kind: "message", message };
}

function parseFunctionPlan(
  name: string,
  rawArguments: string,
): ConversationPlan | null {
  let args: unknown;
  try {
    args = JSON.parse(rawArguments);
  } catch {
    return null;
  }
  if (!args || typeof args !== "object" || Array.isArray(args)) return null;
  return parseSharedFunctionPlan(name, args);
}

export async function generateConversationPlan(
  request: ConversationApiRequest,
): Promise<ConversationApiResponse> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return {
      ok: false,
      code: "unavailable",
      message: "O Assistente com IA ainda não está configurado neste ambiente.",
    };
  }

  const model = process.env.OPENAI_MODEL || "gpt-5-mini";
  const requestId = crypto.randomUUID();
  const client = new OpenAI({ apiKey, timeout: 15_000, maxRetries: 1 });
  try {
    const response = await client.responses.create({
      model,
      instructions: [
        "Você interpreta pedidos financeiros em português para o BruMath.",
        "Nunca invente números, saldos, limites, gastos, parcelas ou datas.",
        "Para qualquer dado financeiro, chame exatamente uma tool permitida.",
        "Para insights gerais, planeje no máximo quatro consultas independentes e nunca repita uma tool com o mesmo escopo. Priorize resumo, limites, parcelas e recebíveis; só peça consultas adicionais se forem materialmente necessárias.",
        "O mês financeiro selecionado é o contexto obrigatório para 'este mês', 'nesse mês', 'mês passado' e 'próximo mês'. A data real serve somente para datas de lançamento como hoje, ontem e anteontem.",
        "O perfil e mês informados são defaults; só os sobrescreva quando o usuário for explícito.",
        "Para 'onde gastamos mais', use getExpenseRanking sem categoria. Nunca exija categoria nessa pergunta geral.",
        "Quando houver cadastro de gasto pendente, use clarify_register_expense até completar os campos faltantes ou cancel_pending_intent se a pessoa desistir.",
        "Se descrição, valor ou categoria de um gasto forem ambíguos, responda com uma pergunta curta em vez de propor ação.",
        "Uma proposta de gasto não é uma confirmação e nunca executa nada.",
        "Saldo disponível não é autorização ou limite para gastar. Para 'quanto ainda posso gastar?', consulte getLimits quando o limite aplicável estiver claro; se saldo e limite forem materialmente ambíguos, peça clarificação curta.",
        "Para conversa não financeira, responda de modo curto e útil, sem alegar acesso a dados.",
        conversationResponseStyleInstructions,
      ].join(" "),
      input: [
        `Perfil padrão: ${request.activeProfile}. Mês padrão: ${request.selectedMonth}.`,
        request.temporalContext
          ? `Data atual confiável: ${request.temporalContext.currentDate} (${request.temporalContext.timeZone}). Resolva apenas hoje, ontem e anteontem por essa data; nunca peça ao usuário uma data já determinável.`
          : "",
        contextSummary(request.conversationContext)
          ? `Contexto curto da conversa: ${contextSummary(request.conversationContext)}`
          : "",
        responseModeInstructions(request.responseMode) ?? "",
        quickActionInstruction(request.quickAction) ?? "",
        `Mensagem: ${request.message}`,
      ]
        .filter(Boolean)
        .join(" "),
      tools: [
        ...toolDefinitions,
        actionDefinition,
        clarificationDefinition,
        cancelPendingIntentDefinition,
      ],
    });
    const calls = response.output.filter(
      (item): item is Extract<typeof item, { type: "function_call" }> =>
        item.type === "function_call",
    );
    if (calls.length) {
      const plans = calls.map((call) =>
        parseFunctionPlan(call.name, call.arguments),
      );
      if (plans.some((plan) => !plan)) {
        return {
          ok: false,
          code: "invalid-response",
          message:
            "Não consegui validar a consulta solicitada pelo Assistente.",
        };
      }
      if (
        plans.some((plan) => plan?.kind === "register-expense") &&
        plans.length > 1
      ) {
        return {
          ok: false,
          code: "invalid-response",
          message:
            "Uma proposta de gasto não pode ser combinada com outras ações.",
        };
      }
      const first = plans[0]!;
      if (first.kind === "register-expense") return { ok: true, plan: first };
      if (
        first.kind === "register-expense-clarification" ||
        first.kind === "cancel-pending-intent"
      )
        return { ok: true, plan: first };
      const toolCalls = plans.filter(
        (plan): plan is Extract<typeof plan, { kind: "tool-call" }> =>
          plan?.kind === "tool-call",
      );
      const deduplicated = deduplicateToolCalls(toolCalls, {
        activeProfile: request.activeProfile,
        selectedMonth: request.selectedMonth,
      });
      console.info("assistant_tool_plan_normalized", {
        provider: "openai",
        model,
        rawToolCount: toolCalls.length,
        uniqueToolCount: deduplicated.calls.length,
        duplicatesRemoved: deduplicated.duplicatesRemoved,
      });
      if (!isWithinToolBudget(deduplicated.calls)) {
        return {
          ok: false,
          code: "invalid-response",
          message: toolBudgetUserMessage,
        };
      }
      return deduplicated.calls.length === 1
        ? { ok: true, plan: deduplicated.calls[0] }
        : { ok: true, plan: { kind: "tool-calls", calls: deduplicated.calls } };
    }
    const message = response.output_text.trim();
    return message
      ? { ok: true, plan: textPlan(message) }
      : {
          ok: false,
          code: "invalid-response",
          message:
            "Não recebi uma resposta válida do Assistente. Tente novamente.",
        };
  } catch (error) {
    const apiError = error instanceof OpenAI.APIError ? error : undefined;
    console.error("assistant_provider_failed", {
      requestId,
      model,
      status: apiError?.status,
      code: apiError?.code,
      type: apiError?.type,
    });
    return {
      ok: false,
      code: "provider-failed",
      message:
        "Não foi possível falar com o Assistente agora. Tente novamente em instantes.",
    };
  }
}

/** Preserved alternate provider. It is selected only with AI_PROVIDER=openai. */
export class OpenAIProviderAdapter implements ConversationProviderAdapter {
  generatePlan(
    request: ConversationApiRequest,
  ): Promise<ConversationApiResponse> {
    return generateConversationPlan(request);
  }

  async generateExplanation(
    request: ConversationApiRequest,
    toolResults: readonly ConversationToolResult[],
  ): Promise<ConversationApiResponse> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return {
        ok: false,
        code: "unavailable",
        message:
          "O Assistente com IA ainda não está configurado neste ambiente.",
      };
    }
    const model = process.env.OPENAI_MODEL || "gpt-5-mini";
    try {
      const client = new OpenAI({ apiKey, timeout: 15_000, maxRetries: 1 });
      const response = await client.responses.create({
        model,
        instructions: [
          "Responda com base exclusivamente nos resultados financeiros determinísticos fornecidos. Não invente números e diferencie recomendações de fatos.",
          conversationResponseStyleInstructions,
        ].join(" "),
        input: [
          `Perfil: ${request.activeProfile}. Mês: ${request.selectedMonth}. Pergunta: ${request.message}`,
          responseModeInstructions(request.responseMode) ?? "",
          `Resultados autorizados: ${JSON.stringify(toolResults)}`,
        ]
          .filter(Boolean)
          .join("\n"),
      });
      const message = response.output_text.trim();
      return message
        ? { ok: true, plan: textPlan(message) }
        : {
            ok: false,
            code: "invalid-response",
            message:
              "Não recebi uma análise válida do Assistente. Tente novamente.",
          };
    } catch (error) {
      const apiError = error instanceof OpenAI.APIError ? error : undefined;
      console.error("assistant_provider_failed", {
        provider: "openai",
        model,
        status: apiError?.status,
        code: apiError?.code,
        type: apiError?.type,
      });
      return {
        ok: false,
        code: "provider-failed",
        message:
          "Não foi possível falar com o Assistente agora. Tente novamente em instantes.",
      };
    }
  }
}
