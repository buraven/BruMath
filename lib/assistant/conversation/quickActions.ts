import type { ConversationApiRequest } from "./contracts";

export function quickActionInstruction(
  quickAction: ConversationApiRequest["quickAction"],
): string | undefined {
  const instructions = {
    "financial-summary":
      "Ação oficial: visão financeira resumida. Consulte getFinancialSummary; não peça desambiguação.",
    insights:
      "Ação oficial: insights gerais. Consulte dados gerais pertinentes, sem exigir categoria; analise somente fatos retornados.",
    installments:
      "Ação oficial: parcelas. Consulte getInstallments; não peça desambiguação.",
    receivables:
      "Ação oficial: valores a receber. Consulte getReceivables; não peça desambiguação.",
    "incoming-summary":
      "Ação oficial: o que entra. Consulte renda-base no resumo, entradas extras e recebíveis; não pergunte qual tipo de entrada a pessoa quis dizer.",
  } as const;
  return quickAction ? instructions[quickAction] : undefined;
}
