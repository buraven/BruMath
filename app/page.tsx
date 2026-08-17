 "use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  CalendarDays,
  Car,
  ChartNoAxesColumn,
  Check,
  ChevronRight,
  CreditCard,
  Home,
  MessageCircle,
  Plus,
  Receipt,
  Send,
  ShoppingCart,
  Sparkles,
  Tag,
  Trash2,
  X,
} from "lucide-react";

type Person = "Bruna" | "Matheus" | "Casal";
type Tab = "home" | "chat" | "stats" | "future";

type Expense = {
  id: number;
  title: string;
  cat: string;
  who: Person;
  amount: number;
  date: string;
  recurring?: boolean;
};

type Installment = {
  id: number;
  title: string;
  category: string;
  who: Person;
  amount: number;
  totalInstallments: number;
  paidInstallments: number;
  nextDue: string;
  status: "em_dia" | "vence_breve";
};

type ChatMessage = {
  id: number;
  role: "assistant" | "user";
  text: string;
};

const INITIAL_EXPENSES: Expense[] = [
  { id: 1, title: "Condomínio", cat: "Casa", who: "Casal", amount: 525, date: "2026-08-01", recurring: true },
  { id: 2, title: "Garagem", cat: "Casa", who: "Casal", amount: 300, date: "2026-08-02", recurring: true },
  { id: 3, title: "Parcela do carro", cat: "Carro", who: "Casal", amount: 1680, date: "2026-08-03", recurring: true },
  { id: 4, title: "Seguro", cat: "Carro", who: "Casal", amount: 500, date: "2026-08-04", recurring: true },
  { id: 5, title: "Internet", cat: "Casa", who: "Casal", amount: 100, date: "2026-08-05", recurring: true },
  { id: 6, title: "Luz", cat: "Casa", who: "Casal", amount: 165, date: "2026-08-06", recurring: true },
  { id: 7, title: "FIES", cat: "Pessoal", who: "Bruna", amount: 553.2, date: "2026-08-07", recurring: true },
  { id: 8, title: "Mercado", cat: "Alimentação", who: "Bruna", amount: 50, date: "2026-08-08" },
  { id: 9, title: "Petisco gatos", cat: "Pets", who: "Casal", amount: 10, date: "2026-08-09" },
];

const INITIAL_INSTALLMENTS: Installment[] = [
  { id: 1, title: "Parcela do carro", category: "Carro", who: "Casal", amount: 1680, totalInstallments: 48, paidInstallments: 8, nextDue: "2026-09-10", status: "em_dia" },
  { id: 2, title: "Parcela do apartamento", category: "Casa", who: "Casal", amount: 1800, totalInstallments: 120, paidInstallments: 18, nextDue: "2026-09-05", status: "em_dia" },
  { id: 3, title: "Seguro", category: "Carro", who: "Casal", amount: 500, totalInstallments: 12, paidInstallments: 3, nextDue: "2026-09-08", status: "em_dia" },
  { id: 4, title: "FIES", category: "Pessoal", who: "Bruna", amount: 553.2, totalInstallments: 60, paidInstallments: 14, nextDue: "2026-09-12", status: "em_dia" },
  { id: 5, title: "Globo", category: "Assinaturas", who: "Casal", amount: 24.9, totalInstallments: 12, paidInstallments: 7, nextDue: "2026-09-03", status: "vence_breve" },
  { id: 6, title: "Rei do Óleo", category: "Carro", who: "Casal", amount: 210, totalInstallments: 6, paidInstallments: 2, nextDue: "2026-09-15", status: "em_dia" },
  { id: 7, title: "Hocks", category: "Pessoal", who: "Bruna", amount: 89.9, totalInstallments: 8, paidInstallments: 3, nextDue: "2026-09-20", status: "em_dia" },
  { id: 8, title: "Lojão", category: "Casa", who: "Matheus", amount: 150, totalInstallments: 10, paidInstallments: 4, nextDue: "2026-09-18", status: "em_dia" },
];

