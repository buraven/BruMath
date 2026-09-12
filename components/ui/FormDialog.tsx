"use client";

import type { ReactNode } from "react";
import { Receipt, X } from "lucide-react";

type FormDialogProps = {
  title: string;
  children: ReactNode;
  onClose: () => void;
};

/** Shared shell only; each feature owns its fields and submit mapping. */
export function FormDialog({ title, children, onClose }: FormDialogProps) {
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="modal-card" role="dialog" aria-modal="true">
        <div className="modal-header">
          <div>
            <span className="eyebrow">
              <Receipt size={15} /> BruMath
            </span>
            <h2>{title}</h2>
          </div>
          <button
            type="button"
            className="icon-button"
            onClick={onClose}
            aria-label={`Fechar ${title}`}
          >
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
