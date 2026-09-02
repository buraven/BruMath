export default function NotFound() {
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
      <section style={{ textAlign: "center" }}>
        <div style={{ fontSize: 34, marginBottom: 10 }}>🧭</div>
        <h1 style={{ margin: 0 }}>Página não encontrada</h1>
        <p style={{ margin: "8px 0 18px", opacity: 0.65 }}>
          Esse endereço não existe no BruMath.
        </p>
        <a href="/" style={{ fontWeight: 700 }}>Voltar para o início</a>
      </section>
    </main>
  );
}
