import type {
  FinancialContextProvider,
  FinancialScope,
} from "../context/FinancialContextProvider";

export type ToolDefinition = {
  name: string;
  description: string;
};

export type ToolExecutionContext = {
  scope: FinancialScope;
  financialContext: FinancialContextProvider;
};

export type ToolResult<TOutput> =
  | { ok: true; value: TOutput }
  | {
      ok: false;
      code: "invalid-input" | "unavailable" | "failed";
      message: string;
    };

export interface ReadOnlyTool<TInput = unknown, TOutput = unknown> {
  definition: ToolDefinition;
  execute(
    input: TInput,
    context: ToolExecutionContext,
  ): Promise<ToolResult<TOutput>>;
}

export interface ToolRegistry {
  get(name: string): ReadOnlyTool | undefined;
  require(name: string): ReadOnlyTool;
  list(): readonly ToolDefinition[];
}

export function createToolRegistry(
  tools: readonly ReadOnlyTool[] = [],
): ToolRegistry {
  const registered = new Map<string, ReadOnlyTool>();

  for (const tool of tools) {
    if (registered.has(tool.definition.name)) {
      throw new Error(`Duplicate assistant tool: ${tool.definition.name}`);
    }
    registered.set(tool.definition.name, tool);
  }

  return {
    get: (name) => registered.get(name),
    require: (name) => {
      const tool = registered.get(name);
      if (!tool) throw new Error(`Assistant tool not found: ${name}`);
      return tool;
    },
    list: () => [...registered.values()].map((tool) => tool.definition),
  };
}
