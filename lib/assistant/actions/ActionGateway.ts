import type { AssistantActionProposal } from "../contracts";

const confirmedActionMarker: unique symbol = Symbol("confirmedAssistantAction");

export type ConfirmationReceipt = {
  id: string;
  confirmedAt: string;
};

export type ConfirmedAction = {
  proposal: AssistantActionProposal;
  confirmation: ConfirmationReceipt;
  readonly [confirmedActionMarker]: true;
};

export type ActionResult =
  | { ok: true; message: string; referenceId?: string }
  | {
      ok: false;
      code: "validation-failed" | "execution-failed";
      message: string;
    };

export interface ActionGateway {
  execute(action: ConfirmedAction): Promise<ActionResult>;
}

export type ActionExecutor = {
  kind: string;
  execute(action: ConfirmedAction): Promise<ActionResult>;
};

export function confirmAction(
  proposal: AssistantActionProposal,
  confirmation: ConfirmationReceipt,
): ConfirmedAction {
  return {
    proposal,
    confirmation,
    [confirmedActionMarker]: true,
  };
}

export function isConfirmedAction(value: unknown): value is ConfirmedAction {
  return Boolean(
    value &&
      typeof value === "object" &&
      (value as ConfirmedAction)[confirmedActionMarker] === true,
  );
}

export function requireConfirmedAction(
  value: unknown,
): asserts value is ConfirmedAction {
  if (!isConfirmedAction(value)) {
    throw new Error("Assistant actions require explicit confirmation.");
  }
}

export function createActionGateway(
  executors: readonly ActionExecutor[],
): ActionGateway {
  const executorsByKind = new Map(
    executors.map((executor) => [executor.kind, executor]),
  );
  const executedProposalIds = new Set<string>();

  return {
    async execute(action) {
      requireConfirmedAction(action);

      if (executedProposalIds.has(action.proposal.id)) {
        return {
          ok: false,
          code: "execution-failed",
          message: "Esta proposta já foi executada ou está em execução.",
        };
      }

      const executor = executorsByKind.get(action.proposal.kind);
      if (!executor) {
        return {
          ok: false,
          code: "validation-failed",
          message: "Ação não reconhecida.",
        };
      }

      executedProposalIds.add(action.proposal.id);
      try {
        return await executor.execute(action);
      } catch {
        return {
          ok: false,
          code: "execution-failed",
          message: "Não foi possível executar a ação confirmada.",
        };
      }
    },
  };
}
