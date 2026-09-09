import type { ResponseProvenance } from "../contracts";
import type {
  ExpenseContextItem,
  FinancialContextResult,
  FinancialScope,
  FinancialSummary,
  IncomeContextItem,
  InstallmentContextItem,
  LimitContextItem,
  ReceivableContextItem,
} from "../context/FinancialContextProvider";
import type {
  ReadOnlyTool,
  ToolExecutionContext,
  ToolResult,
} from "./ToolRegistry";
import { createToolRegistry, type ToolRegistry } from "./ToolRegistry";

export type FinancialToolName =
  | "getFinancialSummary"
  | "getExpenses"
  | "getCategorySpending"
  | "getAvailableBalance"
  | "getLimits"
  | "getInstallments"
  | "getReceivables"
  | "getExtraIncome";

export type FinancialToolOutput<T> = {
  toolName: FinancialToolName;
  data: T;
  scope: FinancialScope;
  provenance: readonly ResponseProvenance[];
};

export type CategoryFilter = {
  category?: string;
};

export type CategorySpendingInput = {
  category: string;
};

export type InstallmentFilter = CategoryFilter & {
  dueInSelectedMonth?: boolean;
};

type NoInput = Record<string, never>;

function resolveScope(
  baseScope: FinancialScope,
  input: CategoryFilter,
): FinancialScope {
  return input.category
    ? { ...baseScope, category: input.category }
    : { ...baseScope };
}

function withToolProvenance(
  toolName: FinancialToolName,
  provenance: readonly ResponseProvenance[],
): readonly ResponseProvenance[] {
  return [
    ...provenance,
    {
      kind: "calculation",
      label: `Consulta determinística executada pela tool ${toolName}.`,
      source: "assistant-tools",
    },
  ];
}

function success<T>(
  toolName: FinancialToolName,
  context: FinancialContextResult<T>,
): ToolResult<FinancialToolOutput<T>> {
  return {
    ok: true,
    value: {
      toolName,
      data: context.value,
      scope: context.scope,
      provenance: withToolProvenance(toolName, context.provenance),
    },
  };
}

function invalidInput<T>(message: string): ToolResult<T> {
  return { ok: false, code: "invalid-input", message };
}

const getFinancialSummary: ReadOnlyTool<
  NoInput,
  FinancialToolOutput<FinancialSummary>
> = {
  definition: {
    name: "getFinancialSummary",
    description:
      "Consulta resumo financeiro determinístico do período selecionado.",
  },
  async execute(_, context) {
    return success(
      "getFinancialSummary",
      await context.financialContext.getSummary(context.scope),
    );
  },
};

const getExpenses: ReadOnlyTool<
  CategoryFilter,
  FinancialToolOutput<readonly ExpenseContextItem[]>
> = {
  definition: {
    name: "getExpenses",
    description:
      "Lista gastos do período, perfil e categoria quando informada.",
  },
  async execute(input, context) {
    return success(
      "getExpenses",
      await context.financialContext.getExpenses(
        resolveScope(context.scope, input),
      ),
    );
  },
};

const getCategorySpending: ReadOnlyTool<
  CategorySpendingInput,
  FinancialToolOutput<{
    category: string;
    total: number;
    expenses: readonly ExpenseContextItem[];
  }>
> = {
  definition: {
    name: "getCategorySpending",
    description:
      "Soma gastos de uma categoria no período e perfil consultados.",
  },
  async execute(input, context) {
    const category = input.category?.trim();
    if (!category) return invalidInput("Informe uma categoria para consultar.");

    const expenses = await context.financialContext.getExpenses({
      ...context.scope,
      category,
    });
    return success("getCategorySpending", {
      ...expenses,
      value: {
        category,
        total: expenses.value.reduce(
          (total, expense) => total + expense.amount,
          0,
        ),
        expenses: expenses.value,
      },
    });
  },
};

const getAvailableBalance: ReadOnlyTool<
  NoInput,
  FinancialToolOutput<{ available: number }>
> = {
  definition: {
    name: "getAvailableBalance",
    description: "Consulta o saldo disponível calculado deterministicamente.",
  },
  async execute(_, context) {
    const summary = await context.financialContext.getSummary(context.scope);
    return success("getAvailableBalance", {
      ...summary,
      value: { available: summary.value.available },
    });
  },
};

const getLimits: ReadOnlyTool<
  CategoryFilter,
  FinancialToolOutput<readonly LimitContextItem[]>
> = {
  definition: {
    name: "getLimits",
    description:
      "Consulta limites pessoais e por categoria sem somá-los entre si.",
  },
  async execute(input, context) {
    return success(
      "getLimits",
      await context.financialContext.getLimits(
        resolveScope(context.scope, input),
      ),
    );
  },
};

const getInstallments: ReadOnlyTool<
  InstallmentFilter,
  FinancialToolOutput<readonly InstallmentContextItem[]>
> = {
  definition: {
    name: "getInstallments",
    description: "Consulta parcelamentos ativos e seus vencimentos no período.",
  },
  async execute(input, context) {
    const installments = await context.financialContext.getInstallments(
      resolveScope(context.scope, input),
    );
    const value = input.dueInSelectedMonth
      ? installments.value.filter(
          (installment) => installment.dueInSelectedMonth,
        )
      : installments.value;
    return success("getInstallments", { ...installments, value });
  },
};

const getReceivables: ReadOnlyTool<
  NoInput,
  FinancialToolOutput<readonly ReceivableContextItem[]>
> = {
  definition: {
    name: "getReceivables",
    description: "Consulta valores pendentes ou recebidos no contexto atual.",
  },
  async execute(_, context) {
    return success(
      "getReceivables",
      await context.financialContext.getReceivables(context.scope),
    );
  },
};

const getExtraIncome: ReadOnlyTool<
  NoInput,
  FinancialToolOutput<{ total: number; entries: readonly IncomeContextItem[] }>
> = {
  definition: {
    name: "getExtraIncome",
    description:
      "Consulta entradas extras que entram em conta no período atual.",
  },
  async execute(_, context) {
    const income = await context.financialContext.getIncome(context.scope);
    const entries = income.value.filter(
      (entry) => entry.destination === "conta",
    );
    return success("getExtraIncome", {
      ...income,
      value: {
        total: entries.reduce((total, entry) => total + entry.amount, 0),
        entries,
      },
    });
  },
};

export function createFinancialTools(): readonly ReadOnlyTool[] {
  return [
    getFinancialSummary,
    getExpenses,
    getCategorySpending,
    getAvailableBalance,
    getLimits,
    getInstallments,
    getReceivables,
    getExtraIncome,
  ];
}

export function createFinancialToolRegistry(): ToolRegistry {
  return createToolRegistry(createFinancialTools());
}