const BUDGETS: Record<string, number> = {
  Casa: 2500,
  Carro: 3000,
  Assinaturas: 500,
  Pets: 650,
  Alimentação: 1400,
  Transporte: 800,
  Lazer: 700,
  Pessoal: 1000,
};

const INCOME = 13000;
const MATHEUS_LIMIT = 350;

const money = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const shortDate = (value: string) =>
  new Date(`${value}T12:00:00`).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  });

function categoryFromText(text: string) {
  const normalized = text.toLowerCase();
  if (/mercado|comida|restaurante|lanche|ifood/.test(normalized)) return "Alimentação";
  if (/gasolina|posto|carro|óleo|seguro/.test(normalized)) return "Carro";
  if (/gato|pet|ração|veterin/.test(normalized)) return "Pets";
  if (/luz|internet|condomínio|garagem|casa|aluguel/.test(normalized)) return "Casa";
  if (/fies|faculdade|curso|pessoal/.test(normalized)) return "Pessoal";
  if (/globo|hocks|assinatura|streaming/.test(normalized)) return "Assinaturas";
  if (/ônibus|uber|99/.test(normalized)) return "Transporte";
  return "Outros";
}

function iconFor(category: string) {
  if (category === "Carro") return <Car size={19} />;
  if (category === "Pets") return <span className="emoji-icon">🐱</span>;
  if (category === "Alimentação") return <ShoppingCart size={19} />;
  if (category === "Casa") return <Home size={19} />;
  if (category === "Assinaturas") return <CreditCard size={19} />;
  return <Tag size={19} />;
}

function buildAssistantReply(
  input: string,
  expenses: Expense[],
  installments: Installment[],
) {
  const text = input.trim().toLowerCase();
  const totalSpent = expenses.reduce((sum, item) => sum + item.amount, 0);
  const available = INCOME - totalSpent;
  const installmentTotal = installments.reduce((sum, item) => sum + item.amount, 0);
  const next = [...installments].sort((a, b) => a.nextDue.localeCompare(b.nextDue))[0];

  if (!text) return "Pode mandar a pergunta. Eu consigo consultar os gastos, orçamento e parcelas.";

  if (/resumo|resumir|como estamos|situação/.test(text)) {
    return `Resumo de agosto: ${money(totalSpent)} em ${expenses.length} lançamentos. Sobram ${money(available)} da renda de ${money(INCOME)}. Há ${installments.length} parcelas ativas, somando ${money(installmentTotal)} por mês.`;
  }

  if (/quanto temos|quanto tem|disponível|saldo|sobrou/.test(text)) {
    return `Neste mês, já foram registrados ${money(totalSpent)}. Considerando a renda de ${money(INCOME)}, o disponível calculado é ${money(available)}.`;
  }

  if (/parcela|parcelas|futuro|prestações/.test(text)) {
    return `Temos ${installments.length} parcelas ativas. A próxima é ${next.title}, ${money(next.amount)}, com vencimento em ${shortDate(next.nextDue)}. Na aba Futuro você pode ver quantas já foram pagas e quantas faltam em cada uma.`;
  }

  const amountMatch = input.match(/(?:r\$?\s*)?(\d+(?:[.,]\d{1,2})?)/i);
  const amount = amountMatch ? Number(amountMatch[1].replace(".", "").replace(",", ".")) : null;

  if (/gastei|gasto|paguei|comprei|custou/.test(text) && amount !== null && amount > 0) {
    const category = categoryFromText(text);
    return `Entendi. Registrei ${money(amount)} em ${category}. O lançamento foi adicionado aos gastos e os totais foram recalculados.`;
  }

  if (/ajuda|o que você|comandos|pode fazer/.test(text)) {
    return "Posso registrar gastos, mostrar um resumo, calcular o disponível, consultar parcelas e explicar o orçamento. Pode escrever do jeito que você falaria normalmente.";
  }

  return "Entendi. Posso ajudar com gastos, orçamento e parcelas. Tente algo como “gastei 85 no mercado”, “me dá um resumo”, “quanto temos?” ou “quais parcelas faltam?”.";
}

