import type {
  AssistantProfile,
  AssistantRequest,
  ResponseProvenance,
} from "../contracts";
import type { FinancialToolName } from "../tools/financialTools";
import type { PersonalLimitBucket } from "../../finance/personalLimitBuckets";

export type ConversationToolInput = {
  profile?: AssistantProfile;
  month?: string;
  category?: string;
  dueInSelectedMonth?: boolean;
};

export type ConversationQuickAction =
  | "financial-summary"
  | "insights"
  | "installments"
  | "receivables"
  | "incoming-summary";

export type RegisterExpensePlan = {
  description: string;
  amount: number;
  category: string;
  owner?: AssistantProfile;
  date?: string;
  personalLimitBucket?: PersonalLimitBucket;
};

export type PendingExpenseIntent = {
  kind: "register-expense";
  amount?: number;
  description?: string;
  category?: string;
  owner?: AssistantProfile;
  date?: string;
  personalLimitBucket?: PersonalLimitBucket;
  missingFields: readonly ("description" | "category" | "owner")[];
};

export type ConversationContext = {
  pendingIntent?: PendingExpenseIntent;
  lastQuery?: {
    toolName: FinancialToolName;
    input: ConversationToolInput;
  };
};

export type ConversationMessagePlan = {
  kind: "message";
  message: string;
  /** Provider wording is always separated from deterministic financial results. */
  provenance: readonly ResponseProvenance[];
};

export type ConversationPlan =
  | ConversationMessagePlan
  | { kind: "clarification"; question: string }
  | { kind: "register-expense-clarification"; intent: PendingExpenseIntent }
  | { kind: "cancel-pending-intent" }
  | {
      kind: "tool-call";
      toolName: FinancialToolName;
      input: ConversationToolInput;
    }
  | {
      kind: "tool-calls";
      calls: readonly {
        toolName: FinancialToolName;
        input: ConversationToolInput;
      }[];
    }
  | { kind: "register-expense"; input: RegisterExpensePlan };

export type ConversationToolResult = {
  toolName: FinancialToolName;
  data: unknown;
  scope: ConversationToolInput & { profile: AssistantProfile; month: string };
  provenance: readonly ResponseProvenance[];
  availability?: {
    source: "brumath-data";
    hasStoredData: boolean;
    hasRecordsInScope: boolean;
  };
};

export type ConversationApiRequest = Pick<
  AssistantRequest,
  "message" | "activeProfile" | "selectedMonth"
> & {
  responseMode?: "compact" | "full";
  quickAction?: ConversationQuickAction;
  temporalContext?: { currentDate: string; timeZone: string };
  conversationContext?: ConversationContext;
  toolResults?: readonly ConversationToolResult[];
  /** Added only by the server route for safe latency correlation. */
  requestId?: string;
};

export type ConversationApiResponse =
  | { ok: true; plan: ConversationPlan }
  | {
      ok: false;
      code: "unavailable" | "provider-failed" | "invalid-response";
      message: string;
    };
