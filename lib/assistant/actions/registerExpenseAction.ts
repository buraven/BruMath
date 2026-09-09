import type { TransactionRepository } from "../../finance/TransactionRepository";
import type { TransactionOwner } from "../../finance/transactions";
import type {
  ActionExecutor,
  ActionResult,
  ConfirmedAction,
} from "./ActionGateway";
import type { AssistantActionProposal } from "../contracts";

export const REGISTER_EXPENSE_ACTION = "register-expense";

export type RegisterExpenseInput = {
  id: string;
  description: string;
  amount: number;
  category: string;
  owner: TransactionOwner;
  date: string;
};

export type RegisterExpenseProposal = AssistantActionProposal & {
  kind: typeof REGISTER_EXPENSE_ACTION;
  payload: RegisterExpenseInput;
};

function isRegisterExpenseInput(value: unknown): value is RegisterExpenseInput {
  if (!value || typeof value !== "object") return false;
  const input = value as Partial<RegisterExpenseInput>;
  return (
    typeof input.id === "string" &&
    Boolean(input.id.trim()) &&
    typeof input.description === "string" &&
    Boolean(input.description.trim()) &&
    typeof input.amount === "number" &&
    Number.isFinite(input.amount) &&
    input.amount > 0 &&
    typeof input.category === "string" &&
    Boolean(input.category.trim()) &&
    (input.owner === "Bruna" ||
      input.owner === "Matheus" ||
      input.owner === "Casal") &&
    typeof input.date === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(input.date)
  );
}

export function createRegisterExpenseProposal(
  input: RegisterExpenseInput,
): RegisterExpenseProposal {
  if (!isRegisterExpenseInput(input)) {
    throw new Error("Proposta de gasto inválida.");
  }

  const payload = {
    ...input,
    description: input.description.trim(),
    category: input.category.trim(),
  };

  return {
    id: `proposal:register-expense:${payload.id}`,
    kind: REGISTER_EXPENSE_ACTION,
    payload,
    preview: {
      title: "Registrar gasto",
      description: `${payload.description} — R$ ${payload.amount.toFixed(2)}`,
    },
  };
}

export function createRegisterExpenseAction(
  repository: TransactionRepository,
): ActionExecutor {
  return {
    kind: REGISTER_EXPENSE_ACTION,
    async execute(action: ConfirmedAction): Promise<ActionResult> {
      if (action.proposal.kind !== REGISTER_EXPENSE_ACTION) {
        return {
          ok: false,
          code: "validation-failed",
          message: "A proposta não corresponde ao registro de gasto.",
        };
      }

      if (!isRegisterExpenseInput(action.proposal.payload)) {
        return {
          ok: false,
          code: "validation-failed",
          message: "Os dados confirmados do gasto são inválidos.",
        };
      }

      const input = action.proposal.payload;
      await repository.save({
        id: input.id,
        description: input.description.trim(),
        amount: input.amount,
        category: input.category.trim(),
        owner: input.owner,
        type: "expense",
        date: input.date,
      });

      return {
        ok: true,
        message: "Gasto registrado.",
        referenceId: input.id,
      };
    },
  };
}
