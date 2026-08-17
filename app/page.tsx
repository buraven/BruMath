 "use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  CalendarDays,
  Car,
  ChartNoAxesColumn,
  Check,
  ChevronRight,
  CreditCard,
  Home,
  MessageCircle,
  Pencil,
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
  settled?: boolean;
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

const CATEGORY_ALIASES: Record<string, string[]> = {
  Casa: ["casa", "aluguel", "condomínio", "condominio", "garagem", "internet", "luz", "água", "agua"],
  Carro: ["carro", "gasolina", "posto", "óleo", "oleo", "seguro", "oficina", "manutenção", "manutencao"],
  Pets: ["gato", "gatos", "pet", "ração", "racao", "veterinário", "veterinario", "petisco"],
  Alimentação: ["mercado", "comida", "restaurante", "lanche", "ifood", "café", "cafe", "doce", "doces", "pedindo comida"],
  Pessoal: ["fies", "faculdade", "curso", "pessoal"],
  Assinaturas: ["globo", "hocks", "assinatura", "streaming", "netflix", "spotify"],
  Transporte: ["ônibus", "onibus", "uber", "99", "transporte"],
  Lazer: ["cinema", "bar", "viagem", "lazer"],
};

const INCOME = 13000;
const BRUNA_LIMIT = 600;
const MATHEUS_LIMIT = 350;

const money = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const shortDate = (value: string) =>
  new Date(`${value}T12:00:00`).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  });

const isoToday = () => new Date().toISOString().slice(0, 10);

function detectCategory(text: string) {
  const normalized = text.toLowerCase();
  for (const [category, aliases] of Object.entries(CATEGORY_ALIASES)) {
    if (aliases.some((alias) => normalized.includes(alias))) return category;
  }
  return "Outros";
}

function detectPerson(text: string): Person | null {
  const normalized = text.toLowerCase();
  if (/\b(bruna|bru)\b/.test(normalized)) return "Bruna";
  if (/\b(matheus|theus)\b/.test(normalized)) return "Matheus";
  if (/\b(casal|nós|nos|juntos|juntas|os dois|os dois)\b/.test(normalized)) return "Casal";
  return null;
}

