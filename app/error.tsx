"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("BruMath render error:", error);
  }, [error]);

  return (
    <main
      style={{
        minHeight: "100dvh",
        display: "grid",
        placeItems: "center",
        padding: 24,
        background: "var(--bg, #f6f7f9)",
        color: "var(--text, #17191c)",
      }}
    >
      <section
        style={{
          width: "min(100%, 460px)",
          padding: 28,
          borderRadius: 24,
          background: "var(--card, #fff)",
          boxShadow: "0 18px 50px rgba(0,0,0,.08)",
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: 36, marginBottom: 12 }}>💚</div>
        <h1 style={{ margin: "0 0 8px", fontSize: 24 }}>O BruMath encontrou um erro</h1>
        <p style={{ margin: "0 0 20px", opacity: 0.72, lineHeight: 1.5 }}>
          Seus dados locais não foram apagados. Tente carregar a tela novamente.
        </p>
        <button
          type="button"
          onClick={() => reset()}
          style={{
            border: 0,
            borderRadius: 14,
            padding: "12px 18px",
            fontWeight: 700,
            cursor: "pointer",
            background: "#1f8f5f",
            color: "#fff",
          }}
        >
          Tentar novamente
        </button>
      </section>
    </main>
  );
}
