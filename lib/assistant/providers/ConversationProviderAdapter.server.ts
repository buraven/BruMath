import type {
  ConversationApiRequest,
  ConversationApiResponse,
  ConversationToolResult,
} from "../conversation/contracts";

/** Server-only boundary shared by concrete conversational providers. */
export interface ConversationProviderAdapter {
  generatePlan(
    request: ConversationApiRequest,
  ): Promise<ConversationApiResponse>;
  generateExplanation(
    request: ConversationApiRequest,
    toolResults: readonly ConversationToolResult[],
  ): Promise<ConversationApiResponse>;
}
