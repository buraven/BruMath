import { GeminiProviderAdapter } from "./GeminiProviderAdapter.server";
import { OpenAIProviderAdapter } from "./OpenAIProviderAdapter.server";
import type { ConversationProviderAdapter } from "./ConversationProviderAdapter.server";

export type AssistantProviderName = "gemini" | "openai";

export function createAssistantProvider(
  provider = process.env.AI_PROVIDER || "gemini",
): ConversationProviderAdapter {
  if (provider === "gemini") return new GeminiProviderAdapter();
  if (provider === "openai") return new OpenAIProviderAdapter();
  throw new Error(`Unsupported assistant provider: ${provider}`);
}
