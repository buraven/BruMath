"use client";

import {
  useRef,
  useState,
  type Dispatch,
  type RefObject,
  type SetStateAction,
} from "react";
import type { HomeAssistantQuickAction } from "../home/components/HomeAssistantPreview/HomeAssistantPreview";
import {
  confirmAction,
  createActionGateway,
  createRegisterExpenseAction,
  createRegisterExpenseProposal,
} from "../../lib/assistant";
import {
  requestConversationPlan,
  resolveConversationPlan,
} from "../../lib/assistant/conversation/ConversationService";
import type {
  ConversationContext,
  RegisterExpensePlan,
} from "../../lib/assistant/conversation/contracts";
import {
  completeExpenseIntent,
  createPendingExpenseIntent,
  pendingExpenseQuestion,
  resolvePendingExpenseReply,
} from "../../lib/assistant/conversation/conversationContext";
import { LocalStorageTransactionRepository } from "../../lib/finance/LocalStorageTransactionRepository";
import type {
  ChatMessage,
  CompactAssistantMessage,
  Confirmation,
  Expense,
  Person,
} from "../../lib/app/AppTypes";

type ResponseMode = "compact" | "full";

type UseAssistantControllerOptions = {
  activeProfile: Person;
  viewMonth: string;
  categories: string[];
  setExpenses: Dispatch<SetStateAction<Expense[]>>;
  setConfirmation: Dispatch<SetStateAction<Confirmation | null>>;
  setToast: Dispatch<SetStateAction<string>>;
  formatMoney: (value: number) => string;
  formatDate: (value: string) => string;
};

