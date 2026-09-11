import { NextResponse } from "next/server";
import { createAssistantProvider } from "../../../lib/assistant/providers/createAssistantProvider.server";
import type {
  ConversationApiRequest,
  ConversationToolResult,
} from "../../../lib/assistant/conversation/contracts";
import { financialToolNames } from "../../../lib/assistant/providers/ConversationPlanParser";

export const runtime = "nodejs";

function isToolResults(
  value: unknown,
): value is readonly ConversationToolResult[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > 5)
    return false;
  return value.every((result) => {
    if (!result || typeof result !== "object" || Array.isArray(result))
      return false;
    const item = result as Partial<ConversationToolResult>;
    return (
      typeof item.toolName === "string" &&
      (financialToolNames as readonly string[]).includes(item.toolName) &&
      !!item.scope &&
      (item.scope.profile === "Bruna" ||
        item.scope.profile === "Matheus" ||
        item.scope.profile === "Casal") &&
      typeof item.scope.month === "string" &&
      /^\d{4}-\d{2}$/.test(item.scope.month) &&
      Array.isArray(item.provenance) &&
      (item.availability === undefined ||
        (item.availability.source === "brumath-data" &&
          typeof item.availability.hasStoredData === "boolean" &&
          typeof item.availability.hasRecordsInScope === "boolean"))
    );
  });
}

function isRequest(value: unknown): value is ConversationApiRequest {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const request = value as Partial<ConversationApiRequest>;
  return (
    typeof request.message === "string" &&
    request.message.trim().length > 0 &&
    request.message.length <= 2_000 &&
    (request.activeProfile === "Bruna" ||
      request.activeProfile === "Matheus" ||
      request.activeProfile === "Casal") &&
    typeof request.selectedMonth === "string" &&
    /^\d{4}-\d{2}$/.test(request.selectedMonth) &&
    (request.requestId === undefined ||
      (typeof request.requestId === "string" &&
        /^[a-zA-Z0-9-]{1,80}$/.test(request.requestId))) &&
    (request.toolResults === undefined || isToolResults(request.toolResults))
  );
}

export async function POST(request: Request) {
  const receivedAt = performance.now();
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, code: "invalid-response", message: "Pedido inválido." },
      { status: 400 },
    );
  }
  if (!isRequest(payload)) {
    return NextResponse.json(
      { ok: false, code: "invalid-response", message: "Pedido inválido." },
      { status: 400 },
    );
  }
  const requestId = payload.requestId ?? crypto.randomUUID();
  console.info("assistant_request_received", { requestId });
  let result;
  try {
    const provider = createAssistantProvider();
    const providerRequest = { ...payload, requestId };
    result = providerRequest.toolResults?.length
      ? await provider.generateExplanation(
          providerRequest,
          providerRequest.toolResults,
        )
      : await provider.generatePlan(providerRequest);
  } catch {
    result = {
      ok: false as const,
      code: "unavailable" as const,
      message: "O Assistente com IA ainda não está configurado neste ambiente.",
    };
  }
  const durationMs = Math.round(performance.now() - receivedAt);
  console.info("assistant_request_completed", {
    requestId,
    durationMs,
    status: result.ok ? 200 : 503,
    phase: payload.toolResults?.length ? "explanation" : "planning",
  });
  return NextResponse.json(result, {
    status: result.ok ? 200 : 503,
    headers: { "Server-Timing": `assistant;dur=${durationMs}` },
  });
}
