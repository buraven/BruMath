import assert from "node:assert/strict";
import test from "node:test";
import {
  confirmAction,
  createAssistantEngine,
  createToolRegistry,
  isConfirmedAction,
  requireConfirmedAction,
  type ActionGateway,
  type AssistantActionProposal,
  type FinancialContextProvider,
  type ProviderAdapter,
  type ReadOnlyTool,
} from "..";

const financialContext: FinancialContextProvider = {
  getContext: async () => ({
    value: {
      summary: {
        baseIncome: 1000,
        extraIncome: 0,
        expenses: 100,
        available: 900,
        receivablesOutstanding: 0,
      },
      expenses: [],
      limits: [],
      installments: [],
      receivables: [],
      income: [],
    },
    scope: { profile: "Bruna", month: "2026-09" },
    provenance: [],
  }),
  getSummary: async () => ({
    value: {
      baseIncome: 1000,
      extraIncome: 0,
      expenses: 100,
      available: 900,
      receivablesOutstanding: 0,
    },
    scope: { profile: "Bruna", month: "2026-09" },
    provenance: [],
  }),
  getExpenses: async () => ({
    value: [],
    scope: { profile: "Bruna", month: "2026-09" },
    provenance: [],
  }),
  getLimits: async () => ({
    value: [],
    scope: { profile: "Bruna", month: "2026-09" },
    provenance: [],
  }),
  getInstallments: async () => ({
    value: [],
    scope: { profile: "Bruna", month: "2026-09" },
    provenance: [],
  }),
  getReceivables: async () => ({
    value: [],
    scope: { profile: "Bruna", month: "2026-09" },
    provenance: [],
  }),
  getIncome: async () => ({
    value: [],
    scope: { profile: "Bruna", month: "2026-09" },
    provenance: [],
  }),
};

const actionGateway: ActionGateway = {
  async execute(action) {
    requireConfirmedAction(action);
    return { ok: true, message: "Action mock executed." };
  },
};

const provider: ProviderAdapter = {
  async generate() {
    return { kind: "message", message: "Provider mock." };
  },
};

test("returns a typed foundation response without calling external boundaries", async () => {
  const engine = createAssistantEngine({
    financialContext,
    tools: createToolRegistry(),
    actions: actionGateway,
    provider,
  });

  const response = await engine.process({
    message: "Como estamos?",
    activeProfile: "Bruna",
    selectedMonth: "2026-09",
  });

  assert.equal(response.kind, "message");
  assert.equal(response.provenance[0]?.kind, "inference");
});

test("returns clarification for an empty request", async () => {
  const engine = createAssistantEngine({
    financialContext,
    tools: createToolRegistry(),
    actions: actionGateway,
  });

  const response = await engine.process({
    message: "  ",
    activeProfile: "Casal",
    selectedMonth: "2026-09",
  });

  assert.deepEqual(response, {
    kind: "clarification",
    question: "O que você gostaria de organizar?",
    missing: ["action"],
  });
});

test("registers read-only tools with structured output", async () => {
  const tool: ReadOnlyTool<{ category: string }, { total: number }> = {
    definition: { name: "getExpensesByCategory", description: "Mock query" },
    async execute(input) {
      return { ok: true, value: { total: input.category === "Casa" ? 10 : 0 } };
    },
  };
  const registry = createToolRegistry([tool]);
  const registered = registry.get("getExpensesByCategory");

  assert.ok(registered);
  const result = await registered.execute(
    { category: "Casa" },
    { scope: { profile: "Casal", month: "2026-09" }, financialContext },
  );
  assert.deepEqual(result, { ok: true, value: { total: 10 } });
});

test("prevents an action proposal from being executed before confirmation", async () => {
  const proposal: AssistantActionProposal = {
    id: "proposal-1",
    kind: "create-expense",
    payload: { amount: 50 },
    preview: { title: "Novo gasto", description: "R$ 50,00" },
  };

  assert.equal(isConfirmedAction(proposal), false);
  assert.throws(() => requireConfirmedAction(proposal));

  const confirmed = confirmAction(proposal, {
    id: "confirmation-1",
    confirmedAt: "2026-09-07T12:00:00.000Z",
  });

  assert.equal(isConfirmedAction(confirmed), true);
  const result = await actionGateway.execute(confirmed);
  assert.deepEqual(result, { ok: true, message: "Action mock executed." });
});
