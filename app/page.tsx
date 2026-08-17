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
  Moon,
  Pencil,
  Plus,
  Receipt,
  Send,
  ShoppingCart,
  Sparkles,
  Sun,
  Tag,
  Trash2,
  WalletCards,
  X,
  Monitor,
} from "lucide-react";

type Person = "Bruna" | "Matheus" | "Casal";
type Tab = "home" | "chat" | "stats" | "future";
type ThemeMode = "light" | "dark" | "system";

type Expense = {
  id: number;
  title: string;
  cat: string;
  who: Person;
  amount: number;
  date: string;
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
};

type Debt = {
  id: number;
  person: string;
  amount: number;
  destination: "cartao" | "bruna" | "matheus" | "casal";
  note: string;
  paid: number;
};

type ChatMessage = {
  id: number;
  role: "assistant" | "user";
  text: string;
};

const INITIAL_EXPENSES: Expense[] = [
  { id: 1, title: "Condomínio", cat: "Casa", who: "Casal", amount: 525, date: "2026-08-01" },
  { id: 2, title: "Garagem", cat: "Casa", who: "Casal", amount: 300, date: "2026-08-02" },
  { id: 3, title: "Parcela do carro", cat: "Carro", who: "Casal", amount: 1680, date: "2026-08-03" },
  { id: 4, title: "Seguro", cat: "Carro", who: "Casal", amount: 500, date: "2026-08-04" },
  { id: 5, title: "Internet", cat: "Casa", who: "Casal", amount: 100, date: "2026-08-05" },
  { id: 6, title: "Luz", cat: "Casa", who: "Casal", amount: 165, date: "2026-08-06" },
  { id: 7, title: "FIES", cat: "Pessoal", who: "Bruna", amount: 553.2, date: "2026-08-07" },
  { id: 8, title: "Mercado", cat: "Alimentação", who: "Bruna", amount: 50, date: "2026-08-08" },
  { id: 9, title: "Petisco gatos", cat: "Pets", who: "Casal", amount: 10, date: "2026-08-09" },
];

const INITIAL_INSTALLMENTS: Installment[] = [
  { id: 1, title: "Parcela do carro", category: "Carro", who: "Casal", amount: 1680, totalInstallments: 48, paidInstallments: 8, nextDue: "2026-09-10" },
  { id: 2, title: "Parcela do apartamento", category: "Casa", who: "Casal", amount: 1800, totalInstallments: 120, paidInstallments: 18, nextDue: "2026-09-05" },
  { id: 3, title: "Seguro", category: "Carro", who: "Casal", amount: 500, totalInstallments: 12, paidInstallments: 3, nextDue: "2026-09-08" },
  { id: 4, title: "FIES", category: "Pessoal", who: "Bruna", amount: 553.2, totalInstallments: 60, paidInstallments: 14, nextDue: "2026-09-12" },
  { id: 5, title: "Globo", category: "Assinaturas", who: "Casal", amount: 24.9, totalInstallments: 12, paidInstallments: 7, nextDue: "2026-09-03" },
  { id: 6, title: "Rei do Óleo", category: "Carro", who: "Casal", amount: 210, totalInstallments: 6, paidInstallments: 2, nextDue: "2026-09-15" },
  { id: 7, title: "Hocks", category: "Pessoal", who: "Bruna", amount: 89.9, totalInstallments: 8, paidInstallments: 3, nextDue: "2026-09-20" },
  { id: 8, title: "Lojão", category: "Casa", who: "Matheus", amount: 150, totalInstallments: 10, paidInstallments: 4, nextDue: "2026-09-18" },
];

const DEFAULT_BUDGETS: Record<string, number> = {
  Casa: 2500,
  Carro: 3000,
  Assinaturas: 500,
  Pets: 650,
  Alimentação: 1400,
  Transporte: 800,
  Lazer: 700,
  Pessoal: 1000,
  Trabalho: 300,
  Outros: 500,
};

const money = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const shortDate = (value: string) =>
  value
    ? new Date(`${value}T12:00:00`).toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
      })
    : "—";

const parseAmount = (text: string) => {
  const match = text.match(
    /(?:r\$\s*)?(\d{1,3}(?:\.\d{3})*(?:,\d{1,2})?|\d+(?:[.,]\d{1,2})?)/i
  );
  return match
    ? Number(match[1].replace(/\./g, "").replace(",", "."))
    : null;
};

function categoryFromText(text: string) {
  const normalized = text.toLowerCase();

  if (/café|cafe|doce|padaria|trabalho/.test(normalized)) return "Trabalho";
  if (/mercado|comida|restaurante|lanche|ifood/.test(normalized)) return "Alimentação";
  if (/uber|99|ônibus|onibus|transporte/.test(normalized)) return "Transporte";
  if (/gasolina|posto|carro|óleo|oleo|seguro/.test(normalized)) return "Carro";
  if (/gato|pet|ração|racao|veterin/.test(normalized)) return "Pets";
  if (/luz|internet|condomínio|condominio|garagem|casa|aluguel/.test(normalized)) return "Casa";
  if (/fies|faculdade|curso|bermuda|relógio|relogio/.test(normalized)) return "Pessoal";
  if (/globo|hocks|assinatura|streaming/.test(normalized)) return "Assinaturas";
  if (/cinema|filme|passeio|viagem/.test(normalized)) return "Lazer";
  return "Outros";
}