export function useAssistantController({
  activeProfile,
  viewMonth,
  categories,
  setExpenses,
  setConfirmation,
  setToast,
  formatMoney,
  formatDate,
}: UseAssistantControllerOptions) {
  const [text, setText] = useState("");
  const [assistantLoading, setAssistantLoading] = useState(false);
  const [chat, setChat] = useState<ChatMessage[]>([
    {
      id: 1,
      role: "assistant",
      text: "Oi! 💚 Estou falando com você como Bruna. Escolha o perfil no topo para definir quem está falando. Se a frase citar Bruna, Matheus ou casal, isso ganha prioridade.",
    },
  ]);
  const [compactAssistantMessage, setCompactAssistantMessage] =
    useState<CompactAssistantMessage>({
      text: `Oi, ${activeProfile} 💚 O que vamos organizar hoje?`,
    });
  const conversationContext = useRef<ConversationContext>({});
  const messagesRef = useRef<HTMLDivElement>(null);
  const chatScrollTop = useRef(0);
  const actionGateway = useRef(
    createActionGateway([
      createRegisterExpenseAction(new LocalStorageTransactionRepository()),
    ]),
  );

  const send = async (
    preset?: string,
    responseMode: ResponseMode = "full",
    quickAction?: HomeAssistantQuickAction,
  ) => {
    const value = (preset ?? text).trim();
    if (!value || assistantLoading) return;

    const now = Date.now();
    const conversationRequestId = crypto.randomUUID();
    const pendingId = now + 1;
    const completePending = (reply: string) => {
      if (responseMode === "compact") {
        setCompactAssistantMessage({ text: reply });
        return;
      }
      setChat((current) =>
        current.map((message) =>
          message.id === pendingId
            ? { ...message, text: reply, status: undefined }
            : message,
        ),
      );
    };
    const presentExpenseProposal = (
      input: RegisterExpensePlan & { owner: Person },
    ) => {
      const expenseId = Date.now();
      const proposal = createRegisterExpenseProposal({
        id: `expense:${expenseId}`,
        description: input.description,
        amount: input.amount,
        category: input.category,
        owner: input.owner,
        date: input.date ?? `${viewMonth}-01`,
      });
      conversationContext.current = {};
      completePending(
        "Preparei o gasto para você revisar. Ele só será salvo depois da sua confirmação.",
      );
      setConfirmation({
        title: proposal.preview.title,
        description: `${proposal.preview.description}. Confirme para salvar este gasto.`,
        confirmLabel: "Confirmar gasto",
        details: [
          { label: "Valor", value: formatMoney(proposal.payload.amount) },
          { label: "Descrição", value: proposal.payload.description },
          { label: "Categoria", value: proposal.payload.category },
          { label: "Responsável", value: proposal.payload.owner },
          { label: "Data", value: formatDate(proposal.payload.date) },
        ],
        onConfirm: async () => {
          const confirmed = confirmAction(proposal, {
            id: `confirmation:${proposal.id}`,
            proposalId: proposal.id,
            confirmedAt: new Date().toISOString(),
          });
          const result = await actionGateway.current.execute(confirmed);
          if (!result.ok) {
            completePending(result.message);
            setToast(result.message);
            return;
          }
          setExpenses((current) => [
            {
              id: expenseId,
              title: proposal.payload.description,
              cat: proposal.payload.category,
              who: proposal.payload.owner,
              amount: proposal.payload.amount,
              date: proposal.payload.date,
            },
            ...current,
          ]);
          completePending("Gasto registrado com sucesso 💚");
          setToast("Gasto registrado 💚");
        },
      });
    };

    if (responseMode === "compact") {
      setCompactAssistantMessage({ text: "", status: "pending" });
    } else {
      setChat((current) => [
        ...current,
        { id: now, role: "user", text: value },
        { id: pendingId, role: "assistant", text: "", status: "pending" },
      ]);
    }
    setText("");
    setAssistantLoading(true);

    try {
      const pendingExpense = conversationContext.current.pendingIntent;
      if (pendingExpense) {
        const resolved = resolvePendingExpenseReply(
          pendingExpense,
          value,
          categories,
        );
        if (resolved.kind === "cancelled") {
          conversationContext.current = {};
          completePending("Tudo bem, cancelei esse lançamento.");
          return;
        }
        if (resolved.kind === "clarifying") {
          conversationContext.current = { pendingIntent: resolved.intent };
          completePending(resolved.question);
          return;
        }
        presentExpenseProposal({
          description: resolved.intent.description,
          amount: resolved.intent.amount,
          category: resolved.intent.category,
          owner: resolved.intent.owner,
          ...(resolved.intent.date ? { date: resolved.intent.date } : {}),
        });
        return;
      }

      const response = await requestConversationPlan({
        message: value,
        activeProfile,
        selectedMonth: viewMonth,
        requestId: conversationRequestId,
        responseMode,
        quickAction,
        ...(conversationContext.current.pendingIntent ||
        conversationContext.current.lastQuery
          ? { conversationContext: conversationContext.current }
          : {}),
      });
      if (!response.ok) {
        conversationContext.current = {};
        completePending(response.message);
        return;
      }
      if (response.plan.kind === "tool-call") {
        conversationContext.current = {
          lastQuery: {
            toolName: response.plan.toolName,
            input: response.plan.input,
          },
        };
      } else if (response.plan.kind === "tool-calls") {
        const primary = response.plan.calls[0];
        if (primary) {
          conversationContext.current = {
            lastQuery: { toolName: primary.toolName, input: primary.input },
          };
        }
      }

      const plan = await resolveConversationPlan(response.plan, {
        activeProfile,
        selectedMonth: viewMonth,
      });
      if (plan.kind === "tool-results") {
        const explanation = await requestConversationPlan({
          message: value,
          activeProfile,
          selectedMonth: viewMonth,
          toolResults: plan.results,
          requestId: conversationRequestId,
          responseMode,
          quickAction,
        });
        completePending(
          explanation.ok && explanation.plan.kind === "message"
            ? explanation.plan.message
            : explanation.ok
              ? "Não consegui concluir essa análise. Tente novamente."
              : explanation.message,
        );
        return;
      }
      if (plan.kind === "register-expense") {
        const intent = createPendingExpenseIntent(plan.input);
        if (!completeExpenseIntent(intent)) {
          conversationContext.current = { pendingIntent: intent };
          completePending(pendingExpenseQuestion(intent));
          return;
        }
        presentExpenseProposal({
          description: intent.description,
          amount: intent.amount,
          category: intent.category,
          owner: intent.owner,
          ...(intent.date ? { date: intent.date } : {}),
        });
        return;
      }
      if (plan.kind === "register-expense-clarification") {
        conversationContext.current = { pendingIntent: plan.intent };
        completePending(pendingExpenseQuestion(plan.intent));
        return;
      }
      if (plan.kind === "cancel-pending-intent") {
        conversationContext.current = {};
        completePending("Tudo bem, cancelei esse lançamento.");
        return;
      }
      if (plan.kind === "clarification") {
        conversationContext.current = {};
      } else if (plan.kind === "tool-call") {
        conversationContext.current = {
          lastQuery: { toolName: plan.toolName, input: plan.input },
        };
      } else {
        conversationContext.current = {};
      }
      completePending(
        plan.kind === "clarification"
          ? plan.question
          : plan.kind === "message"
            ? plan.message
            : "Não consegui concluir essa consulta. Tente novamente.",
      );
    } catch {
      conversationContext.current = {};
      completePending(
        "Não foi possível processar sua mensagem agora. Tente novamente.",
      );
    } finally {
      setAssistantLoading(false);
    }
  };

  return {
    text,
    setText,
    assistantLoading,
    chat,
    compactAssistantMessage,
    messagesRef: messagesRef as RefObject<HTMLDivElement>,
    chatScrollTop,
    send,
  };
}
