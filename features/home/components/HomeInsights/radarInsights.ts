export type HomeInsight = {
  id: "limit" | "installments" | "receivable" | "empty";
  title: string;
  detail: string;
  tone: "attention" | "info" | "positive";
};

type LimitItem = {
  id: string;
  label: string;
  amount: number;
  spent: number;
};

type HomeInsightInput = {
  limitItems: readonly LimitItem[];
  remainingInstallments: number;
  activeInstallmentCount: number;
  receivableTotal: number;
  formatMoney: (value: number) => string;
};

/** Pure, deterministic Home radar signals. This never calls an AI provider. */
export function deriveHomeInsights({
  limitItems,
  remainingInstallments,
  activeInstallmentCount,
  receivableTotal,
  formatMoney,
}: HomeInsightInput): readonly HomeInsight[] {
  const highestLimit = limitItems
    .filter((item) => item.id.startsWith("category:") && item.amount > 0)
    .sort((a, b) => b.spent / b.amount - a.spent / a.amount)[0];
  const insights: HomeInsight[] = [];

  if (highestLimit && highestLimit.spent > 0) {
    const percentage = Math.round(
      (highestLimit.spent / highestLimit.amount) * 100,
    );
    insights.push({
      id: "limit",
      title: `${highestLimit.label} está em ${percentage}% do limite`,
      detail: `${formatMoney(highestLimit.spent)} registrados de ${formatMoney(highestLimit.amount)}.`,
      tone: percentage >= 80 ? "attention" : "positive",
    });
  }

  if (remainingInstallments > 0) {
    insights.push({
      id: "installments",
      title: `${remainingInstallments} parcelas restantes`,
      detail: `${activeInstallmentCount} compromisso${activeInstallmentCount === 1 ? "" : "s"} ativo${activeInstallmentCount === 1 ? "" : "s"}.`,
      tone: "info",
    });
  }

  if (receivableTotal > 0) {
    insights.push({
      id: "receivable",
      title: `${formatMoney(receivableTotal)} a receber`,
      detail: "Valores registrados ainda em aberto.",
      tone: "positive",
    });
  }

  return insights.length
    ? insights.slice(0, 3)
    : [
        {
          id: "empty",
          title: "Ainda não há sinais para analisar",
          detail:
            "Registre movimentações neste mês para o radar financeiro ganhar contexto.",
          tone: "info",
        },
      ];
}
