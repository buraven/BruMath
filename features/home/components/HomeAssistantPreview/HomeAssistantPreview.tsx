import { ChevronRight, Send } from "lucide-react";
import { QuickActions } from "../../../../components/finance/QuickActions";
import styles from "./HomeAssistantPreview.module.css";

type HomeAssistantPreviewProps = {
  profile: string;
  latestMessage?: string;
  value: string;
  onChange: (value: string) => void;
  onSend: (preset?: string) => void;
  onOpenConversation: () => void;
  onOpenReceivables: () => void;
  onOpenIncome: () => void;
};

export function HomeAssistantPreview({
  profile,
  latestMessage,
  value,
  onChange,
  onSend,
  onOpenConversation,
  onOpenReceivables,
  onOpenIncome,
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
        <div className={`bubble assistant-bubble ${styles.message}`}>
          {latestMessage}
        </div>
        <QuickActions
          actions={[
            { label: "Quanto temos?", onClick: () => onSend("Quanto temos?") },
            { label: "Insights", onClick: () => onSend("Me dê insights") },
          ]}
        />
        <details>
          <summary>Mais atalhos</summary>
          <QuickActions
            actions={[
              { label: "Resumo", onClick: () => onSend("Resumo") },
              { label: "Parcelas", onClick: () => onSend("Parcelas") },
              { label: "Quem me deve?", onClick: onOpenReceivables },
              { label: "O que entra", onClick: onOpenIncome },
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
