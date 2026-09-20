"use client";

import { useState } from "react";
import type { PersistenceStatus } from "../app/usePersistedFinancialState";
import type { LocalMigrationPreview } from "../../lib/persistence/LocalSnapshotMigration";

type Props = {
  status: PersistenceStatus;
  configured: boolean;
  error: string;
  migrationPreview?: LocalMigrationPreview;
  onSendMagicLink: (email: string) => Promise<void>;
  onImport: () => Promise<void>;
  onRetry: () => Promise<void>;
  onSignOut: () => Promise<void>;
};

export function SupabasePersistencePanel({
  status,
  configured,
  error,
  migrationPreview,
  onSendMagicLink,
  onImport,
  onRetry,
  onSignOut,
}: Props) {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  if (!configured || status === "local") return null;

  const sendLink = async () => {
    try {
      setSending(true);
      setMessage("");
      await onSendMagicLink(email);
      setMessage(
        "Se o acesso estiver autorizado, enviaremos um link para este e-mail.",
      );
    } catch {
      setMessage("Não foi possível enviar o link agora.");
    } finally {
      setSending(false);
    }
  };

  return (
    <section className="persistence-panel" aria-live="polite">
      {status === "loading" && <span>Restaurando sua sessão segura…</span>}
      {status === "auth-required" && (
        <>
          <strong>Conecte sua persistência segura</strong>
          <span>Use seu e-mail para continuar com o Supabase.</span>
          <div className="persistence-actions">
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="seu@email.com"
              aria-label="E-mail para acesso"
            />
            <button
              type="button"
              className="primary-button compact"
              disabled={!email || sending}
              onClick={() => void sendLink()}
            >
              {sending ? "Enviando…" : "Enviar link"}
            </button>
          </div>
          {message && <small>{message}</small>}
          {error && <small>{error}</small>}
        </>
      )}
      {status === "bootstrapping" && (
        <span>Preparando seu espaço financeiro seguro…</span>
      )}
      {status === "migration-required" && (
        <>
          <strong>Migração local disponível</strong>
          <span>
            Seus dados locais serão copiados, reconciliados e preservados neste
            dispositivo.
          </span>
          {migrationPreview && (
            <small>
              Encontramos {migrationPreview.counts.expenses} gastos,{" "}
              {migrationPreview.counts.installments} parcelas,{" "}
              {migrationPreview.counts.receivables} recebíveis,{" "}
              {migrationPreview.counts.incomeEntries} entradas e{" "}
              {migrationPreview.counts.creditCards} cartões.
            </small>
          )}
          <div className="persistence-actions">
            <button
              type="button"
              className="primary-button compact"
              onClick={() => void onImport()}
            >
              Importar dados locais
            </button>
            <button
              type="button"
              className="secondary-button"
              onClick={() => void onSignOut()}
            >
              Continuar localmente
            </button>
          </div>
        </>
      )}
      {status === "migrating" && (
        <span>Importando e conferindo seus dados…</span>
      )}
      {status === "remote" && (
        <div className="persistence-status">
          <span>Dados protegidos no Supabase</span>
          <button
            type="button"
            className="secondary-button"
            onClick={() => void onSignOut()}
          >
            Sair
          </button>
        </div>
      )}
      {status === "remote-error" && (
        <>
          <strong>Não foi possível salvar remotamente</strong>
          <span>{error || "Tente novamente antes de continuar."}</span>
          <div className="persistence-actions">
            <button
              type="button"
              className="primary-button compact"
              onClick={() => void onRetry()}
            >
              Tentar novamente
            </button>
            <button
              type="button"
              className="secondary-button"
              onClick={() => void onSignOut()}
            >
              Sair
            </button>
          </div>
        </>
      )}
    </section>
  );
}
