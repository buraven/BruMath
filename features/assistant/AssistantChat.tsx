"use client";

import {
  useLayoutEffect,
  useRef,
  type MutableRefObject,
  type RefObject,
} from "react";
import ReactMarkdown from "react-markdown";
import { Send, Sparkles } from "lucide-react";
import styles from "./AssistantChat.module.css";

type Message = {
  id: number;
  role: "assistant" | "user";
  text: string;
  status?: "pending";
};
type Props = {
  profile: string;
  monthLabel: string;
  messages: Message[];
  value: string;
  onChange: (value: string) => void;
  onSend: (value?: string) => void;
  isLoading?: boolean;
  messagesRef: RefObject<HTMLDivElement>;
  scrollPosition: MutableRefObject<number>;
};
const suggestions = [
  ["Como estamos este mês?", "Como estamos este mês?"],
  ["Onde gastamos mais?", "Me dê insights"],
  ["Próximas parcelas", "Próximas parcelas"],
  ["Quanto ainda posso gastar?", "Quanto ainda posso gastar?"],
  ["Quem me deve?", "Quem me deve?"],
];

export function AssistantChat({
  profile,
  monthLabel,
  messages,
  value,
  onChange,
  onSend,
  isLoading = false,
  messagesRef,
  scrollPosition,
}: Props) {
  const previousCount = useRef(messages.length);
  useLayoutEffect(() => {
    const list = messagesRef.current;
    if (list) list.scrollTop = scrollPosition.current;
  }, [messagesRef, scrollPosition]);
  useLayoutEffect(() => {
    if (previousCount.current !== messages.length && messagesRef.current) {
      messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
    }
    previousCount.current = messages.length;
  }, [messages.length, messagesRef]);
  return (
    <section
      className={styles.chat}
      data-assistant-chat
      aria-label="Assistente financeiro"
    >
      <header className={styles.header}>
        <h1>
          <Sparkles size={18} /> Assistente BruMath
        </h1>
        <p>
          {profile} · {monthLabel}
        </p>
      </header>
      <div
        className={styles.messages}
        ref={messagesRef}
        onScroll={(event) => {
          scrollPosition.current = event.currentTarget.scrollTop;
        }}
        role="log"
        aria-label="Conversa"
        aria-live="polite"
      >
        {messages.map((message, index) => (
          <div
            className={message.role === "user" ? styles.user : styles.assistant}
            key={message.id}
          >
            <span className={styles.author}>
              {message.role === "user" ? "Você" : "BruMath"}
            </span>
            <div className={styles.bubble}>
              {message.status === "pending" ? (
                <span className={styles.thinking} aria-label="Pensando">
                  <i /> <i /> <i /> <span>Pensando…</span>
                </span>
              ) : index === 0 && message.role === "assistant" ? (
                `Oi, ${profile} 💚 O que vamos organizar hoje?`
              ) : message.role === "assistant" ? (
                <div className={styles.markdown}>
                  <ReactMarkdown skipHtml>{message.text}</ReactMarkdown>
                </div>
              ) : (
                message.text
              )}
            </div>
          </div>
        ))}
      </div>
      <footer className={styles.footer}>
        <div className={styles.suggestions} aria-label="Sugestões de perguntas">
          {suggestions.map(([label, command]) => (
            <button
              type="button"
              key={label}
              onClick={() => onSend(command)}
              disabled={isLoading}
            >
              {label}
            </button>
          ))}
        </div>
        <form
          className={styles.composer}
          onSubmit={(event) => {
            event.preventDefault();
            if (value.trim() && !isLoading) onSend();
          }}
        >
          <textarea
            rows={2}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            aria-label="Mensagem para o BruMath"
            placeholder="Pergunte sobre suas finanças…"
            onKeyDown={(event) => {
              if (
                event.key === "Enter" &&
                !event.shiftKey &&
                !event.nativeEvent.isComposing
              ) {
                event.preventDefault();
                if (value.trim() && !isLoading) onSend();
              }
            }}
          />
          <button
            type="submit"
            disabled={!value.trim() || isLoading}
            aria-label="Enviar mensagem"
          >
            <Send size={20} />
          </button>
        </form>
      </footer>
    </section>
  );
}
