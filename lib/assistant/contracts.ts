import type { TransactionOwner } from "../finance/transactions";

export type AssistantProfile = TransactionOwner;
export type AssistantMonth = string;

export type ConversationContext = {
  summary?: string;
  references?: {
    profile?: AssistantProfile;
    month?: AssistantMonth;
    category?: string;
  };
};

export type AssistantRequest = {
  message: string;
  activeProfile: AssistantProfile;
  selectedMonth: AssistantMonth;
  conversationContext?: ConversationContext;
};

export const responseProvenanceKinds = [
  "fact",
  "calculation",
  "simulation",
  "inference",
] as const;

export type ResponseProvenanceKind = (typeof responseProvenanceKinds)[number];

export type ResponseProvenance = {
  kind: ResponseProvenanceKind;
  label: string;
  source?: string;
};

/** Financial values can only be confirmed by persisted facts or deterministic calculations. */
export function isDeterministicProvenance(
  provenance: ResponseProvenance,
): provenance is ResponseProvenance & {
  kind: "fact" | "calculation";
} {
  return provenance.kind === "fact" || provenance.kind === "calculation";
}

/** Provider-authored wording is interpretation, never a confirmed financial value. */
export function providerInferenceProvenance(
  source: string,
): readonly ResponseProvenance[] {
  return [
    {
      kind: "inference",
      label:
        "Formulação interpretativa gerada pelo provider a partir do contexto autorizado.",
      source,
    },
  ];
}

export type AssistantActionProposal = {
  id: string;
  kind: string;
  payload: unknown;
  preview: {
    title: string;
    description: string;
  };
};

export type AssistantTextResponse = {
  kind: "message";
  message: string;
  provenance: readonly ResponseProvenance[];
};

export type AssistantClarificationResponse = {
  kind: "clarification";
  question: string;
  missing: readonly ("profile" | "month" | "category" | "action")[];
};

export type AssistantToolResponse = {
  kind: "tool-result";
  toolName: string;
  result: unknown;
  provenance: readonly ResponseProvenance[];
};

export type AssistantActionProposalResponse = {
  kind: "action-proposal";
  proposal: AssistantActionProposal;
  provenance: readonly ResponseProvenance[];
};

export type AssistantErrorResponse = {
  kind: "error";
  code: "invalid-request" | "tool-failed" | "provider-failed" | "unavailable";
  message: string;
};

export type AssistantResponse =
  | AssistantTextResponse
  | AssistantClarificationResponse
  | AssistantToolResponse
  | AssistantActionProposalResponse
  | AssistantErrorResponse;
