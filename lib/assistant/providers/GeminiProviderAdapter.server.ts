import {
  GoogleGenAI,
  ThinkingLevel,
  type FunctionDeclaration,
} from "@google/genai";
import type {
  ConversationApiRequest,
  ConversationApiResponse,
  ConversationToolResult,
} from "../conversation/contracts";
import {
  financialToolNames,
  parseFunctionPlan,
  profiles,
} from "./ConversationPlanParser";
import type { ConversationProviderAdapter } from "./ConversationProviderAdapter.server";

const toolParameters = {
  type: "object",
  properties: {
    profile: { type: "string", enum: [...profiles] },
    month: { type: "string", description: "YYYY-MM" },
    category: { type: "string" },
    dueInSelectedMonth: { type: "boolean" },
  },
};

const tools: FunctionDeclaration[] = [
  ...financialToolNames.map((name) => ({
    name,
    description:
      name === "getCategorySpending"
        ? "Soma gastos de uma categoria específica. Só use quando o usuário informar claramente a categoria; category é obrigatória."
        : `Consulta determinística ${name} no BruMath.`,
    parametersJsonSchema:
      name === "getCategorySpending"
        ? { ...toolParameters, required: ["category"] }
        : toolParameters,
  })),
  {
    name: "propose_register_expense",
    description:
      "Propõe registrar um gasto. Nunca confirma nem executa essa ação; use apenas quando descrição, valor e categoria estiverem claros.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        description: { type: "string" },
        amount: { type: "number", minimum: 0.01 },
        category: { type: "string" },
        owner: { type: "string", enum: [...profiles] },
        date: { type: "string", description: "YYYY-MM-DD" },
      },
      required: ["description", "amount", "category"],
    },
  },
];

const instructions = [
  "Você é o Assistente financeiro do BruMath e conversa em português do Brasil.",
  "Nunca invente valores, saldos, limites, gastos, parcelas, recebíveis ou datas.",
  "Para fatos financeiros, solicite somente as funções declaradas.",
  "Nunca use getCategorySpending para insights, resumos ou perguntas gerais sem uma categoria explícita; nesses casos escolha uma consulta geral apropriada.",
  "Se availability.hasStoredData for false ou availability.hasRecordsInScope for false, há dados incompletos: diga apenas que não existem registros cadastrados no contexto consultado. NUNCA afirme que o saldo todo está disponível/livre, que não existem despesas reais, nem recomende destinar todo o saldo; explique que compromissos não cadastrados podem existir.",
  "O perfil e mês informados são defaults; sobrescreva-os apenas se o usuário for explícito.",
  "Para insights solicitados, peça os dados determinísticos estritamente necessários antes de analisar.",
  "Uma proposta de gasto nunca confirma nem executa uma ação.",
  "Se faltar descrição, valor ou categoria para registrar gasto, peça esclarecimento curto.",
].join(" ");

const generationConfig = {
  // Gemini 3.6 Flash defaults to medium thinking. The conversational path is
  // latency-sensitive; deterministic tools still provide financial facts.
  thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL },
} as const;

function unavailable(message: string): ConversationApiResponse {
  return { ok: false, code: "unavailable", message };
}

function providerFailure(): ConversationApiResponse {
  return {
    ok: false,
    code: "provider-failed",
    message:
      "Não foi possível falar com o Assistente agora. Tente novamente em instantes.",
  };
}

function safeProviderMessage(error: unknown): string | undefined {
  if (!(error instanceof Error)) return undefined;
  return error.message.replace(/AIza[\w-]{20,}/g, "[redacted]").slice(0, 400);
}

export class GeminiProviderAdapter implements ConversationProviderAdapter {
  private readonly apiKey = process.env.GEMINI_API_KEY;
  private readonly model = process.env.GEMINI_MODEL || "gemini-3.6-flash";

  private client(): GoogleGenAI | null {
    return this.apiKey
      ? new GoogleGenAI({
          apiKey: this.apiKey,
          httpOptions: {
            timeout: 15_000,
            // The SDK defaults to five attempts; one makes latency predictable.
            retryOptions: { attempts: 1 },
          },
        })
      : null;
  }

