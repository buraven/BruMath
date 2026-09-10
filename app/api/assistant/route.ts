import { NextResponse } from "next/server";
import { generateConversationPlan } from "../../../lib/assistant/providers/OpenAIProviderAdapter.server";
import type { ConversationApiRequest } from "../../../lib/assistant/conversation/contracts";

export const runtime = "nodejs";

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
    /^\d{4}-\d{2}$/.test(request.selectedMonth)
  );
}

export async function POST(request: Request) {
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
  const result = await generateConversationPlan(payload);
  return NextResponse.json(result, { status: result.ok ? 200 : 503 });
}