function parseAmount(input: string) {
  const match = input.match(/(?:r\$\s*)?(\d{1,3}(?:\.\d{3})*(?:,\d{1,2})?|\d+(?:[.,]\d{1,2})?)/i);
  if (!match) return null;
  const raw = match[1];
  const normalized = raw.includes(",")
    ? raw.replace(/\./g, "").replace(",", ".")
    : raw;
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

function cleanExpenseTitle(input: string) {
  return input
    .replace(/(?:gastei|gasto|paguei|comprei|custou|paguei)\b/gi, "")
    .replace(/(?:r\$\s*)?(\d{1,3}(?:\.\d{3})*(?:,\d{1,2})?|\d+(?:[.,]\d{1,2})?)/i, "")
    .replace(/\b(?:a|o|no|na|em|de|do|da|com|para)\b/gi, " ")
    .replace(/\b(?:bruna|bru|matheus|theus|casal|nós|nos|juntos|juntas)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^[\s:,-]+|[\s:,-]+$/g, "");
}

function iconFor(category: string) {
  if (category === "Carro") return <Car size={19} />;
  if (category === "Pets") return <span className="emoji-icon">🐱</span>;
  if (category === "Alimentação") return <ShoppingCart size={19} />;
  if (category === "Casa") return <Home size={19} />;
  if (category === "Assinaturas") return <CreditCard size={19} />;
  if (category === "Pessoal") return <Receipt size={19} />;
  return <Tag size={19} />;
}

function buildAssistantReply(
  input: string,
  expenses: Expense[],
  installments: Installment[],
  brunaLimit: number,
  matheusLimit: number,
) {
  const text = input.trim().toLowerCase();
  const totalSpent = expenses.reduce((sum, item) => sum + item.amount, 0);
  const available = INCOME - totalSpent;
  const installmentTotal = installments
    .filter((item) => !item.settled)
    .reduce((sum, item) => sum + item.amount, 0);
  const next = [...installments]
    .filter((item) => !item.settled)
    .sort((a, b) => a.nextDue.localeCompare(b.nextDue))[0];

  if (!text) return "Pode mandar a pergunta. Eu consigo consultar gastos, orçamento e parcelas.";

  if (/resumo|resumir|como estamos|situação/.test(text)) {
    return `Resumo: ${money(totalSpent)} em ${expenses.length} lançamentos. Disponível pela renda cadastrada: ${money(Math.max(0, available))}. Há ${installments.filter((item) => !item.settled).length} compromissos parcelados ativos.`;
  }

  if (/quanto temos|quanto tem|disponível|saldo|sobrou/.test(text)) {
    return `Neste mês, já foram registrados ${money(totalSpent)}. Considerando a renda de ${money(INCOME)}, o disponível calculado é ${money(Math.max(0, available))}.`;
  }

  if (/bruna/.test(text) && /limite|gastar|disponível/.test(text)) {
    const spent = expenses.filter((item) => item.who === "Bruna").reduce((sum, item) => sum + item.amount, 0);
    return `Limite da Bruna: ${money(brunaLimit)}. Já registrados para a Bruna: ${money(spent)}.`;
  }

  if (/matheus/.test(text) && /limite|gastar|disponível/.test(text)) {
    const spent = expenses.filter((item) => item.who === "Matheus").reduce((sum, item) => sum + item.amount, 0);
    return `Limite do Matheus: ${money(matheusLimit)}. Já registrados para o Matheus: ${money(spent)}.`;
  }

  if (/parcela|parcelas|futuro|prestações|prestação/.test(text)) {
    if (!next) return "Não há parcelas ativas cadastradas.";
    return `Há ${installments.filter((item) => !item.settled).length} compromissos ativos. A próxima é ${next.title}, ${money(next.amount)}/mês, vencendo em ${shortDate(next.nextDue)}. Na aba Futuro você vê pagas, faltantes, total e pode quitar ou adiantar parcelas.`;
  }

  if (/ajuda|o que você|comandos|pode fazer/.test(text)) {
    return "Posso registrar gastos, consultar limites, mostrar resumo, calcular disponível, consultar parcelas e ajudar a corrigir um lançamento. Quando você disser quem gastou, eu salvo Bruna, Matheus ou Casal. Se não disser, eu pergunto antes de registrar.";
  }

  if (/gastei|gasto|paguei|comprei|custou/.test(text)) {
    return "Posso registrar esse gasto. Só preciso do valor e, quando não estiver claro, de saber se foi Bruna, Matheus ou Casal.";
  }

  return "Entendi. Posso ajudar com gastos, orçamento e parcelas. Tente “gastei 85 no mercado”, “Bruna gastou 35 no café”, “quanto temos?” ou “quais parcelas faltam?”.";
}

export default function Page() {
  const [tab, setTab] = useState<Tab>("home");
  const [expenses, setExpenses] = useState<Expense[]>(INITIAL_EXPENSES);
  const [installments, setInstallments] = useState<Installment[]>(INITIAL_INSTALLMENTS);
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
  const [installmentModal, setInstallmentModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: "",
    amount: "",
    cat: "Outros",
    who: "Bruna" as Person,
  });
  const [installmentForm, setInstallmentForm] = useState({
    title: "",
    amount: "",
    category: "Outros",
    who: "Bruna" as Person,
    total: "12",
    paid: "0",
    nextDue: "",
  });

  const messagesRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    try {
      const savedExpenses = window.localStorage.getItem("brumath-expenses");
      if (savedExpenses) {
        const parsed = JSON.parse(savedExpenses) as Expense[];
        if (Array.isArray(parsed)) setExpenses(parsed);
      }
      const savedInstallments = window.localStorage.getItem("brumath-installments");
      if (savedInstallments) {
        const parsed = JSON.parse(savedInstallments) as Installment[];
        if (Array.isArray(parsed)) setInstallments(parsed);
      }
      const savedChat = window.localStorage.getItem("brumath-chat");
      if (savedChat) {
        const parsed = JSON.parse(savedChat) as ChatMessage[];
        if (Array.isArray(parsed) && parsed.length) setChat(parsed);
      }
    } catch {
      // Usa os dados iniciais se o localStorage estiver inválido.
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem("brumath-expenses", JSON.stringify(expenses));
  }, [expenses]);

  useEffect(() => {
    window.localStorage.setItem("brumath-installments", JSON.stringify(installments));
  }, [installments]);

  useEffect(() => {
    window.localStorage.setItem("brumath-chat", JSON.stringify(chat));
  }, [chat]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 2200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (tab !== "chat") return;
    const element = messagesRef.current;
    if (!element) return;
    requestAnimationFrame(() => {
      element.scrollTop = element.scrollHeight;
    });
  }, [chat, tab]);

  const totalSpent = useMemo(
    () => expenses.reduce((sum, item) => sum + item.amount, 0),
    [expenses],
  );

  const available = Math.max(0, INCOME - totalSpent);
  const usedPercent = Math.min(100, (totalSpent / INCOME) * 100);

  const categoryTotals = useMemo(() => {
    const categories = [...Object.keys(BUDGETS), "Outros"];
    return categories.map((category) => {
      const budget = BUDGETS[category] ?? 0;
      const spent = expenses
        .filter((item) => item.cat === category)
        .reduce((sum, item) => sum + item.amount, 0);
      return {
        category,
        budget,
        spent,
        percent: budget > 0 ? Math.min(100, (spent / budget) * 100) : spent > 0 ? 100 : 0,
      };
    });
  }, [expenses]);

  const brunaSpent = expenses.filter((item) => item.who === "Bruna").reduce((sum, item) => sum + item.amount, 0);
  const matheusSpent = expenses.filter((item) => item.who === "Matheus").reduce((sum, item) => sum + item.amount, 0);

  const futureTotal = installments
    .filter((item) => !item.settled)
    .reduce((sum, item) => sum + item.amount, 0);

  const remainingInstallments = installments
    .filter((item) => !item.settled)
    .reduce((sum, item) => sum + Math.max(0, item.totalInstallments - item.paidInstallments), 0);

  const registerExpense = (value: string) => {
    const amount = parseAmount(value);
    if (!amount || amount <= 0) return false;

    const person = detectPerson(value);
    if (!person) {
      setChat((current) => [
        ...current,
        { id: Date.now(), role: "user", text: value },
        {
          id: Date.now() + 1,
          role: "assistant",
          text: `Entendi o gasto de ${money(amount)}, mas não ficou claro quem gastou. Foi Bruna, Matheus ou Casal?`,
        },
      ]);
      setText("");
      return true;
    }

    const category = detectCategory(value);
    const title = cleanExpenseTitle(value) || "Novo gasto";
    const newExpense: Expense = {
      id: Date.now(),
      title: title.charAt(0).toUpperCase() + title.slice(1),
      cat: category,
      who: person,
      amount,
      date: isoToday(),
    };

    setExpenses((current) => [newExpense, ...current]);
    setChat((current) => [
      ...current,
      { id: Date.now(), role: "user", text: value },
      {
        id: Date.now() + 1,
        role: "assistant",
        text: `Registrei ${money(amount)} em ${category} para ${person}. O valor já entrou nos totais e no orçamento.`,
      },
    ]);
    setText("");
    setToast("Gasto registrado 💚");
    return true;
  };

  const send = (preset?: string) => {
    const value = (preset ?? text).trim();
    if (!value) return;

    const looksLikeExpense = /gastei|gasto|paguei|comprei|custou|pedi|pedimos|gastamos/i.test(value);
    if (looksLikeExpense && parseAmount(value)) {
      registerExpense(value);
      return;
    }

    setChat((current) => [
      ...current,
      { id: Date.now(), role: "user", text: value },
      {
        id: Date.now() + 1,
        role: "assistant",
        text: buildAssistantReply(value, expenses, installments, BRUNA_LIMIT, MATHEUS_LIMIT),
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
        date: isoToday(),
      },
      ...current,
    ]);

    setForm({ title: "", amount: "", cat: "Outros", who: "Bruna" });
    setModal(false);
    setToast("Gasto adicionado 💚");
  };

  const saveInstallment = (event: FormEvent) => {
    event.preventDefault();
    const amount = Number(installmentForm.amount.replace(",", "."));
    const total = Number(installmentForm.total);
    const paid = Number(installmentForm.paid);
    if (
      !installmentForm.title.trim() ||
      !Number.isFinite(amount) ||
      amount <= 0 ||
      !Number.isInteger(total) ||
      total <= 0 ||
      !Number.isInteger(paid) ||
      paid < 0 ||
      paid > total ||
      !installmentForm.nextDue
    ) {
      setToast("Confira os dados da parcela.");
      return;
    }

    setInstallments((current) => [
      ...current,
      {
        id: Date.now(),
        title: installmentForm.title.trim(),
        category: installmentForm.category,
        who: installmentForm.who,
        amount,
        totalInstallments: total,
        paidInstallments: paid,
        nextDue: installmentForm.nextDue,
        status: "em_dia",
      },
    ]);

    setInstallmentForm({
      title: "",
      amount: "",
      category: "Outros",
      who: "Bruna",
      total: "12",
      paid: "0",
      nextDue: "",
    });
    setInstallmentModal(false);
    setToast("Parcelado adicionado 💚");
  };

  const advanceInstallment = (id: number, amount = 1) => {
    setInstallments((current) =>
      current.map((item) => {
        if (item.id !== id || item.settled) return item;
        const paid = Math.min(item.totalInstallments, item.paidInstallments + amount);
        return {
          ...item,
          paidInstallments: paid,
          settled: paid >= item.totalInstallments,
          status: paid >= item.totalInstallments ? "em_dia" : item.status,
        };
      }),
    );
    setToast(amount > 1 ? `${amount} parcelas adiantadas.` : "Parcela quitada/baixada.");
  };

  const settleInstallment = (id: number) => {
    setInstallments((current) =>
      current.map((item) =>
        item.id === id
          ? { ...item, paidInstallments: item.totalInstallments, settled: true }
          : item,
      ),
    );
    setToast("Compromisso quitado 💚");
  };

  const removeExpense = (id: number) => {
    setExpenses((current) => current.filter((item) => item.id !== id));
    setToast("Gasto removido.");
  };

  const openCategory = (category: string) => {
    setEditingCategory(category);
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
                <strong>{money(MATHEUS_LIMIT - matheusSpent)}</strong>
                <small>de {money(MATHEUS_LIMIT)} disponíveis</small>
              </div>
              <div className="metric-card">
                <span>Limite Bruna</span>
                <strong>{money(Math.max(0, BRUNA_LIMIT - brunaSpent))}</strong>
                <small>de {money(BRUNA_LIMIT)} disponíveis</small>
              </div>
              <button className="metric-card metric-button" type="button" onClick={() => setTab("future")}>
                <span>Parcelas</span>
                <strong>{installments.filter((item) => !item.settled).length} ativas</strong>
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
                    placeholder="Ex.: Bruna gastou 50 no mercado"
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
                {expenses.slice(0, 12).map((expense) => (
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
              <div className="messages" ref={messagesRef}>
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
                <p>Toque em uma categoria para abrir os gastos que formam aquele total.</p>
              </div>
            </div>

            <div className="category-grid">
              {categoryTotals.map((item) => (
                <button className="category-card" key={item.category} type="button" onClick={() => openCategory(item.category)}>
                  <div className="category-head">
                    <div className="category-icon">{iconFor(item.category)}</div>
                    <div>
                      <strong>{item.category}</strong>
                      <span>{money(item.spent)} {item.budget ? `de ${money(item.budget)}` : "registrados"}</span>
                    </div>
                    <b>{Math.round(item.percent)}%</b>
                  </div>
                  <div className="progress-track small">
                    <div className="progress-fill" style={{ width: `${Math.max(item.spent ? 4 : 0, item.percent)}%` }} />
                  </div>
                </button>
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
                <p>Veja o valor mensal, histórico, quantidade restante, próximo vencimento e ações de quitação/adiantamento.</p>
              </div>
              <button className="primary-button compact" type="button" onClick={() => setInstallmentModal(true)}>
                <Plus size={17} /> Novo parcelado
              </button>
            </div>

            <div className="future-summary">
              <div>
                <span>Parcelas ativas</span>
                <strong>{installments.filter((item) => !item.settled).length}</strong>
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
                const remaining = Math.max(0, item.totalInstallments - item.paidInstallments);
                const paidPercent = item.totalInstallments ? (item.paidInstallments / item.totalInstallments) * 100 : 0;

                return (
                  <article className={`installment-card ${item.settled ? "settled" : ""}`} key={item.id}>
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
                        <div><span>Próximo vencimento</span><b>{item.settled ? "Quitado" : shortDate(item.nextDue)}</b></div>
                      </div>

                      <div className="installment-progress">
                        <div className="progress-track small">
                          <div className="progress-fill" style={{ width: `${paidPercent}%` }} />
                        </div>
                        <span>{Math.round(paidPercent)}% concluído</span>
                      </div>

                      {!item.settled && (
                        <div className="installment-actions">
                          <button type="button" onClick={() => advanceInstallment(item.id, 1)}>
                            <Check size={15} /> Pagar 1
                          </button>
                          <button type="button" onClick={() => advanceInstallment(item.id, 2)}>
                            +2 adiantadas
                          </button>
                          <button type="button" onClick={() => settleInstallment(item.id)}>
                            Quitar
                          </button>
                        </div>
                      )}
                    </div>

                    <span className={`status ${item.status}`}>
                      {item.settled ? "Quitado" : item.status === "vence_breve" ? "Vence em breve" : "Em dia"}
                    </span>
                  </article>
                );
              })}
            </div>

            <div className="future-note">
              <Sparkles size={18} />
              <div>
                <strong>Controle de parcelados</strong>
                <span>Você pode cadastrar novos compromissos, baixar uma parcela, adiantar duas ou quitar tudo. O progresso fica salvo no navegador.</span>
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

      {editingCategory && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setEditingCategory(null)}>
          <div className="modal-card category-modal" onMouseDown={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <div>
                <span className="eyebrow">{iconFor(editingCategory)} Categoria</span>
                <h2>{editingCategory}</h2>
              </div>
              <button className="icon-button" type="button" onClick={() => setEditingCategory(null)} aria-label="Fechar">
                <X size={19} />
              </button>
            </div>
            <div className="category-expenses">
              {expenses.filter((expense) => expense.cat === editingCategory).length ? (
                expenses.filter((expense) => expense.cat === editingCategory).map((expense) => (
                  <div className="expense-row" key={expense.id}>
                    <div className="expense-icon">{iconFor(expense.cat)}</div>
                    <div className="expense-info">
                      <strong>{expense.title}</strong>
                      <span>{expense.who} · {shortDate(expense.date)}</span>
                    </div>
                    <strong className="expense-amount">{money(expense.amount)}</strong>
                  </div>
                ))
              ) : (
                <div className="empty-state">Nenhum gasto registrado nesta categoria.</div>
              )}
            </div>
          </div>
        </div>
      )}

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
                <input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="Ex.: Mercado" required />
              </label>
              <label className="field">
                <span>Valor</span>
                <input value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} type="number" step="0.01" min="0.01" placeholder="0,00" required />
              </label>
              <div className="form-grid">
                <label className="field">
                  <span>Categoria</span>
                  <select value={form.cat} onChange={(event) => setForm({ ...form, cat: event.target.value })}>
                    {[...Object.keys(BUDGETS), "Outros"].map((category) => <option key={category}>{category}</option>)}
                  </select>
                </label>
                <label className="field">
                  <span>Quem</span>
                  <select value={form.who} onChange={(event) => setForm({ ...form, who: event.target.value as Person })}>
                    <option>Bruna</option>
                    <option>Matheus</option>
                    <option>Casal</option>
                  </select>
                </label>
              </div>
              <button className="primary-button" type="submit"><Check size={17} /> Salvar gasto</button>
            </form>
          </div>
        </div>
      )}

      {installmentModal && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setInstallmentModal(false)}>
          <div className="modal-card" onMouseDown={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <div>
                <span className="eyebrow"><CalendarDays size={15} /> Parcelado</span>
                <h2>Novo compromisso</h2>
              </div>
              <button className="icon-button" type="button" onClick={() => setInstallmentModal(false)} aria-label="Fechar">
                <X size={19} />
              </button>
            </div>

            <form onSubmit={saveInstallment}>
              <label className="field">
                <span>O que é?</span>
                <input value={installmentForm.title} onChange={(event) => setInstallmentForm({ ...installmentForm, title: event.target.value })} placeholder="Ex.: Notebook" required />
              </label>
              <div className="form-grid">
                <label className="field">
                  <span>Valor da parcela</span>
                  <input value={installmentForm.amount} onChange={(event) => setInstallmentForm({ ...installmentForm, amount: event.target.value })} type="number" step="0.01" min="0.01" required />
                </label>
                <label className="field">
                  <span>Próximo vencimento</span>
                  <input value={installmentForm.nextDue} onChange={(event) => setInstallmentForm({ ...installmentForm, nextDue: event.target.value })} type="date" required />
                </label>
              </div>
              <div className="form-grid">
                <label className="field">
                  <span>Total de parcelas</span>
                  <input value={installmentForm.total} onChange={(event) => setInstallmentForm({ ...installmentForm, total: event.target.value })} type="number" min="1" step="1" required />
                </label>
                <label className="field">
                  <span>Já pagas</span>
                  <input value={installmentForm.paid} onChange={(event) => setInstallmentForm({ ...installmentForm, paid: event.target.value })} type="number" min="0" step="1" required />
                </label>
              </div>
              <div className="form-grid">
                <label className="field">
                  <span>Categoria</span>
                  <select value={installmentForm.category} onChange={(event) => setInstallmentForm({ ...installmentForm, category: event.target.value })}>
                    {[...Object.keys(BUDGETS), "Outros"].map((category) => <option key={category}>{category}</option>)}
                  </select>
                </label>
                <label className="field">
                  <span>Quem</span>
                  <select value={installmentForm.who} onChange={(event) => setInstallmentForm({ ...installmentForm, who: event.target.value as Person })}>
                    <option>Bruna</option>
                    <option>Matheus</option>
                    <option>Casal</option>
                  </select>
                </label>
              </div>
              <button className="primary-button" type="submit"><Check size={17} /> Salvar parcelado</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
