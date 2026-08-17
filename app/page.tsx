/* app/page.tsx */
"use client";

import {
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  CalendarDays,
  Car,
  Cat,
  CheckCircle2,
  ChevronRight,
  CircleUserRound,
  CreditCard,
  Home,
  MessageCircle,
  Plus,
  Receipt,
  Send,
  ShoppingCart,
  Sparkles,
  Wallet,
  X,
  Zap,
} from "lucide-react";

type Category =
  | "Casa"
  | "Alimentação"
  | "Transporte"
  | "Lazer"
  | "Pessoal"
  | "Pets"
  | "Assinaturas"
  | "Outros";

type Person = "Bruna" | "Matheus" | "Casal";

type Expense = {
  id: number;
  title: string;
  cat: Category;
  who: Person;
  amount: number;
  date: string;
};

type Installment = {
  id: number;
  title: string;
  amount: number;
  current: number;
  total: number;
  next: string;
  category: Category;
  status?: "active" | "paid";
};

type ChatMessage = {
  id: number;
  role: "user" | "assistant";
  text: string;
};

const INCOME = 13000;

const CATEGORY_META: Record<Category, { icon: ReactNode; label: string }> = {
  Casa: { icon: <Home size={18} />, label: "Casa" },
  Alimentação: { icon: <ShoppingCart size={18} />, label: "Alimentação" },
  Transporte: { icon: <Car size={18} />, label: "Transporte" },
  Lazer: { icon: <Sparkles size={18} />, label: "Lazer" },
  Pessoal: { icon: <CircleUserRound size={18} />, label: "Pessoal" },
  Pets: { icon: <Cat size={18} />, label: "Pets" },
  Assinaturas: { icon: <CreditCard size={18} />, label: "Assinaturas" },
  Outros: { icon: <Receipt size={18} />, label: "Outros" },
};

const INITIAL_EXPENSES: Expense[] = [
  { id: 1, title: "Gastei 50 reais no mercado", cat: "Alimentação", who: "Bruna", amount: 50, date: "2026-08-16" },
  { id: 2, title: "Petisco gatos", cat: "Pets", who: "Casal", amount: 10, date: "2026-08-16" },
  { id: 3, title: "Condomínio", cat: "Casa", who: "Casal", amount: 525, date: "2026-08-05" },
  { id: 4, title: "Garagem", cat: "Casa", who: "Casal", amount: 300, date: "2026-08-05" },
  { id: 5, title: "Parcela do carro", cat: "Transporte", who: "Casal", amount: 1680, date: "2026-08-04" },
  { id: 6, title: "Seguro", cat: "Transporte", who: "Casal", amount: 500, date: "2026-08-04" },
  { id: 7, title: "Internet", cat: "Casa", who: "Casal", amount: 100, date: "2026-08-03" },
  { id: 8, title: "Luz", cat: "Casa", who: "Casal", amount: 165, date: "2026-08-03" },
  { id: 9, title: "FIES", cat: "Pessoal", who: "Bruna", amount: 553.2, date: "2026-08-02" },
  { id: 10, title: "Ração", cat: "Pets", who: "Casal", amount: 80, date: "2026-08-02" },
  { id: 11, title: "Areia pets", cat: "Pets", who: "Casal", amount: 385.1, date: "2026-08-01" },
];

const INITIAL_INSTALLMENTS: Installment[] = [
  {
    id: 1,
    title: "Parcela do carro",
    amount: 1680,
    current: 1,
    total: 8,
    next: "2026-09-04",
    category: "Transporte",
    status: "active",
  },
  {
    id: 2,
    title: "Parcela do apartamento",
    amount: 1300,
    current: 0,
    total: 0,
    next: "2026-09-01",
    category: "Casa",
    status: "active",
  },
  {
    id: 3,
    title: "Globo",
    amount: 0,
    current: 0,
    total: 0,
    next: "2026-09-10",
    category: "Assinaturas",
    status: "active",
  },
  {
    id: 4,
    title: "Rei do Óleo",
    amount: 0,
    current: 0,
    total: 0,
    next: "2026-09-12",
    category: "Transporte",
    status: "active",
  },
  {
    id: 5,
    title: "Hocks",
    amount: 0,
    current: 0,
    total: 0,
    next: "2026-09-15",
    category: "Pessoal",
    status: "active",
  },
  {
    id: 6,
    title: "Lojão",
    amount: 0,
    current: 0,
    total: 0,
    next: "2026-09-18",
    category: "Pessoal",
    status: "active",
  },
  {
    id: 7,
    title: "Perfumes",
    amount: 0,
    current: 0,
    total: 0,
    next: "2026-09-20",
    category: "Pessoal",
    status: "active",
  },
  {
    id: 8,
    title: "Outras compras parceladas",
    amount: 0,
    current: 0,
    total: 0,
    next: "2026-09-25",
    category: "Outros",
    status: "active",
  },
];