function iconFor(category: string) {
  if (category === "Carro") return <Car size={19} />;
  if (category === "Pets") return <span className="emoji-icon">🐱</span>;
  if (category === "Alimentação" || category === "Trabalho") return <ShoppingCart size={19} />;
  if (category === "Casa") return <Home size={19} />;
  if (category === "Assinaturas") return <CreditCard size={19} />;
  return <Tag size={19} />;
}

function cleanExpenseTitle(text: string) {
  return text
    .replace(/(?:gastei|gasto|paguei|comprei|custou|registra|registre)\b/gi, "")
    .replace(/(?:r\$\s*)?(\d{1,3}(?:\.\d{3})*(?:,\d{1,2})?|\d+(?:[.,]\d{1,2})?)/i, "")
    .replace(/\b(?:a|o|no|na|em|de|do|da|com|para)\b/gi, " ")
    .replace(/\b(?:bruna|bru|matheus|theus|casal|nós|nos|juntos|juntas)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^[\s:,-]+|[\s:,-]+$/g, "");
}

export default function Page() {
  const [tab, setTab] = useState<Tab>("home");
  const [activeProfile, setActiveProfile] = useState<Person>("Bruna");
  const [theme, setTheme] = useState<ThemeMode>("system");
  const [themeOpen, setThemeOpen] = useState(false);
  const [quickAddOpen, setQuickAddOpen] = useState(false);

  const [expenses, setExpenses] = useState<Expense[]>(INITIAL_EXPENSES);
  const [installments, setInstallments] = useState<Installment[]>(INITIAL_INSTALLMENTS);
  const [debts, setDebts] = useState<Debt[]>([]);

  const [income, setIncome] = useState(13000);
  const [budgets, setBudgets] = useState(DEFAULT_BUDGETS);
  const [limits, setLimits] = useState({ Bruna: 350, Matheus: 350 });

  const [text, setText] = useState("");
  const [toast, setToast] = useState("");
  const [modal, setModal] = useState<
    "none" | "expense" | "installment" | "debt" | "settings"
  >("none");

  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [editingInstallment, setEditingInstallment] = useState<Installment | null>(null);
  const [editingDebt, setEditingDebt] = useState<Debt | null>(null);
  const [categoryOpen, setCategoryOpen] = useState<string | null>(null);

  const [form, setForm] = useState({
    title: "",
    amount: "",
    cat: "Outros",
    who: "Bruna" as Person,
  });

  const [instForm, setInstForm] = useState({
    title: "",
    amount: "",
    category: "Outros",
    who: "Bruna" as Person,
    total: "",
    paid: "0",
    nextDue: "",
  });

  const [debtForm, setDebtForm] = useState({
    person: "Amigo",
    amount: "",
    destination: "bruna" as Debt["destination"],
    note: "",
  });

  const [chat, setChat] = useState<ChatMessage[]>([
    {
      id: 1,
      role: "assistant",
      text: "Oi! 💚 Estou falando com você como Bruna. Se você mudar o perfil acima, novos registros sem nome explícito usam esse perfil.",
    },
  ]);

  const messagesRef = useRef<HTMLDivElement>(null);

  const applyTheme = (mode: ThemeMode) => {
    setTheme(mode);
    localStorage.setItem("brumath-theme", mode);
    document.documentElement.dataset.theme = mode;
    setThemeOpen(false);
  };

  useEffect(() => {
    try {
      const storedTheme = (localStorage.getItem("brumath-theme") as ThemeMode | null) ?? "system";
      setTheme(storedTheme);
      document.documentElement.dataset.theme = storedTheme;

      const storedExpenses = localStorage.getItem("brumath-expenses");
      const storedInstallments = localStorage.getItem("brumath-installments");
      const storedDebts = localStorage.getItem("brumath-debts");
      const storedSettings = localStorage.getItem("brumath-settings");

      if (storedExpenses) setExpenses(JSON.parse(storedExpenses));
      if (storedInstallments) setInstallments(JSON.parse(storedInstallments));
      if (storedDebts) setDebts(JSON.parse(storedDebts));

      if (storedSettings) {
        const settings = JSON.parse(storedSettings);
        if (typeof settings.income === "number") setIncome(settings.income);
        if (settings.budgets) setBudgets({ ...DEFAULT_BUDGETS, ...settings.budgets });
        if (settings.limits) setLimits({ Bruna: 350, Matheus: 350, ...settings.limits });
      }
    } catch {
      document.documentElement.dataset.theme = "system";
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("brumath-expenses", JSON.stringify(expenses));
  }, [expenses]);

  useEffect(() => {
    localStorage.setItem("brumath-installments", JSON.stringify(installments));
  }, [installments]);

  useEffect(() => {
    localStorage.setItem("brumath-debts", JSON.stringify(debts));
  }, [debts]);

  useEffect(() => {
    localStorage.setItem(
      "brumath-settings",
      JSON.stringify({ income, budgets, limits })
    );
  }, [income, budgets, limits]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 2200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (tab !== "chat" || !messagesRef.current) return;
    const frame = window.requestAnimationFrame(() => {
      if (messagesRef.current) {
        messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, [chat, tab]);

  const totalSpent = useMemo(
    () => expenses.reduce((sum, item) => sum + item.amount, 0),
    [expenses]
  );

  const available = income - totalSpent;

  const futureTotal = useMemo(
    () =>
      installments
        .filter((item) => item.paidInstallments < item.totalInstallments)
        .reduce((sum, item) => sum + item.amount, 0),
    [installments]
  );

  const remaining = useMemo(
    () =>
      installments.reduce(
        (sum, item) => sum + Math.max(0, item.totalInstallments - item.paidInstallments),
        0
      ),
    [installments]
  );

  const debtTotal = useMemo(
    () =>
      debts.reduce(
        (sum, debt) => sum + Math.max(0, debt.amount - debt.paid),
        0
      ),
    [debts]
  );

  const cats = useMemo(
    () =>
      Object.entries(budgets).map(([category, budget]) => {
        const spent = expenses
          .filter((expense) => expense.cat === category)
          .reduce((sum, expense) => sum + expense.amount, 0);

        return {
          category,
          budget,
          spent,
          percent: budget ? Math.min(100, (spent / budget) * 100) : 0,
        };
      }),
    [expenses, budgets]
  );

  const resetExpenseForm = (expense?: Expense) => {
    setForm(
      expense
        ? {
            title: expense.title,
            amount: String(expense.amount),
            cat: expense.cat,
            who: expense.who,
          }
        : {
            title: "",
            amount: "",
            cat: "Outros",
            who: activeProfile,
          }
    );
  };

  const openNewExpense = () => {
    setEditingExpense(null);
    resetExpenseForm();
    setQuickAddOpen(false);
    setModal("expense");
  };

  const openNewInstallment = () => {
    setEditingInstallment(null);
    setInstForm({
      title: "",
      amount: "",
      category: "Outros",
      who: activeProfile,
      total: "",
      paid: "0",
      nextDue: "",
    });
    setQuickAddOpen(false);
    setModal("installment");
  };

  const saveExpense = (event: FormEvent) => {
    event.preventDefault();

    const amount = Number(form.amount.replace(",", "."));
    if (!form.title.trim() || !amount || amount < 0) {
      setToast("Preencha descrição e valor.");
      return;
    }

    const item: Expense = {
      id: editingExpense?.id ?? Date.now(),
      title: form.title.trim(),
      amount,
      cat: form.cat,
      who: form.who,
      date: editingExpense?.date ?? new Date().toISOString().slice(0, 10),
    };

    setExpenses((current) =>
      editingExpense
        ? current.map((expense) => (expense.id === item.id ? item : expense))
        : [item, ...current]
    );

    setEditingExpense(null);
    setModal("none");
    setToast(editingExpense ? "Gasto atualizado 💚" : "Gasto adicionado 💚");
  };

  const saveInstallment = (event: FormEvent) => {
    event.preventDefault();

    const amount = Number(instForm.amount.replace(",", "."));
    const total = Number(instForm.total);
    const paid = Math.max(0, Math.min(Number(instForm.paid), total));

    if (!instForm.title.trim() || !amount || amount < 0 || !total || total < 1) {
      setToast("Preencha os dados da parcela.");
      return;
    }

    const item: Installment = {
      id: editingInstallment?.id ?? Date.now(),
      title: instForm.title.trim(),
      amount,
      category: instForm.category,
      who: instForm.who,
      totalInstallments: total,
      paidInstallments: paid,
      nextDue: instForm.nextDue || new Date().toISOString().slice(0, 10),
    };

    setInstallments((current) =>
      editingInstallment
        ? current.map((installment) =>
            installment.id === item.id ? item : installment
          )
        : [item, ...current]
    );

    setEditingInstallment(null);
    setModal("none");
    setToast(editingInstallment ? "Parcela atualizada 💚" : "Parcela adicionada 💚");
  };

  const saveDebt = (event: FormEvent) => {
    event.preventDefault();

    const amount = Number(debtForm.amount.replace(",", "."));

    if (!debtForm.person.trim() || !amount || amount < 0) {
      setToast("Informe quem deve e o valor.");
      return;
    }

    const item: Debt = {
      id: editingDebt?.id ?? Date.now(),
      person: debtForm.person.trim(),
      amount,
      destination: debtForm.destination,
      note: debtForm.note.trim(),
      paid: editingDebt?.paid ?? 0,
    };

    setDebts((current) =>
      editingDebt
        ? current.map((debt) => (debt.id === item.id ? item : debt))
        : [item, ...current]
    );

    setEditingDebt(null);
    setModal("none");
    setToast("Valor a receber atualizado 💚");
  };

  const openEditExpense = (expense: Expense) => {
    resetExpenseForm(expense);
    setEditingExpense(expense);
    setModal("expense");
  };

  const openEditInstallment = (installment: Installment) => {
    setInstForm({
      title: installment.title,
      amount: String(installment.amount),
      category: installment.category,
      who: installment.who,
      total: String(installment.totalInstallments),
      paid: String(installment.paidInstallments),
      nextDue: installment.nextDue,
    });
    setEditingInstallment(installment);
    setModal("installment");
  };

  const openDebt = (debt?: Debt) => {
    setDebtForm(
      debt
        ? {
            person: debt.person,
            amount: String(debt.amount),
            destination: debt.destination,
            note: debt.note,
          }
        : {
            person: "Amigo",
            amount: "",
            destination: "bruna",
            note: "",
          }
    );
    setEditingDebt(debt ?? null);
    setModal("debt");
  };

  const payInstallment = (id: number, amount = 1) => {
    setInstallments((current) =>
      current.map((item) =>
        item.id === id
          ? {
              ...item,
              paidInstallments: Math.min(
                item.totalInstallments,
                item.paidInstallments + amount
              ),
            }
          : item
      )
    );
    setToast(amount > 1 ? `${amount} parcelas adiantadas 💚` : "Parcela marcada como paga 💚");
  };

  const receiveDebt = (id: number) => {
    setDebts((current) =>
      current.map((debt) =>
        debt.id === id ? { ...debt, paid: debt.amount } : debt
      )
    );
    setToast("Valor marcado como recebido 💚");
  };

  const send = (preset?: string) => {
    const value = (preset ?? text).trim();
    if (!value) return;

    const normalized = value.toLowerCase();
    const amount = parseAmount(value);

    const who: Person = /\bmatheus\b/i.test(value)
      ? "Matheus"
      : /\bbruna\b/i.test(value)
      ? "Bruna"
      : /\b(nós|nos|casal|juntos|juntas)\b/i.test(value)
      ? "Casal"
      : activeProfile;

    if (/resumo|situação|situacao/.test(normalized)) {
      setChat((current) => [
        ...current,
        { id: Date.now(), role: "user", text: value },
        {
          id: Date.now() + 1,
          role: "assistant",
          text: `Resumo: ${money(totalSpent)} usados, ${money(
            available
          )} disponíveis, ${installments.filter((item) => item.paidInstallments < item.totalInstallments).length} parcelados ativos e ${money(
            debtTotal
          )} a receber.`,
        },
      ]);
      setText("");
      return;
    }

    if (/quanto temos|saldo|disponível|disponivel|quanto tem/.test(normalized)) {
      setChat((current) => [
        ...current,
        { id: Date.now(), role: "user", text: value },
        {
          id: Date.now() + 1,
          role: "assistant",
          text: `Renda: ${money(income)}. Gastos: ${money(
            totalSpent
          )}. Disponível: ${money(available)}. A receber: ${money(debtTotal)}.`,
        },
      ]);
      setText("");
      return;
    }

    if (/parcela|parcelas|futuro|compromisso/.test(normalized)) {
      setChat((current) => [
        ...current,
        { id: Date.now(), role: "user", text: value },
        {
          id: Date.now() + 1,
          role: "assistant",
          text: `Você tem ${installments.filter(
            (item) => item.paidInstallments < item.totalInstallments
          ).length} parcelados ativos, ${remaining} parcelas restantes e ${money(
            futureTotal
          )} de compromisso mensal.`,
        },
      ]);
      setText("");
      return;
    }

    if (/quem.*deve|me deve|a receber|devedor/.test(normalized)) {
      setChat((current) => [
        ...current,
        { id: Date.now(), role: "user", text: value },
        {
          id: Date.now() + 1,
          role: "assistant",
          text: debtTotal
            ? `Hoje você tem ${money(debtTotal)} a receber. Acesse Futuro para ver quem deve e para onde o pagamento será destinado.`
            : "Ainda não há valores a receber cadastrados. Você pode adicionar um no botão +.",
        },
      ]);
      setText("");
      return;
    }

    if (
      amount &&
      /gastei|gasto|paguei|comprei|custou|registra|registre|foi/.test(normalized)
    ) {
      const category = categoryFromText(value);
      const title = cleanExpenseTitle(value) || "Novo gasto";

      const item: Expense = {
        id: Date.now(),
        title,
        cat: category,
        who,
        amount,
        date: new Date().toISOString().slice(0, 10),
      };

      setExpenses((current) => [item, ...current]);

      setChat((current) => [
        ...current,
        { id: Date.now(), role: "user", text: value },
        {
          id: Date.now() + 1,
          role: "assistant",
          text: `Registrado para ${item.who}: ${money(amount)} em ${category}.`,
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
        text: "Posso registrar gastos, consultar resumo, parcelas, orçamento e valores a receber. Para um gasto sem nome explícito, uso o perfil selecionado acima.",
      },
    ]);

    setText("");
  };

  const profileLabel = activeProfile;

  const themeLabel =
    theme === "light" ? "Claro" : theme === "dark" ? "Escuro" : "Automático";

  return (
    <div className="app-shell">
      {toast && <div className="toast">{toast}</div>}

      <header className="topbar">
        <div className="brand-area">
          <div className="brand">
            Bru<span>Math</span> 💚
          </div>
          <div className="subtitle">Finanças de Bruna &amp; Matheus</div>
        </div>

        <div className="topbar-actions">
          <div className="profile-switch">
            <span className="profile-label">Falando como</span>
            {(["Bruna", "Matheus", "Casal"] as Person[]).map((person) => (
              <button
                key={person}
                type="button"
                className={`profile-chip ${activeProfile === person ? "active" : ""}`}
                onClick={() => {
                  setActiveProfile(person);
                  setForm((current) => ({ ...current, who: person }));
                  setInstForm((current) => ({ ...current, who: person }));
                }}
              >
                {person}
              </button>
            ))}
          </div>

          <div className="theme-control">
            <button
              type="button"
              className="theme-button"
              aria-label={`Tema: ${themeLabel}`}
              title={`Tema: ${themeLabel}`}
              onClick={() => setThemeOpen((open) => !open)}
            >
              {theme === "light" ? (
                <Sun size={18} />
              ) : theme === "dark" ? (
                <Moon size={18} />
              ) : (
                <Monitor size={18} />
              )}
            </button>

            {themeOpen && (
              <div className="theme-menu">
                <button
                  type="button"
                  className={`theme-option ${theme === "light" ? "active" : ""}`}
                  onClick={() => applyTheme("light")}
                >
                  <Sun size={16} />
                  <span>Claro</span>
                  {theme === "light" && <Check size={15} />}
                </button>
                <button
                  type="button"
                  className={`theme-option ${theme === "dark" ? "active" : ""}`}
                  onClick={() => applyTheme("dark")}
                >
                  <Moon size={16} />
                  <span>Escuro</span>
                  {theme === "dark" && <Check size={15} />}
                </button>
                <button
                  type="button"
                  className={`theme-option ${theme === "system" ? "active" : ""}`}
                  onClick={() => applyTheme("system")}
                >
                  <Monitor size={16} />
                  <span>Automático</span>
                  {theme === "system" && <Check size={15} />}
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="page">
        {tab === "home" && (
          <>
            <section className="hero">
              <small>Disponível em agosto</small>
              <div className="hero-amount">{money(available)}</div>
              <div className="progress-track">
                <div
                  className="progress-fill"
                  style={{
                    width: `${income > 0 ? Math.max(
                      0,
                      Math.min(100, (totalSpent / income) * 100)
                    ) : 0}%`,
                  }}
                />
              </div>
              <div className="progress-labels">
                <span>Usado {money(totalSpent)}</span>
                <span>Renda {money(income)}</span>
              </div>
            </section>

            <section className="summary-grid">
              <button
                type="button"
                className="metric-card metric-button"
                onClick={() => setModal("settings")}
              >
                <span>Renda</span>
                <strong>{money(income)}</strong>
                <small>Editar orçamento</small>
              </button>

              <button
                type="button"
                className="metric-card metric-button"
                onClick={() => setModal("settings")}
              >
                <span>Limite Bruna</span>
                <strong>{money(limits.Bruna)}</strong>
                <small>Café, doces e pessoal</small>
              </button>

              <button
                type="button"
                className="metric-card metric-button"
                onClick={() => setModal("settings")}
              >
                <span>Limite Matheus</span>
                <strong>{money(limits.Matheus)}</strong>
                <small>Gastos pessoais</small>
              </button>

              <button
                type="button"
                className="metric-card metric-button"
                onClick={() => setTab("future")}
              >
                <span>Parcelas</span>
                <strong>
                  {installments.filter(
                    (item) => item.paidInstallments < item.totalInstallments
                  ).length}{" "}
                  ativas
                </strong>
                <small>{remaining} parcelas restantes</small>
              </button>
            </section>

            <section className="section">
              <div className="section-title">
                <h2>Assistente</h2>
                <span className="online">
                  <i /> {profileLabel}
                </span>
              </div>

              <div className="chat-preview">
                <div className="chat-profile-banner compact">
                  Você está falando como <strong>{profileLabel}</strong>.
                </div>

                <div className="bubble assistant-bubble">
                  {chat.at(-1)?.text}
                </div>

                <div className="quick-actions">
                  <button type="button" onClick={() => send("Quanto temos?")}>
                    Quanto temos?
                  </button>
                  <button type="button" onClick={() => send("Resumo")}>
                    Resumo
                  </button>
                  <button type="button" onClick={() => send("Parcelas")}>
                    Parcelas
                  </button>
                  <button type="button" onClick={() => openDebt()}>
                    Quem me deve?
                  </button>
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
                  <button
                    type="button"
                    className="send-button"
                    onClick={() => send()}
                  >
                    <Send size={17} />
                    <span>Enviar</span>
                  </button>
                </div>

                <button
                  type="button"
                  className="open-chat"
                  onClick={() => setTab("chat")}
                >
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
                {expenses.slice(0, 20).map((expense) => (
                  <div className="expense-row" key={expense.id}>
                    <div className="expense-icon">{iconFor(expense.cat)}</div>

                    <div className="expense-info">
                      <strong>{expense.title}</strong>
                      <span>
                        {expense.cat} · {expense.who}
                      </span>
                    </div>

                    <strong className="expense-amount">
                      {money(expense.amount)}
                    </strong>

                    <button
                      type="button"
                      className="icon-button"
                      aria-label={`Editar ${expense.title}`}
                      onClick={() => openEditExpense(expense)}
                    >
                      <Pencil size={15} />
                    </button>

                    <button
                      type="button"
                      className="delete-button"
                      aria-label={`Excluir ${expense.title}`}
                      onClick={() =>
                        setExpenses((current) =>
                          current.filter((item) => item.id !== expense.id)
                        )
                      }
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
                <span className="eyebrow">
                  <MessageCircle size={15} /> Assistente
                </span>
                <h1>Conversa com o BruMath</h1>
                <p>
                  Perfil atual: <strong>{profileLabel}</strong>. Gastos sem nome
                  explícito usam este perfil.
                </p>
              </div>
            </div>

            <div className="full-chat">
              <div className="messages" ref={messagesRef}>
                {chat.map((message) => (
                  <div
                    className={`message ${message.role}`}
                    key={message.id}
                  >
                    <div className="message-avatar">
                      {message.role === "assistant"
                        ? "💚"
                        : profileLabel.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="message-content">{message.text}</div>
                  </div>
                ))}
              </div>

              <div className="chat-composer">
                <div className="quick-actions">
                  <button type="button" onClick={() => send("Quanto temos?")}>
                    Quanto temos?
                  </button>
                  <button type="button" onClick={() => send("Resumo")}>
                    Resumo
                  </button>
                  <button type="button" onClick={() => send("Parcelas")}>
                    Parcelas
                  </button>
                  <button type="button" onClick={() => openDebt()}>
                    Quem me deve?
                  </button>
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
                  <button
                    type="button"
                    className="send-button"
                    onClick={() => send()}
                  >
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
                <span className="eyebrow">
                  <ChartNoAxesColumn size={15} /> Categorias
                </span>
                <h1>Orçamento por categoria</h1>
                <p>Toque em uma categoria para ver os lançamentos.</p>
              </div>
            </div>

            <div className="category-grid">
              {cats.map((category) => (
                <button
                  type="button"
                  className="category-card"
                  key={category.category}
                  onClick={() =>
                    setCategoryOpen(
                      categoryOpen === category.category
                        ? null
                        : category.category
                    )
                  }
                >
                  <div className="category-head">
                    <div className="category-icon">
                      {iconFor(category.category)}
                    </div>
                    <div>
                      <strong>{category.category}</strong>
                      <span>
                        {money(category.spent)} de {money(category.budget)}
                      </span>
                    </div>
                    <b>{Math.round(category.percent)}%</b>
                  </div>

                  <div className="progress-track small">
                    <div
                      className="progress-fill"
                      style={{ width: `${category.percent}%` }}
                    />
                  </div>

                  {categoryOpen === category.category && (
                    <div className="category-detail">
                      {expenses.filter(
                        (expense) => expense.cat === category.category
                      ).length === 0 ? (
                        <span>Nenhum lançamento nesta categoria.</span>
                      ) : (
                        expenses
                          .filter(
                            (expense) => expense.cat === category.category
                          )
                          .map((expense) => (
                            <div key={expense.id}>
                              <span>
                                {expense.title} · {expense.who}
                              </span>
                              <strong>{money(expense.amount)}</strong>
                            </div>
                          ))
                      )}
                    </div>
                  )}
                </button>
              ))}
            </div>
          </section>
        )}

        {tab === "future" && (
          <section className="section">
            <div className="page-heading">
              <div>
                <span className="eyebrow">
                  <CalendarDays size={15} /> Futuro
                </span>
                <h1>Parcelas e compromissos</h1>
                <p>
                  Veja o que são, quantas faltam, edite, adiante ou quite
                  compromissos.
                </p>
              </div>

              <button
                type="button"
                className="primary-button compact"
                onClick={openNewInstallment}
              >
                <Plus size={17} /> Nova parcela
              </button>
            </div>

            <div className="future-summary">
              <div>
                <span>Ativas</span>
                <strong>
                  {
                    installments.filter(
                      (item) =>
                        item.paidInstallments < item.totalInstallments
                    ).length
                  }
                </strong>
              </div>
              <div>
                <span>Mensal</span>
                <strong>{money(futureTotal)}</strong>
              </div>
              <div>
                <span>Restantes</span>
                <strong>{remaining}</strong>
              </div>
            </div>

            <div className="installment-list">
              {installments.length === 0 ? (
                <div className="empty-state">
                  Nenhuma parcela cadastrada ainda.
                </div>
              ) : (
                installments.map((installment) => {
                  const remainingForItem =
                    installment.totalInstallments -
                    installment.paidInstallments;
                  const progress =
                    installment.totalInstallments > 0
                      ? Math.min(
                          100,
                          (installment.paidInstallments /
                            installment.totalInstallments) *
                            100
                        )
                      : 0;

                  return (
                    <article
                      className="installment-card"
                      key={installment.id}
                    >
                      <div className="installment-icon">
                        {iconFor(installment.category)}
                      </div>

                      <div className="installment-main">
                        <div className="installment-title-row">
                          <div>
                            <strong>{installment.title}</strong>
                            <span>
                              {installment.category} · {installment.who}
                            </span>
                          </div>
                          <strong>{money(installment.amount)}/mês</strong>
                        </div>

                        <div className="installment-details">
                          <div>
                            <span>Pagas</span>
                            <b>{installment.paidInstallments}</b>
                          </div>
                          <div>
                            <span>Faltam</span>
                            <b>{remainingForItem}</b>
                          </div>
                          <div>
                            <span>Total</span>
                            <b>{installment.totalInstallments}</b>
                          </div>
                          <div>
                            <span>Próximo</span>
                            <b>{shortDate(installment.nextDue)}</b>
                          </div>
                        </div>

                        <div className="installment-progress">
                          <div className="progress-track small">
                            <div
                              className="progress-fill"
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                          <span>{Math.round(progress)}% pago</span>
                        </div>

                        <div className="installment-actions">
                          <button
                            type="button"
                            onClick={() => payInstallment(installment.id, 1)}
                            disabled={!remainingForItem}
                          >
                            Pagar 1
                          </button>
                          <button
                            type="button"
                            onClick={() => payInstallment(installment.id, 2)}
                            disabled={remainingForItem < 2}
                          >
                            Adiantar 2
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              payInstallment(
                                installment.id,
                                remainingForItem
                              )
                            }
                            disabled={!remainingForItem}
                          >
                            Quitar
                          </button>
                          <button
                            type="button"
                            onClick={() => openEditInstallment(installment)}
                          >
                            <Pencil size={14} /> Editar
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })
              )}
            </div>

            <section className="section">
              <div className="section-title">
                <h2>Valores a receber</h2>
                <span className="muted">
                  Total pendente: {money(debtTotal)}
                </span>
              </div>

              <div className="debt-list">
                {debts.length === 0 ? (
                  <div className="empty-state">
                    Nenhum valor a receber cadastrado.
                  </div>
                ) : (
                  debts.map((debt) => (
                    <div className="debt-row" key={debt.id}>
                      <div>
                        <strong>{debt.person}</strong>
                        <span>
                          {debt.note || "Valor a receber"} ·{" "}
                          {debt.destination === "cartao"
                            ? "pagar o cartão"
                            : debt.destination === "bruna"
                            ? "pagar para Bruna"
                            : debt.destination === "matheus"
                            ? "pagar para Matheus"
                            : "pagar para o casal"}
                        </span>
                      </div>

                      <strong>{money(Math.max(0, debt.amount - debt.paid))}</strong>

                      <button
                        type="button"
                        className="icon-button"
                        onClick={() => openDebt(debt)}
                        aria-label={`Editar dívida de ${debt.person}`}
                      >
                        <Pencil size={15} />
                      </button>

                      <button
                        type="button"
                        className="primary-button compact"
                        onClick={() => receiveDebt(debt.id)}
                        disabled={debt.paid >= debt.amount}
                      >
                        {debt.paid >= debt.amount ? "Recebido" : "Recebi"}
                      </button>
                    </div>
                  ))
                )}
              </div>

              <button
                type="button"
                className="open-chat"
                onClick={() => openDebt()}
              >
                + Adicionar quem me deve
              </button>
            </section>
          </section>
        )}
      </main>

      <div className="fab-wrap">
        {quickAddOpen && (
          <div className="quick-add-menu">
            <button type="button" onClick={openNewExpense}>
              <Receipt size={17} />
              Gasto
            </button>
            <button type="button" onClick={openNewInstallment}>
              <CreditCard size={17} />
              Parcela
            </button>
            <button
              type="button"
              onClick={() => {
                setQuickAddOpen(false);
                openDebt();
              }}
            >
              <WalletCards size={17} />
              A receber
            </button>
          </div>
        )}

        <button
          type="button"
          className={`floating-add ${quickAddOpen ? "is-open" : ""}`}
          onClick={() => setQuickAddOpen((open) => !open)}
          aria-label="Adicionar"
          aria-expanded={quickAddOpen}
        >
          {quickAddOpen ? <X size={23} /> : <Plus size={25} />}
        </button>
      </div>

      <nav className="bottom-nav">
        <button
          type="button"
          className={tab === "home" ? "active" : ""}
          onClick={() => setTab("home")}
        >
          <Home size={20} />
          <span>Início</span>
        </button>
        <button
          type="button"
          className={tab === "chat" ? "active" : ""}
          onClick={() => setTab("chat")}
        >
          <MessageCircle size={20} />
          <span>Assistente</span>
        </button>
        <button
          type="button"
          className={tab === "stats" ? "active" : ""}
          onClick={() => setTab("stats")}
        >
          <ChartNoAxesColumn size={20} />
          <span>Categorias</span>
        </button>
        <button
          type="button"
          className={tab === "future" ? "active" : ""}
          onClick={() => setTab("future")}
        >
          <CalendarDays size={20} />
          <span>Futuro</span>
        </button>
      </nav>

      {modal !== "none" && (
        <div
          className="modal-backdrop"
          onMouseDown={() => setModal("none")}
        >
          <div
            className="modal-card"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="modal-header">
              <div>
                <span className="eyebrow">
                  {modal === "expense" ? (
                    <Receipt size={15} />
                  ) : modal === "installment" ? (
                    <CreditCard size={15} />
                  ) : modal === "debt" ? (
                    <WalletCards size={15} />
                  ) : (
                    <Sparkles size={15} />
                  )}
                  {modal === "expense"
                    ? "Gasto"
                    : modal === "installment"
                    ? "Parcela"
                    : modal === "debt"
                    ? "Valor a receber"
                    : "Orçamento"}
                </span>

                <h2>
                  {modal === "expense"
                    ? editingExpense
                      ? "Editar gasto"
                      : "Novo gasto"
                    : modal === "installment"
                    ? editingInstallment
                      ? "Editar parcela"
                      : "Nova parcela"
                    : modal === "debt"
                    ? editingDebt
                      ? "Editar dívida"
                      : "Adicionar quem me deve"
                    : "Renda e limites"}
                </h2>
              </div>

              <button
                type="button"
                className="icon-button"
                onClick={() => setModal("none")}
                aria-label="Fechar"
              >
                <X size={19} />
              </button>
            </div>

            {modal === "expense" && (
              <form onSubmit={saveExpense}>
                <label className="field">
                  <span>Descrição</span>
                  <input
                    value={form.title}
                    onChange={(event) =>
                      setForm({ ...form, title: event.target.value })
                    }
                    placeholder="Ex.: Mercado"
                    required
                  />
                </label>

                <label className="field">
                  <span>Valor</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.amount}
                    onChange={(event) =>
                      setForm({ ...form, amount: event.target.value })
                    }
                    placeholder="0,00"
                    required
                  />
                </label>

                <div className="form-grid">
                  <label className="field">
                    <span>Categoria</span>
                    <select
                      value={form.cat}
                      onChange={(event) =>
                        setForm({ ...form, cat: event.target.value })
                      }
                    >
                      {Object.keys(budgets).map((category) => (
                        <option key={category}>{category}</option>
                      ))}
                    </select>
                  </label>

                  <label className="field">
                    <span>Quem</span>
                    <select
                      value={form.who}
                      onChange={(event) =>
                        setForm({
                          ...form,
                          who: event.target.value as Person,
                        })
                      }
                    >
                      <option>Bruna</option>
                      <option>Matheus</option>
                      <option>Casal</option>
                    </select>
                  </label>
                </div>

                <button type="submit" className="primary-button">
                  <Check size={17} /> Salvar gasto
                </button>
              </form>
            )}

            {modal === "installment" && (
              <form onSubmit={saveInstallment}>
                <label className="field">
                  <span>Nome</span>
                  <input
                    value={instForm.title}
                    onChange={(event) =>
                      setInstForm({ ...instForm, title: event.target.value })
                    }
                    placeholder="Ex.: Notebook"
                    required
                  />
                </label>

                <div className="form-grid">
                  <label className="field">
                    <span>Valor mensal</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={instForm.amount}
                      onChange={(event) =>
                        setInstForm({
                          ...instForm,
                          amount: event.target.value,
                        })
                      }
                      required
                    />
                  </label>

                  <label className="field">
                    <span>Total de parcelas</span>
                    <input
                      type="number"
                      min="1"
                      value={instForm.total}
                      onChange={(event) =>
                        setInstForm({
                          ...instForm,
                          total: event.target.value,
                        })
                      }
                      required
                    />
                  </label>
                </div>

                <div className="form-grid">
                  <label className="field">
                    <span>Já pagas</span>
                    <input
                      type="number"
                      min="0"
                      value={instForm.paid}
                      onChange={(event) =>
                        setInstForm({
                          ...instForm,
                          paid: event.target.value,
                        })
                      }
                    />
                  </label>

                  <label className="field">
                    <span>Próximo vencimento</span>
                    <input
                      type="date"
                      value={instForm.nextDue}
                      onChange={(event) =>
                        setInstForm({
                          ...instForm,
                          nextDue: event.target.value,
                        })
                      }
                    />
                  </label>
                </div>

                <div className="form-grid">
                  <label className="field">
                    <span>Categoria</span>
                    <select
                      value={instForm.category}
                      onChange={(event) =>
                        setInstForm({
                          ...instForm,
                          category: event.target.value,
                        })
                      }
                    >
                      {Object.keys(budgets).map((category) => (
                        <option key={category}>{category}</option>
                      ))}
                    </select>
                  </label>

                  <label className="field">
                    <span>Quem</span>
                    <select
                      value={instForm.who}
                      onChange={(event) =>
                        setInstForm({
                          ...instForm,
                          who: event.target.value as Person,
                        })
                      }
                    >
                      <option>Bruna</option>
                      <option>Matheus</option>
                      <option>Casal</option>
                    </select>
                  </label>
                </div>

                <button type="submit" className="primary-button">
                  <Check size={17} /> Salvar parcela
                </button>
              </form>
            )}

            {modal === "debt" && (
              <form onSubmit={saveDebt}>
                <label className="field">
                  <span>Quem deve?</span>
                  <input
                    value={debtForm.person}
                    onChange={(event) =>
                      setDebtForm({
                        ...debtForm,
                        person: event.target.value,
                      })
                    }
                    placeholder="Ex.: João"
                    required
                  />
                </label>

                <label className="field">
                  <span>Valor</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={debtForm.amount}
                    onChange={(event) =>
                      setDebtForm({
                        ...debtForm,
                        amount: event.target.value,
                      })
                    }
                    placeholder="13.000,00"
                    required
                  />
                </label>

                <label className="field">
                  <span>Para onde vai quando pagar?</span>
                  <select
                    value={debtForm.destination}
                    onChange={(event) =>
                      setDebtForm({
                        ...debtForm,
                        destination: event.target.value as Debt["destination"],
                      })
                    }
                  >
                    <option value="cartao">Pagar o cartão</option>
                    <option value="bruna">Pagar para Bruna</option>
                    <option value="matheus">Pagar para Matheus</option>
                    <option value="casal">Pagar para o casal</option>
                  </select>
                </label>

                <label className="field">
                  <span>Observação</span>
                  <input
                    value={debtForm.note}
                    onChange={(event) =>
                      setDebtForm({
                        ...debtForm,
                        note: event.target.value,
                      })
                    }
                    placeholder="Ex.: dívida pessoal"
                  />
                </label>

                <button type="submit" className="primary-button">
                  <Check size={17} /> Salvar valor a receber
                </button>
              </form>
            )}

            {modal === "settings" && (
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  setModal("none");
                  setToast("Orçamento atualizado 💚");
                }}
              >
                <label className="field">
                  <span>Renda mensal</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={income}
                    onChange={(event) =>
                      setIncome(Number(event.target.value))
                    }
                  />
                </label>

                <div className="form-grid">
                  <label className="field">
                    <span>Limite Bruna</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={limits.Bruna}
                      onChange={(event) =>
                        setLimits({
                          ...limits,
                          Bruna: Number(event.target.value),
                        })
                      }
                    />
                  </label>

                  <label className="field">
                    <span>Limite Matheus</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={limits.Matheus}
                      onChange={(event) =>
                        setLimits({
                          ...limits,
                          Matheus: Number(event.target.value),
                        })
                      }
                    />
                  </label>
                </div>

                <label className="field">
                  <span>Orçamento Trabalho</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={budgets.Trabalho ?? 0}
                    onChange={(event) =>
                      setBudgets({
                        ...budgets,
                        Trabalho: Number(event.target.value),
                      })
                    }
                  />
                </label>

                <button type="submit" className="primary-button">
                  <Check size={17} /> Salvar orçamento
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
