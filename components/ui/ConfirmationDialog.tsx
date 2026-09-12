"use client";

import { Receipt, Trash2, X } from "lucide-react";
import type { Confirmation } from "../../lib/app/AppTypes";

type ConfirmationDialogProps = {
  confirmation: Confirmation;
  onClose: () => void;
};

/** Shared presentation boundary for already-confirmed product actions. */
export function ConfirmationDialog({
  confirmation,
  onClose,
}: ConfirmationDialogProps) {
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirmation-title"
      >
        <div className="modal-header">
          <div>
            <span className="eyebrow">
              <Receipt size={15} /> BruMath
            </span>
            <h2 id="confirmation-title">{confirmation.title}</h2>
          </div>
          <button
            type="button"
            className="icon-button"
            onClick={onClose}
            aria-label="Fechar confirmação"
          >
            <X size={18} />
          </button>
        </div>
        <p className="confirmation-copy">{confirmation.description}</p>
        {confirmation.details && (
          <dl className="confirmation-details">
            {confirmation.details.map((detail) => (
              <div key={detail.label}>
                <dt>{detail.label}</dt>
                <dd>{detail.value}</dd>
              </div>
            ))}
          </dl>
        )}
        <div className="modal-actions">
          <button type="button" className="secondary-button" onClick={onClose}>
            Cancelar
          </button>
          <button
            type="button"
            className={`primary-button ${confirmation.destructive ? "danger-button" : ""}`}
            onClick={() => {
              confirmation.onConfirm();
              onClose();
            }}
          >
            {confirmation.destructive && <Trash2 size={17} />}
            {confirmation.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