const money = (value: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);

const dateBR = (value: string) =>
  new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  }).format(new Date(`${value}T12:00:00`));

function normalize(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function extractAmount(text: string) {
  const match = text.match(/(?:r\$\s*)?(\d{1,3}(?:\.\d{3})*(?:,\d{1,2})?|\d+(?:[.,]\d{1,2})?)/i);
  if (!match) return null;

  const raw = match[1].replace(/\./g, "").replace(",", ".");
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

function detectCategory(text: string): Category {
  const value = normalize(text);

  if (/mercado|mercado|comida|restaurante|lanche|ifood|padaria|supermercado/.test(value)) return "Alimentação";
  if (/gasolina|posto|uber|99|combustivel|carro|estacionamento|garagem|oleo/.test(value)) return "Transporte";
  if (/gato|pet|racao|areia|veterin|cachorro/.test(value)) return "Pets";
  if (/luz|energia|internet|condominio|aluguel|casa|agua|faxina/.test(value)) return "Casa";
  if (/netflix|spotify|globo|prime|disney|assinatura/.test(value)) return "Assinaturas";
  if (/cinema|bar|viagem|passeio|jogo|lazer/.test(value)) return "Lazer";
  if (/fies|curso|faculdade|roupa|perfume|pessoal/.test(value)) return "Pessoal";

  return "Outros";
}

function detectPerson(text: string): Person {
  const value = normalize(text);

  if (/\bmatheus\b/.test(value)) return "Matheus";
  if (/\bbruna\b/.test(value)) return "Bruna";
  if (/\bcasal\b|\bnos\b|\bnossa\b|\bnosso\b/.test(value)) return "Casal";

  return "Bruna";
}

function assistantAnswer(
  normalizedText: string,
  available: number,
  used: number,
  expenses: Expense[],
  installments: Installment[]
) {
  if (/^(oi|ola|hey|e ai|bom dia|boa tarde|boa noite)\b/.test(normalizedText)) {
    return "Oi! 💚 Pode falar comigo normalmente. Posso registrar gastos, mostrar o resumo, dizer quanto temos ou listar as parcelas.";
  }

  if (
    /quanto temos|quanto tem|disponivel|saldo|quanto sobrou|quanto ainda temos/.test(
      normalizedText
    )
  ) {
    return `Hoje temos ${money(available)} disponíveis em agosto. A renda cadastrada é ${money(INCOME)} e os gastos registrados somam ${money(used)}.`;
  }

  if (/resumo|resumir|situacao|como estamos|fechamento/.test(normalizedText)) {
    const byPerson = expenses.reduce(
      (acc, item) => {
        acc[item.who] += item.amount;
        return acc;
      },
      { Bruna: 0, Matheus: 0, Casal: 0 } as Record<Person, number>
    );

    return `Resumo de agosto 💚\n• Renda: ${money(INCOME)}\n• Gastos: ${money(used)}\n• Disponível: ${money(available)}\n• Bruna: ${money(byPerson.Bruna)}\n• Matheus: ${money(byPerson.Matheus)}\n• Casal: ${money(byPerson.Casal)}\n• Parcelas ativas: ${installments.filter((item) => item.status === "active").length}`;
  }

  if (/parcela|parcelas|futuro|proximas/.test(normalizedText)) {
    const active = installments.filter((item) => item.status === "active");
    if (!active.length) return "Não há parcelas ativas cadastradas.";

    const lines = active.slice(0, 5).map((item) => {
      const remaining =
        item.total > 0 ? `${Math.max(item.total - item.current, 0)} restantes` : "quantidade ainda não informada";
      const amount = item.amount > 0 ? money(item.amount) : "valor não informado";
      return `• ${item.title}: ${amount} · ${remaining}`;
    });

    return `Parcelas futuras 📅\n${lines.join("\n")}`;
  }

  if (/ajuda|o que voce faz|comandos/.test(normalizedText)) {
    return "Posso fazer 4 coisas principais: registrar um gasto, mostrar o resumo, dizer quanto está disponível e consultar as parcelas. Você pode escrever de forma natural, por exemplo: “gastei 85 no mercado”.";
  }

  return null;
}

export default function Page() {
  const [expenses, setExpenses] = useState<Expense[]>(INITIAL_EXPENSES);
  const [installments, setInstallments] =
    useState<Installment[]>(INITIAL_INSTALLMENTS);
  const [tab, setTab] = useState<"home" | "chat" | "stats" | "future">("home");
  const [text, setText] = useState("");
  const [toast, setToast] = useState("");
  const [modal, setModal] = useState(false);
  const [chat, setChat] = useState<ChatMessage[]>([
    {
      id: 1,
      role: "assistant",
      text: "Oi! 💚 Pode falar normalmente comigo. Ex.: “gastei 85 no mercado”.",
    },
  ]);

  const [form, setForm] = useState({
    title: "",
    amount: "",
    cat: "Outros" as Category,
    who: "Bruna" as Person,
  });

  const used = useMemo(
    () => expenses.reduce((sum, expense) => sum + expense.amount, 0),
    [expenses]
  );

  const available = Math.max(INCOME - used, 0);

  const activeInstallments = useMemo(
    () => installments.filter((item) => item.status === "active"),
    [installments]
  );

  const paidInstallments = useMemo(
    () => installments.filter((item) => item.status === "paid"),
    [installments]
  );

  const upcomingTotal = useMemo(
    () =>
      activeInstallments.reduce(
        (sum, item) => sum + (item.amount > 0 ? item.amount : 0),
        0
      ),
    [activeInstallments]
  );

  const categories = useMemo(() => {
    return (Object.keys(CATEGORY_META) as Category[]).map((category) => {
      const total = expenses
        .filter((expense) => expense.cat === category)
        .reduce((sum, expense) => sum + expense.amount, 0);

      return { category, total };
    });
  }, [expenses]);

  function notify(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 2200);
  }

  function addExpense(
    title: string,
    amount: number,
    cat: Category,
    who: Person
  ) {
    const expense: Expense = {
      id: Date.now(),
      title,
      cat,
      who,
      amount,
      date: new Date().toISOString().slice(0, 10),
    };

    setExpenses((current) => [expense, ...current]);
    notify(`Gasto de ${money(amount)} registrado 💚`);
    return expense;
  }

  function sendMessage(message = text) {
    const raw = message.trim();
    if (!raw) return;

    const normalized = normalize(raw);

    setChat((current) => [
      ...current,
      { id: Date.now(), role: "user", text: raw },
    ]);
    setText("");

    const amount = extractAmount(raw);
    const looksLikeExpense =
      amount !== null &&
      /gastei|gasto|paguei|pague|comprei|compra|custou|pagar/.test(normalized);

    if (looksLikeExpense && amount !== null) {
      const cat = detectCategory(raw);
      const who = detectPerson(raw);
      const title = raw
        .replace(/^(eu\s+)?(gastei|gasto|paguei|pague|comprei|comprarei)\s*/i, "")
        .trim();

      addExpense(
        title || `Gasto de ${money(amount)}`,
        amount,
        cat,
        who
      );

      setChat((current) => [
        ...current,
        {
          id: Date.now() + 1,
          role: "assistant",
          text: `Registrado 💚 ${money(amount)} em ${cat}, para ${who}. Seu disponível agora é ${money(
            Math.max(INCOME - (used + amount), 0)
          )}.`,
        },
      ]);
      return;
    }

    const answer = assistantAnswer(
      normalized,
      available,
      used,
      expenses,
      installments
    );

    setChat((current) => [
      ...current,
      {
        id: Date.now() + 1,
        role: "assistant",
        text:
          answer ??
          "Entendi. Ainda não consegui interpretar esse comando. Tente “resumo”, “quanto temos?”, “parcelas” ou algo como “gastei 50 no mercado”.",
      },
    ]);
  }

  function submitExpense(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const amount = Number(form.amount.replace(",", "."));
    if (!form.title.trim() || !Number.isFinite(amount) || amount <= 0) {
      notify("Preencha descrição e valor.");
      return;
    }

    addExpense(form.title.trim(), amount, form.cat, form.who);
    setForm({ title: "", amount: "", cat: "Outros", who: "Bruna" });
    setModal(false);
  }

  function markInstallmentPaid(id: number) {
    setInstallments((current) =>
      current.map((item) => {
        if (item.id !== id) return item;

        if (item.total > 0 && item.current < item.total) {
          const nextCurrent = item.current + 1;
          return {
            ...item,
            current: nextCurrent,
            status: nextCurrent >= item.total ? "paid" : "active",
          };
        }

        return item;
      })
    );

    notify("Parcela atualizada.");
  }

  const tabTitle =
    tab === "home"
      ? "Início"
      : tab === "chat"
        ? "Assistente"
        : tab === "stats"
          ? "Categorias"
          : "Futuro";

  return (
    <main className="app">
      {toast && (
        <div className="toast">
          <CheckCircle2 size={17} />
          {toast}
        </div>
      )}

      <header className="top">
        <div>
          <div className="brand">
            Bru<span>Math</span> <span className="heart">💚</span>
          </div>
          <div className="sub">Finanças de Bruna &amp; Matheus</div>
        </div>

        <button
          className="avatar"
          onClick={() => notify("BruMath: perfil do casal")}
          aria-label="Perfil"
        >
          BM
        </button>
      </header>

      {tab === "home" && (
        <>
          <section className="hero">
            <small>Disponível em agosto</small>
            <div className="amount">{money(available)}</div>

            <div className="progress">
              <i style={{ width: `${Math.min((used / INCOME) * 100, 100)}%` }} />
            </div>

            <div className="row">
              <span>Usado {money(used)}</span>
              <span>Renda {money(INCOME)}</span>
            </div>
          </section>

          <section className="cards">
            <div className="card">
              <span>Limite Matheus</span>
              <strong>R$ 350,00</strong>
            </div>
            <div className="card">
              <span>Parcelas</span>
              <strong>{activeInstallments.length} ativas</strong>
            </div>
          </section>

          <section className="section">
            <div className="sectionTitle">
              <h2>Assistente</h2>
              <span className="online">online</span>
            </div>

            <div className="chat">
              <div className="conversation homeConversation">
                {chat.slice(-4).map((message) => (
                  <div
                    className={`message ${
                      message.role === "user" ? "user" : "bot"
                    }`}
                    key={message.id}
                  >
                    <div className="messageIcon">
                      {message.role === "user" ? (
                        <CircleUserRound size={15} />
                      ) : (
                        <Sparkles size={15} />
                      )}
                    </div>
                    <div className="messageText">
                      {message.text.split("\n").map((line, index) => (
                        <span key={`${message.id}-${index}`}>
                          {line}
                          {index < message.text.split("\n").length - 1 && <br />}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <div className="quick">
                <button onClick={() => sendMessage("Quanto temos?")}>
                  Quanto temos?
                </button>
                <button onClick={() => sendMessage("Resumo")}>Resumo</button>
                <button onClick={() => sendMessage("Parcelas")}>
                  Parcelas
                </button>
              </div>

              <div className="inputrow">
                <input
                  value={text}
                  onChange={(event) => setText(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") sendMessage();
                  }}
                  placeholder="Ex.: gastei 50 no mercado"
                />
                <button className="send" onClick={() => sendMessage()}>
                  <Send size={17} />
                  Enviar
                </button>
              </div>
            </div>
          </section>

          <section className="section">
            <div className="sectionTitle">
              <h2>Últimos gastos</h2>
              <span className="sub">Agosto</span>
            </div>

            <div className="list">
              {expenses.slice(0, 8).map((expense) => (
                <div className="expense" key={expense.id}>
                  <div className="ico">
                    {CATEGORY_META[expense.cat].icon}
                  </div>
                  <main>
                    <b>{expense.title}</b>
                    <span>
                      {expense.cat} · {expense.who}
                    </span>
                  </main>
                  <strong>{money(expense.amount)}</strong>
                </div>
              ))}
            </div>
          </section>
        </>
      )}

      {tab === "chat" && (
        <section className="chatPage">
          <div className="sectionTitle">
            <div>
              <h2>Assistente</h2>
              <span className="sub">Conversa com o BruMath</span>
            </div>
            <span className="online">online</span>
          </div>

          <div className="conversation">
            {chat.map((message) => (
              <div
                className={`message ${
                  message.role === "user" ? "user" : "bot"
                }`}
                key={message.id}
              >
                <div className="messageIcon">
                  {message.role === "user" ? (
                    <CircleUserRound size={16} />
                  ) : (
                    <Sparkles size={16} />
                  )}
                </div>
                <div className="messageText">
                  {message.text.split("\n").map((line, index) => (
                    <span key={`${message.id}-${index}`}>
                      {line}
                      {index < message.text.split("\n").length - 1 && <br />}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="quick">
            <button onClick={() => sendMessage("Quanto temos?")}>
              Quanto temos?
            </button>
            <button onClick={() => sendMessage("Resumo")}>Resumo</button>
            <button onClick={() => sendMessage("Parcelas")}>Parcelas</button>
          </div>

          <div className="inputrow">
            <input
              value={text}
              onChange={(event) => setText(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") sendMessage();
              }}
              placeholder="Fale comigo..."
            />
            <button className="send" onClick={() => sendMessage()}>
              <Send size={17} />
              Enviar
            </button>
          </div>
        </section>
      )}

      {tab === "stats" && (
        <section className="section pageSection">
          <div className="sectionTitle">
            <div>
              <h2>Gastos por categoria</h2>
              <span className="sub">{money(used)} registrados em agosto</span>
            </div>
          </div>

          <div className="list">
            {categories
              .sort((a, b) => b.total - a.total)
              .map(({ category, total }) => {
                const percent = used ? (total / used) * 100 : 0;

                return (
                  <div className="categoryRow" key={category}>
                    <div className="categoryHead">
                      <span>
                        {CATEGORY_META[category].icon}
                        <b>{CATEGORY_META[category].label}</b>
                      </span>
                      <strong>{money(total)}</strong>
                    </div>
                    <div className="progress small">
                      <i style={{ width: `${percent}%` }} />
                    </div>
                  </div>
                );
              })}
          </div>
        </section>
      )}

      {tab === "future" && (
        <section className="section pageSection">
          <div className="sectionTitle">
            <div>
              <h2>Futuro</h2>
              <span className="sub">
                Visão completa das parcelas e próximos compromissos
              </span>
            </div>
            <CalendarDays size={22} />
          </div>

          <div className="futureSummary">
            <div>
              <span>Parcelas ativas</span>
              <strong>{activeInstallments.length}</strong>
            </div>
            <div>
              <span>Próximas parcelas</span>
              <strong>{money(upcomingTotal)}</strong>
            </div>
          </div>

          <div className="list">
            {activeInstallments.map((item) => {
              const hasCount = item.total > 0;
              const remaining = hasCount
                ? Math.max(item.total - item.current, 0)
                : null;

              return (
                <div className="futureItem" key={item.id}>
                  <div className="futureIcon">
                    {CATEGORY_META[item.category].icon}
                  </div>

                  <div className="futureMain">
                    <div className="futureTitle">
                      <b>{item.title}</b>
                      <strong>
                        {item.amount > 0 ? money(item.amount) : "Valor não informado"}
                      </strong>
                    </div>

                    <span>
                      {hasCount
                        ? `Parcela ${item.current + 1} de ${item.total} · faltam ${remaining}`
                        : "Quantidade de parcelas ainda não informada"}
                    </span>

                    <span>
                      Próxima: {dateBR(item.next)} · {item.category}
                    </span>

                    {hasCount && (
                      <div className="progress small">
                        <i
                          style={{
                            width: `${Math.min(
                              (item.current / item.total) * 100,
                              100
                            )}%`,
                          }}
                        />
                      </div>
                    )}
                  </div>

                  <button
                    className="iconButton"
                    title={
                      hasCount
                        ? "Marcar parcela atual como paga"
                        : "Quantidade ainda não cadastrada"
                    }
                    onClick={() => markInstallmentPaid(item.id)}
                    disabled={!hasCount}
                  >
                    <CheckCircle2 size={19} />
                  </button>
                </div>
              );
            })}
          </div>

          {paidInstallments.length > 0 && (
            <section className="paidSection">
              <div className="sectionTitle">
                <div>
                  <h2>Já pagas</h2>
                  <span className="sub">
                    {paidInstallments.length} parcela(s) quitada(s)
                  </span>
                </div>
                <CheckCircle2 size={20} />
              </div>

              <div className="list">
                {paidInstallments.map((item) => (
                  <div className="futureItem paidItem" key={item.id}>
                    <div className="futureIcon">
                      <CheckCircle2 size={18} />
                    </div>
                    <div className="futureMain">
                      <div className="futureTitle">
                        <b>{item.title}</b>
                        <strong>{money(item.amount)}</strong>
                      </div>
                      <span>
                        {item.total > 0
                          ? `${item.total} de ${item.total} parcelas pagas`
                          : "Parcela paga"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          <div className="infoBox">
            <Wallet size={19} />
            <div>
              <b>Importante</b>
              <span>
                Os itens sem quantidade cadastrada aparecem como “quantidade
                ainda não informada”. Assim o BruMath não inventa quantas
                parcelas faltam.
              </span>
            </div>
          </div>
        </section>
      )}

      <button className="fab" onClick={() => setModal(true)} aria-label="Novo gasto">
        <Plus size={27} />
      </button>

      <nav className="bottom">
        <button
          className={tab === "home" ? "active" : ""}
          onClick={() => setTab("home")}
        >
          <Home size={19} />
          <span>Início</span>
        </button>
        <button
          className={tab === "chat" ? "active" : ""}
          onClick={() => setTab("chat")}
        >
          <MessageCircle size={19} />
          <span>Assistente</span>
        </button>
        <button
          className={tab === "stats" ? "active" : ""}
          onClick={() => setTab("stats")}
        >
          <Zap size={19} />
          <span>Categorias</span>
        </button>
        <button
          className={tab === "future" ? "active" : ""}
          onClick={() => setTab("future")}
        >
          <CalendarDays size={19} />
          <span>Futuro</span>
        </button>
      </nav>

      {modal && (
        <div className="modal" onClick={() => setModal(false)}>
          <div className="sheet" onClick={(event) => event.stopPropagation()}>
            <div className="sheetHead">
              <div>
                <h2>Novo gasto</h2>
                <span className="sub">Registre uma despesa rapidamente</span>
              </div>
              <button
                className="iconButton"
                onClick={() => setModal(false)}
                aria-label="Fechar"
              >
                <X size={19} />
              </button>
            </div>

            <form onSubmit={submitExpense}>
              <label className="field">
                <span>O que foi?</span>
                <input
                  value={form.title}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      title: event.target.value,
                    }))
                  }
                  placeholder="Mercado"
                  required
                />
              </label>

              <label className="field">
                <span>Valor</span>
                <input
                  value={form.amount}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      amount: event.target.value,
                    }))
                  }
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="50,00"
                  required
                />
              </label>

              <label className="field">
                <span>Categoria</span>
                <select
                  value={form.cat}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      cat: event.target.value as Category,
                    }))
                  }
                >
                  {(Object.keys(CATEGORY_META) as Category[]).map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </label>

              <label className="field">
                <span>Quem?</span>
                <select
                  value={form.who}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      who: event.target.value as Person,
                    }))
                  }
                >
                  <option value="Bruna">Bruna</option>
                  <option value="Matheus">Matheus</option>
                  <option value="Casal">Casal</option>
                </select>
              </label>

              <div className="formActions">
                <button
                  type="button"
                  className="cancel"
                  onClick={() => setModal(false)}
                >
                  Cancelar
                </button>
                <button type="submit" className="primary">
                  Salvar gasto
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="srOnly" aria-live="polite">
        {tabTitle}
      </div>
    </main>
  );
}
