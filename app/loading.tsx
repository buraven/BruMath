export default function Loading() {
  return (
    <main
      aria-label="Carregando BruMath"
      style={{
        minHeight: "100dvh",
        display: "grid",
        placeItems: "center",
        padding: 24,
        background: "var(--bg, #f6f7f9)",
        color: "var(--text, #17191c)",
      }}
    >
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 34, marginBottom: 10 }}>💚</div>
        <strong>Carregando BruMath…</strong>
        <p style={{ margin: "8px 0 0", opacity: 0.65 }}>Preparando seus dados.</p>
      </div>
    </main>
  );
}