export default function Page() {
  const [tab, setTab] = useState<Tab>("home");
  const [expenses, setExpenses] = useState<Expense[]>(INITIAL_EXPENSES);
  const [installments] = useState<Installment[]>(INITIAL_INSTALLMENTS);
  const [text, setText] = useState("");
  const [chat, setChat] = useState<ChatMessage[]>([
    {
      id: 1,
      role: "assistant",
      text: "Oi! 💚 Pode falar normalmente comigo. Eu consigo registrar gastos, consultar o orçamento e acompanhar as parcelas.",
    },
  ]);
  const [toast, setToast] = useState("");
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({
    title: "",
    amount: "",
    cat: "Outros",
    who: "Bruna" as Person,
  });

  useEffect(() => {
    const saved = window.localStorage.getItem("brumath-expenses");
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as Expense[];
        if (Array.isArray(parsed)) setExpenses(parsed);
      } catch {
        // Mantém os dados iniciais quando o armazenamento local estiver inválido.
      }
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem("brumath-expenses", JSON.stringify(expenses));
  }, [expenses]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 2200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const totalSpent = useMemo(
    () => expenses.reduce((sum, item) => sum + item.amount, 0),
    [expenses],
  );

  const available = Math.max(0, INCOME - totalSpent);
  const usedPercent = Math.min(100, (totalSpent / INCOME) * 100);

  const categoryTotals = useMemo(() => {
    return Object.entries(BUDGETS).map(([category, budget]) => {
      const spent = expenses
        .filter((item) => item.cat === category)
        .reduce((sum, item) => sum + item.amount, 0);
      return { category, budget, spent, percent: Math.min(100, (spent / budget) * 100) };
    });
  }, [expenses]);

  const futureTotal = installments.reduce((sum, item) => sum + item.amount, 0);
  const remainingInstallments = installments.reduce(
    (sum, item) => sum + (item.totalInstallments - item.paidInstallments),
    0,
  );

  const send = (preset?: string) => {
    const value = (preset ?? text).trim();
    if (!value) return;

    const amountMatch = value.match(/(?:r\$?\s*)?(\d+(?:[.,]\d{1,2})?)/i);
    const amount = amountMatch ? Number(amountMatch[1].replace(".", "").replace(",", ".")) : null;

    if (amount !== null && amount > 0 && /gastei|gasto|paguei|comprei|custou/i.test(value)) {
      const category = categoryFromText(value);
      const title = value
        .replace(/(?:gastei|gasto|paguei|comprei|custou)/i, "")
        .replace(/r\$?\s*\d+(?:[.,]\d{1,2})?/i, "")
        .replace(/\bno\b|\bna\b|\bem\b|\bde\b/gi, " ")
        .trim()
        .replace(/\s+/g, " ");

      const newExpense: Expense = {
        id: Date.now(),
        title: title ? title.charAt(0).toUpperCase() + title.slice(1) : "Novo gasto",
        cat: category,
        who: /matheus/i.test(value) ? "Matheus" : "Bruna",
        amount,
        date: new Date().toISOString().slice(0, 10),
      };

      setExpenses((current) => [newExpense, ...current]);
      setChat((current) => [
        ...current,
        { id: Date.now(), role: "user", text: value },
        {
          id: Date.now() + 1,
          role: "assistant",
          text: `Registrei ${money(amount)} em ${category}. Seu disponível agora é ${money(Math.max(0, INCOME - totalSpent - amount))}.`,
        },
      ]);
      setText("");
      setToast("Gasto registrado 💚");
      return;
    }

    setChat((current) => [
      ...current,
      { id: Date.now(), role: "user", text: value },
      {
        id: Date.now() + 1,
        role: "assistant",
        text: buildAssistantReply(value, expenses, installments),
      },
    ]);
    setText("");
  };

  const saveExpense = (event: FormEvent) => {
    event.preventDefault();
    const amount = Number(form.amount.replace(",", "."));
    if (!form.title.trim() || !Number.isFinite(amount) || amount <= 0) {
      setToast("Preencha descrição e valor.");
      return;
    }

    setExpenses((current) => [
      {
        id: Date.now(),
        title: form.title.trim(),
        amount,
        cat: form.cat,
        who: form.who,
        date: new Date().toISOString().slice(0, 10),
      },
      ...current,
    ]);

    setForm({ title: "", amount: "", cat: "Outros", who: "Bruna" });
    setModal(false);
    setToast("Gasto adicionado 💚");
  };

  const removeExpense = (id: number) => {
    setExpenses((current) => current.filter((item) => item.id !== id));
    setToast("Gasto removido.");
  };

  return (
    <div className="app-shell">
      {toast && <div className="toast">{toast}</div>}

      <header className="topbar">
        <div>
          <div className="brand">Bru<span>Math</span> <span className="heart">💚</span></div>
          <div className="subtitle">Finanças de Bruna &amp; Matheus</div>
        </div>
        <button className="avatar" type="button" onClick={() => setToast("Perfil do casal")}>BM</button>
      </header>

      <main className="page">
        {tab === "home" && (
          <>
            <section className="hero">
              <div>
                <small>Disponível em agosto</small>
                <div className="hero-amount">{money(available)}</div>
                <div className="progress-track">
                  <div className="progress-fill" style={{ width: `${Math.max(3, usedPercent)}%` }} />
                </div>
                <div className="progress-labels">
                  <span>Usado {money(totalSpent)}</span>
                  <span>Renda {money(INCOME)}</span>
                </div>
              </div>
            </section>

            <section className="summary-grid">
              <div className="metric-card">
                <span>Limite Matheus</span>
                <strong>{money(MATHEUS_LIMIT)}</strong>
              </div>
              <button className="metric-card metric-button" type="button" onClick={() => setTab("future")}>
                <span>Parcelas</span>
                <strong>{installments.length} ativas</strong>
                <ChevronRight size={18} />
              </button>
            </section>

            <section className="section">
              <div className="section-title">
                <h2>Assistente</h2>
                <span className="online"><i /> online</span>
              </div>

              <div className="chat-preview">
                <div className="bubble assistant-bubble">
                  {chat[chat.length - 1]?.role === "assistant"
                    ? chat[chat.length - 1].text
                    : "Oi! 💚 Pode falar normalmente comigo."}
                </div>
                <div className="quick-actions">
                  <button type="button" onClick={() => send("Quanto temos?")}>Quanto temos?</button>
                  <button type="button" onClick={() => send("Resumo")}>Resumo</button>
                  <button type="button" onClick={() => send("Parcelas")}>Parcelas</button>
                </div>
                <div className="input-row">
                  <input
                    value={text}
                    onChange={(event) => setText(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") send();
                    }}
                    placeholder="Ex.: gastei 50 no mercado"
                  />
                  <button className="send-button" type="button" onClick={() => send()}>
                    <Send size={17} />
                    <span>Enviar</span>
                  </button>
                </div>
                <button className="open-chat" type="button" onClick={() => setTab("chat")}>
                  Abrir conversa completa <ChevronRight size={16} />
                </button>
              </div>
            </section>

            <section className="section">
              <div className="section-title">
                <h2>Últimos gastos</h2>
                <span className="muted">Agosto</span>
              </div>

              <div className="expense-list">
                {expenses.slice(0, 9).map((expense) => (
                  <div className="expense-row" key={expense.id}>
                    <div className="expense-icon">{iconFor(expense.cat)}</div>
                    <div className="expense-info">
                      <strong>{expense.title}</strong>
                      <span>{expense.cat} · {expense.who}</span>
                    </div>
                    <strong className="expense-amount">{money(expense.amount)}</strong>
                    <button
                      className="delete-button"
                      type="button"
                      aria-label={`Remover ${expense.title}`}
                      onClick={() => removeExpense(expense.id)}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}

        {tab === "chat" && (
          <section className="chat-page">
            <div className="page-heading">
              <div>
                <span className="eyebrow"><MessageCircle size={15} /> Assistente</span>
                <h1>Conversa com o BruMath</h1>
                <p>Fale naturalmente. O assistente consulta os dados que estão na tela.</p>
              </div>
              <span className="online"><i /> online</span>
            </div>

            <div className="full-chat">
              <div className="messages">
                {chat.map((message) => (
                  <div className={`message ${message.role}`} key={message.id}>
                    <div className="message-avatar">{message.role === "assistant" ? "💚" : "BM"}</div>
                    <div className="message-content">{message.text}</div>
                  </div>
                ))}
              </div>

              <div className="chat-composer">
                <div className="quick-actions">
                  <button type="button" onClick={() => send("Quanto temos?")}>Quanto temos?</button>
                  <button type="button" onClick={() => send("Resumo")}>Resumo</button>
                  <button type="button" onClick={() => send("Parcelas")}>Parcelas</button>
                  <button type="button" onClick={() => send("O que você pode fazer?")}>Ajuda</button>
                </div>
                <div className="input-row">
                  <input
                    value={text}
                    onChange={(event) => setText(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") send();
                    }}
                    placeholder="Digite uma mensagem..."
                  />
                  <button className="send-button" type="button" onClick={() => send()}>
                    <Send size={17} />
                    <span>Enviar</span>
                  </button>
                </div>
              </div>
            </div>
          </section>
        )}

        {tab === "stats" && (
          <section className="section">
            <div className="page-heading">
              <div>
                <span className="eyebrow"><ChartNoAxesColumn size={15} /> Categorias</span>
                <h1>Orçamento por categoria</h1>
                <p>Veja quanto já foi usado em cada limite.</p>
              </div>
            </div>

            <div className="category-grid">
              {categoryTotals.map((item) => (
                <div className="category-card" key={item.category}>
                  <div className="category-head">
                    <div className="category-icon">{iconFor(item.category)}</div>
                    <div>
                      <strong>{item.category}</strong>
                      <span>{money(item.spent)} de {money(item.budget)}</span>
                    </div>
                    <b>{Math.round(item.percent)}%</b>
                  </div>
                  <div className="progress-track small">
                    <div className="progress-fill" style={{ width: `${Math.max(item.spent ? 4 : 0, item.percent)}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {tab === "future" && (
          <section className="section future-page">
            <div className="page-heading">
              <div>
                <span className="eyebrow"><CalendarDays size={15} /> Futuro</span>
                <h1>Parcelas e compromissos</h1>
                <p>Agora você consegue ver o que é cada parcela, o valor, quantas já foram pagas e quantas ainda faltam.</p>
              </div>
            </div>

            <div className="future-summary">
              <div>
                <span>Parcelas ativas</span>
                <strong>{installments.length}</strong>
              </div>
              <div>
                <span>Compromisso mensal</span>
                <strong>{money(futureTotal)}</strong>
              </div>
              <div>
                <span>Parcelas restantes</span>
                <strong>{remainingInstallments}</strong>
              </div>
            </div>

            <div className="installment-list">
              {installments.map((item) => {
                const remaining = item.totalInstallments - item.paidInstallments;
                const paidPercent = (item.paidInstallments / item.totalInstallments) * 100;

                return (
                  <article className="installment-card" key={item.id}>
                    <div className="installment-icon">{iconFor(item.category)}</div>
                    <div className="installment-main">
                      <div className="installment-title-row">
                        <div>
                          <strong>{item.title}</strong>
                          <span>{item.category} · {item.who}</span>
                        </div>
                        <strong>{money(item.amount)}/mês</strong>
                      </div>

                      <div className="installment-details">
                        <div><span>Pagas</span><b>{item.paidInstallments}</b></div>
                        <div><span>Faltam</span><b>{remaining}</b></div>
                        <div><span>Total</span><b>{item.totalInstallments}</b></div>
                        <div><span>Próximo vencimento</span><b>{shortDate(item.nextDue)}</b></div>
                      </div>

                      <div className="installment-progress">
                        <div className="progress-track small">
                          <div className="progress-fill" style={{ width: `${paidPercent}%` }} />
                        </div>
                        <span>{Math.round(paidPercent)}% concluído</span>
                      </div>
                    </div>

                    <span className={`status ${item.status}`}>
                      {item.status === "vence_breve" ? "Vence em breve" : "Em dia"}
                    </span>
                  </article>
                );
              })}
            </div>

            <div className="future-note">
              <Sparkles size={18} />
              <div>
                <strong>Visão completa</strong>
                <span>As quantidades de pagas e restantes ficam vinculadas a cada compromisso, em vez de aparecerem como uma lista estática.</span>
              </div>
            </div>
          </section>
        )}
      </main>

      <button className="floating-add" type="button" onClick={() => setModal(true)} aria-label="Adicionar gasto">
        <Plus size={25} />
      </button>

      <nav className="bottom-nav" aria-label="Navegação principal">
        <button className={tab === "home" ? "active" : ""} type="button" onClick={() => setTab("home")}>
          <Home size={20} /><span>Início</span>
        </button>
        <button className={tab === "chat" ? "active" : ""} type="button" onClick={() => setTab("chat")}>
          <MessageCircle size={20} /><span>Assistente</span>
        </button>
        <button className={tab === "stats" ? "active" : ""} type="button" onClick={() => setTab("stats")}>
          <ChartNoAxesColumn size={20} /><span>Categorias</span>
        </button>
        <button className={tab === "future" ? "active" : ""} type="button" onClick={() => setTab("future")}>
          <CalendarDays size={20} /><span>Futuro</span>
        </button>
      </nav>

      {modal && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setModal(false)}>
          <div className="modal-card" onMouseDown={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <div>
                <span className="eyebrow"><Receipt size={15} /> Novo gasto</span>
                <h2>Adicionar gasto</h2>
              </div>
              <button className="icon-button" type="button" onClick={() => setModal(false)} aria-label="Fechar">
                <X size={19} />
              </button>
            </div>

            <form onSubmit={saveExpense}>
              <label className="field">
                <span>O que foi?</span>
                <input
                  value={form.title}
                  onChange={(event) => setForm({ ...form, title: event.target.value })}
                  placeholder="Ex.: Mercado"
                  required
                />
              </label>

              <label className="field">
                <span>Valor</span>
                <input
                  value={form.amount}
                  onChange={(event) => setForm({ ...form, amount: event.target.value })}
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="0,00"
                  required
                />
              </label>

              <div className="form-grid">
                <label className="field">
                  <span>Categoria</span>
                  <select value={form.cat} onChange={(event) => setForm({ ...form, cat: event.target.value })}>
                    {Object.keys(BUDGETS).concat("Outros").map((category) => (
                      <option key={category}>{category}</option>
                    ))}
                  </select>
                </label>

                <label className="field">
                  <span>Quem</span>
                  <select
                    value={form.who}
                    onChange={(event) => setForm({ ...form, who: event.target.value as Person })}
                  >
                    <option>Bruna</option>
                    <option>Matheus</option>
                    <option>Casal</option>
                  </select>
                </label>
              </div>

              <button className="primary-button" type="submit">
                <Check size={17} /> Salvar gasto
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
