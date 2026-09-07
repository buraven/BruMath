import type { ActionGateway } from "../actions/ActionGateway";
import type {
  AssistantClarificationResponse,
  AssistantRequest,
  AssistantResponse,
  AssistantTextResponse,
} from "../contracts";
import type { FinancialContextProvider } from "../context/FinancialContextProvider";
import type { ProviderAdapter } from "../providers/ProviderAdapter";
import type { ToolRegistry } from "../tools/ToolRegistry";

export interface AssistantEngine {
  process(request: AssistantRequest): Promise<AssistantResponse>;
}

export type AssistantEngineDependencies = {
  financialContext: FinancialContextProvider;
  tools: ToolRegistry;
  actions: ActionGateway;
  provider?: ProviderAdapter;
};

export function createAssistantEngine(
  dependencies: AssistantEngineDependencies,
): AssistantEngine {
  // Dependencies are injected now so subsequent PRs can add tools and providers
  // without letting the engine reach into UI state or persistence.
  void dependencies;

  return {
    async process(request) {
      if (!request.message.trim()) {
        const clarification: AssistantClarificationResponse = {
          kind: "clarification",
          question: "O que você gostaria de organizar?",
          missing: ["action"],
        };
        return clarification;
      }

      const response: AssistantTextResponse = {
        kind: "message",
        message:
          "A fundação do Assistente BruMath está pronta para consultas financeiras confiáveis.",
        provenance: [
          {
            kind: "inference",
            label: "Mensagem de disponibilidade da fundação do Assistente.",
            source: "assistant-engine-foundation",
          },
        ],
      };
      return response;
    },
  };
}
