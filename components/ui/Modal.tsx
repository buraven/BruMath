import type { ReactNode } from "react";
import { X } from "lucide-react";

export function Modal({ open, title, children, onClose }: { open: boolean; title: string; children: ReactNode; onClose: () => void }) {
  if (!open) return null;

  return (
    <div className="ui-modal-backdrop" role="presentation" onMouseDown={onClose}>
      <div className="ui-modal" role="dialog" aria-modal="true" aria-label={title} onMouseDown={(event) => event.stopPropagation()}>
        <div className="ui-modal-header">
          <h2>{title}</h2>
          <button type="button" className="ui-modal-close" onClick={onClose} aria-label="Fechar">
            <X size={20} />
          </button>
        </div>
        <div className="ui-modal-body">{children}</div>
      </div>
    </div>
  );
}
