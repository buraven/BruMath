import type { ReactNode } from "react";
import styles from "./AssistantChat.module.css";

// Presentation contract only; the future action flow owns validation and saving.
export function ActionConfirmation({
  title,
  children,
  onConfirm,
  onEdit,
  onCancel,
  pending = false,
}: {
  title: string;
  children: ReactNode;
  onConfirm: () => void;
  onEdit: () => void;
  onCancel: () => void;
  pending?: boolean;
}) {
  return (
    <section
      className={styles.confirmation}
      aria-label={title}
      aria-busy={pending}
    >
      <h3>{title}</h3>
      <div>{children}</div>
      <div className={styles.confirmationActions}>
        <button type="button" disabled={pending} onClick={onConfirm}>
          Confirmar
        </button>
        <button type="button" disabled={pending} onClick={onEdit}>
          Editar
        </button>
        <button type="button" disabled={pending} onClick={onCancel}>
          Cancelar
        </button>
      </div>
    </section>
  );
}