  async generatePlan(
    request: ConversationApiRequest,
  ): Promise<ConversationApiResponse> {
    const client = this.client();
    if (!client)
      return unavailable(
        "O Assistente com IA ainda não está configurado neste ambiente.",
      );
    const requestId = request.requestId ?? crypto.randomUUID();
    const startedAt = performance.now();
    console.info("assistant_provider_call_start", {
      requestId,
      provider: "gemini",
      phase: "planning",
      model: this.model,
      configuredRetries: 0,
      thinkingLevel: generationConfig.thinkingConfig.thinkingLevel,
    });
    try {
      const response = await client.models.generateContent({
        model: this.model,
        contents: `Perfil padrão: ${request.activeProfile}. Mês padrão: ${request.selectedMonth}. Mensagem: ${request.message}`,
        config: {
          systemInstruction: instructions,
          tools: [{ functionDeclarations: tools }],
          ...generationConfig,
        },
      });
      const calls = response.functionCalls ?? [];
      console.info("assistant_provider_call_end", {
        requestId,
        provider: "gemini",
        phase: "planning",
        model: this.model,
        durationMs: Math.round(performance.now() - startedAt),
        functionCallCount: calls.length,
        thinkingLevel: generationConfig.thinkingConfig.thinkingLevel,
      });
      if (calls.length) {
        if (calls.length > 5) {
          return {
            ok: false,
            code: "invalid-response",
            message:
              "O Assistente solicitou consultas demais para esta resposta.",
          };
        }
        const plans = calls.map((call) =>
          call.name ? parseFunctionPlan(call.name, call.args) : null,
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
        const toolCalls = plans.filter(
          (plan): plan is Extract<typeof plan, { kind: "tool-call" }> =>
            plan?.kind === "tool-call",
        );
        return toolCalls.length === 1
          ? { ok: true, plan: toolCalls[0] }
          : { ok: true, plan: { kind: "tool-calls", calls: toolCalls } };
      }
      const message = response.text?.trim();
      return message
        ? { ok: true, plan: { kind: "message", message } }
        : {
            ok: false,
            code: "invalid-response",
            message:
              "Não recebi uma resposta válida do Assistente. Tente novamente.",
          };
    } catch (error) {
      const candidate = error as {
        status?: number;
        code?: string;
        name?: string;
      };
      console.error("assistant_provider_failed", {
        requestId,
        provider: "gemini",
        model: this.model,
        status: candidate?.status,
        code: candidate?.code,
        type: candidate?.name,
        message: safeProviderMessage(error),
        durationMs: Math.round(performance.now() - startedAt),
        configuredRetries: 0,
        thinkingLevel: generationConfig.thinkingConfig.thinkingLevel,
      });
      return providerFailure();
    }
  }

  async generateExplanation(
    request: ConversationApiRequest,
    toolResults: readonly ConversationToolResult[],
  ): Promise<ConversationApiResponse> {
    const client = this.client();
    if (!client)
      return unavailable(
        "O Assistente com IA ainda não está configurado neste ambiente.",
      );
    const requestId = request.requestId ?? crypto.randomUUID();
    const startedAt = performance.now();
    console.info("assistant_provider_call_start", {
      requestId,
      provider: "gemini",
      phase: "explanation",
      model: this.model,
      configuredRetries: 0,
      toolResultCount: toolResults.length,
      thinkingLevel: generationConfig.thinkingConfig.thinkingLevel,
    });
    try {
      const response = await client.models.generateContent({
        model: this.model,
        contents: [
          "Responda à mensagem a seguir com base exclusivamente nos resultados determinísticos fornecidos.",
          "Diferencie análise/recomendação de fatos. Não invente números. Seja útil e conciso.",
          `Perfil: ${request.activeProfile}. Mês: ${request.selectedMonth}. Pergunta: ${request.message}`,
          `Resultados autorizados: ${JSON.stringify(toolResults)}`,
        ].join("\n"),
        config: { systemInstruction: instructions, ...generationConfig },
      });
      const message = response.text?.trim();
      console.info("assistant_provider_call_end", {
        requestId,
        provider: "gemini",
        phase: "explanation",
        model: this.model,
        durationMs: Math.round(performance.now() - startedAt),
        thinkingLevel: generationConfig.thinkingConfig.thinkingLevel,
      });
      return message
        ? { ok: true, plan: { kind: "message", message } }
        : {
            ok: false,
            code: "invalid-response",
            message:
              "Não recebi uma análise válida do Assistente. Tente novamente.",
          };
    } catch (error) {
      const candidate = error as {
        status?: number;
        code?: string;
        name?: string;
      };
      console.error("assistant_provider_failed", {
        requestId,
        provider: "gemini",
        model: this.model,
        status: candidate?.status,
        code: candidate?.code,
        type: candidate?.name,
        message: safeProviderMessage(error),
        durationMs: Math.round(performance.now() - startedAt),
        configuredRetries: 0,
        thinkingLevel: generationConfig.thinkingConfig.thinkingLevel,
      });
      return providerFailure();
    }
  }
}
