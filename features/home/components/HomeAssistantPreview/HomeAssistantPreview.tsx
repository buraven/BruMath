import { ChevronRight, Send } from "lucide-react";
import { QuickActions } from "../../../../components/finance/QuickActions";
import { AssistantMarkdown } from "../../../../components/assistant/AssistantMarkdown";
import type { ConversationQuickAction } from "../../../../lib/assistant/conversation/contracts";
import styles from "./HomeAssistantPreview.module.css";

export type HomeAssistantQuickAction = ConversationQuickAction;

type HomeAssistantPreviewProps = {
  profile: string;
  latestMessage?: { text: string; status?: "pending" };
  value: string;
  onChange: (value: string) => void;
  onSend: (request?: {
    message: string;
    quickAction?: HomeAssistantQuickAction;
  }) => void;
  onOpenConversation: () => void;
};

export function HomeAssistantPreview({
  profile,
  latestMessage,
  value,
  onChange,
  onSend,
  onOpenConversation,
}: HomeAssistantPreviewProps) {
  return (
    <section className={`section ${styles.preview}`}>
      <div className="section-title">
        <div>
          <h2>Assistente BruMath</h2>
          <span className="muted">
            Falando como <strong>{profile}</strong>
          </span>
        </div>
        <span className="online">
          <i /> IA inteligente
        </span>
      </div>
      <div className="chat-preview">
        {latestMessage?.status === "pending" ? (
          <div className="bubble assistant-bubble" aria-label="Pensando">
            <span className={styles.thinking}>Pensando…</span>
          </div>
        ) : latestMessage?.text.trim() ? (
          <div className={`bubble assistant-bubble ${styles.message}`}>
            <AssistantMarkdown
              content={latestMessage.text}
              className={styles.compactMarkdown}
            />
          </div>
        ) : null}
        <QuickActions
          actions={[
            {
              label: "Quanto temos?",
              onClick: () =>
                onSend({
                  message: "Quanto temos?",
                  quickAction: "financial-summary",
                }),
            },
            {
              label: "Insights",
              onClick: () =>
                onSend({ message: "Me dê insights", quickAction: "insights" }),
            },
          ]}
        />
        <details>
          <summary>Mais atalhos</summary>
          <QuickActions
            actions={[
              {
                label: "Resumo",
                onClick: () =>
                  onSend({
                    message: "Resumo",
                    quickAction: "financial-summary",
                  }),
              },
              {
                label: "Parcelas",
                onClick: () =>
                  onSend({ message: "Parcelas", quickAction: "installments" }),
              },
              {
                label: "Quem me deve?",
                onClick: () =>
                  onSend({
                    message: "Quem me deve?",
                    quickAction: "receivables",
                  }),
              },
              {
                label: "O que entra",
                onClick: () =>
                  onSend({
                    message: "O que entra",
                    quickAction: "incoming-summary",
                  }),
              },
            ]}
          />
        </details>
        <div className="input-row">
          <input
            value={value}
            onChange={(event) => onChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") onSend();
            }}
            placeholder="Pergunte algo sobre suas finanças..."
          />
          <button
            type="button"
            className="send-button"
            onClick={() => onSend()}
          >
            <Send size={17} />
            <span>Enviar</span>
          </button>
        </div>
        <button
          type="button"
          className="open-chat"
          onClick={onOpenConversation}
        >
          Abrir conversa completa <ChevronRight size={16} />
        </button>
      </div>
    </section>
  );
}
