"use client";

import {
  useLayoutEffect,
  useRef,
  type MutableRefObject,
  type RefObject,
} from "react";
import { Send, Sparkles } from "lucide-react";
import styles from "./AssistantChat.module.css";

type Message = { id: number; role: "assistant" | "user"; text: string };
type Props = {
  profile: string;
  monthLabel: string;
  messages: Message[];
  value: string;
  onChange: (value: string) => void;
  onSend: (value?: string) => void;
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
  messagesRef,
  scrollPosition,
}: Props) {
  const panel = useRef<HTMLElement>(null);
  const previousCount = useRef(messages.length);
  useLayoutEffect(() => {
    const element = panel.current;
    const nav = document.querySelector<HTMLElement>(".bottom-nav");
    if (!element) return;
    window.scrollTo(0, 0);
    const measure = () => {
      const viewportBottom = window.visualViewport
        ? window.visualViewport.height + window.visualViewport.offsetTop
        : window.innerHeight;
      const navigationTop =
        nav && getComputedStyle(nav).display !== "none"
          ? nav.getBoundingClientRect().top
          : (document
              .querySelector<HTMLElement>(".fab-wrap")
              ?.getBoundingClientRect().top ?? viewportBottom);
      const gap =
        Number.parseFloat(
          getComputedStyle(element).getPropertyValue("--space-2"),
        ) || 8;
      element.style.height = `${Math.max(0, Math.min(viewportBottom, navigationTop) - element.getBoundingClientRect().top - gap)}px`;
    };
    measure();
    const observer = new ResizeObserver(measure);
    if (nav) observer.observe(nav);
    const header = document.querySelector(".topbar");
    if (header) observer.observe(header);
    const month = document.querySelector(".page")?.firstElementChild;
    if (month) observer.observe(month);
    const frame = requestAnimationFrame(measure);
    window.addEventListener("resize", measure);
    window.visualViewport?.addEventListener("resize", measure);
    window.visualViewport?.addEventListener("scroll", measure);
    const list = messagesRef.current;
    if (list) list.scrollTop = scrollPosition.current;
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", measure);
      window.visualViewport?.removeEventListener("resize", measure);
      window.visualViewport?.removeEventListener("scroll", measure);
    };
  }, [messagesRef, scrollPosition]);
  useLayoutEffect(() => {
    if (previousCount.current !== messages.length && messagesRef.current) {
      messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
    }
    previousCount.current = messages.length;
  }, [messages.length, messagesRef]);
  return (
    <section
      ref={panel}
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
              {index === 0 && message.role === "assistant"
                ? `Oi, ${profile} 💚 O que vamos organizar hoje?`
                : message.text}
            </div>
          </div>
        ))}
      </div>
      <footer className={styles.footer}>
        <div className={styles.suggestions} aria-label="Sugestões de perguntas">
          {suggestions.map(([label, command]) => (
            <button type="button" key={label} onClick={() => onSend(command)}>
              {label}
            </button>
          ))}
        </div>
        <form
          className={styles.composer}
          onSubmit={(event) => {
            event.preventDefault();
            if (value.trim()) onSend();
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
                if (value.trim()) onSend();
              }
            }}
          />
          <button
            type="submit"
            disabled={!value.trim()}
            aria-label="Enviar mensagem"
          >
            <Send size={20} />
          </button>
        </form>
      </footer>
    </section>
  );
}
