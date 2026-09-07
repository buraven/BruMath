import type { AssistantProfile, ConversationContext } from "../contracts";
import type { ToolDefinition } from "../tools/ToolRegistry";

export type ProviderRequest = {
  message: string;
  session: {
    activeProfile: AssistantProfile;
    selectedMonth: string;
    conversationContext?: ConversationContext;
  };
  availableTools: readonly ToolDefinition[];
};

export type ProviderResponse =
  | { kind: "message"; message: string }
  | { kind: "tool-call"; toolName: string; input: unknown }
  | { kind: "clarification"; question: string };

export interface ProviderAdapter {
  generate(request: ProviderRequest): Promise<ProviderResponse>;
}
