"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { ViewportNavigation } from "../components/navigation/ViewportNavigation";
import {
  CalendarDays,
  BriefcaseBusiness,
  Bus,
  Car,
  Check,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Home,
  MessageCircle,
  Monitor,
  MoreHorizontal,
  Moon,
  Pencil,
  Plus,
  PawPrint,
  Receipt,
  Settings2,
  Send,
  Sparkles,
  Sun,
  Tag,
  Trash2,
  UserRound,
  Utensils,
  WalletCards,
  X,
} from "lucide-react";
import { MoneyInput } from "../components/ui/MoneyInput";
import { DateInput } from "../components/ui/DateInput";
import { ExpenseList } from "../components/finance/ExpenseList";
import { ExpenseSummary } from "../components/finance/ExpenseSummary";
import { DebtSection } from "../components/finance/DebtSection";
import { LimitsScreen } from "../features/limits/LimitsScreen";
import { HomeLimits } from "../features/home/components/Limits/HomeLimits";
import { IncomeSection } from "../components/finance/IncomeSection";
import { QuickActions } from "../components/finance/QuickActions";

import { NavButton } from "../components/navigation/NavButton";
import { AppSidebar, type NavigationTab } from "../components/navigation/AppSidebar";
import { MonthSelector } from "../components/navigation/MonthSelector";
import { NewHome } from "../features/home/NewHome";
import { HomeAssistantPreview } from "../features/home/components/HomeAssistantPreview/HomeAssistantPreview";
import { HomeExpenses } from "../features/home/components/HomeExpenses/HomeExpenses";
import { ExpensesScreen } from "../features/expenses/ExpensesScreen";
import { AssistantChat } from "../features/assistant/AssistantChat";
import { FutureScreen } from "../features/future/FutureScreen";
import { PreferencesScreen } from "../features/preferences/PreferencesScreen";

type Person = "Bruna" | "Matheus" | "Casal";
type Tab = NavigationTab;
type ThemeMode = "light" | "dark" | "system";
type DebtDestination = "cartao" | "bruna" | "matheus" | "casal";

type Expense = { id: number; title: string; cat: string; who: Person; amount: number; date: string };
type Installment = {
  id: number; title: string; category: string; who: Person; amount: number;
  totalInstallments: number; paidInstallments: number; nextDue: string;
};
type Debt = { id: number; person: string; amount: number; destination: DebtDestination; note: string; paid: number; month: string; receivedMonth?: string };
type IncomeEntry = { id: number; title: string; amount: number; who: Person; date: string; destination: "conta" | "cartao"; note: string };
type ChatMessage = { id: number; role: "assistant" | "user"; text: string };
type Confirmation = {
  title: string;
  description: string;
  confirmLabel: string;
  destructive?: boolean;
  onConfirm: () => void;
};

const DEFAULT_BUDGETS: Record<string, number> = {
  Casa: 2500, Carro: 3000, Assinaturas: 500, Pets: 650, Alimentação: 1400,
  Transporte: 800, Lazer: 700, Pessoal: 1000, Trabalho: 300, Outros: 500,
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
  { id: 2, title: "Parcela do apartamento", category: "Casa", who: "Casal", amount: 1300, totalInstallments: 120, paidInstallments: 18, nextDue: "2026-09-01" },
  { id: 3, title: "Globo", category: "Assinaturas", who: "Casal", amount: 24.9, totalInstallments: 12, paidInstallments: 7, nextDue: "2026-09-10" },
  { id: 4, title: "Rei do Óleo", category: "Carro", who: "Casal", amount: 210, totalInstallments: 6, paidInstallments: 2, nextDue: "2026-09-12" },
  { id: 5, title: "Hocks", category: "Pessoal", who: "Bruna", amount: 89.9, totalInstallments: 8, paidInstallments: 3, nextDue: "2026-09-15" },
  { id: 6, title: "Lojão", category: "Pessoal", who: "Matheus", amount: 150, totalInstallments: 10, paidInstallments: 4, nextDue: "2026-09-18" },
];

const money = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dateKey = (date = new Date()) => {
  const y = date.getFullYear(); const m = String(date.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
};
const monthLabel = (key: string) => {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
};
const monthLabelShort = (key: string) => {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("pt-BR", { month: "short", year: "numeric" });
};
const addMonths = (key: string, delta: number) => {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};
const shiftDate = (value: string, months: number) => {
  const [y, m, d] = value.split("-").map(Number);
  const result = new Date(y, m - 1 + months, Math.min(d, 28));
  return `${result.getFullYear()}-${String(result.getMonth() + 1).padStart(2, "0")}-${String(result.getDate()).padStart(2, "0")}`;
};
const shortDate = (value: string) => value ? new Date(`${value}T12:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) : "—";
const parseAmount = (text: string) => {
  const matches = [...text.matchAll(/(?:r\$\s*)?(\d{1,3}(?:\.\d{3})*(?:,\d{1,2})?|\d+(?:[.,]\d{1,2})?)/gi)];
  if (!matches.length) return null;
  const raw = matches[matches.length - 1][1];
  const value = Number(raw.includes(",") ? raw.replace(/\./g, "").replace(",", ".") : raw);
  return Number.isFinite(value) ? value : null;
};

function categoryFromText(text: string) {
  const t = text.toLowerCase();
  if (/café|cafe|doce|doces|padaria|trabalho/.test(t)) return "Trabalho";
  if (/mercado|comida|restaurante|lanche|ifood|pedido/.test(t)) return "Alimentação";
  if (/uber|99|ônibus|onibus|transporte/.test(t)) return "Transporte";
  if (/gasolina|posto|carro|óleo|oleo|seguro|pedágio|pedagio/.test(t)) return "Carro";
  if (/gato|pet|ração|racao|veterin/.test(t)) return "Pets";
  if (/luz|internet|condomínio|condominio|garagem|aluguel|apartamento/.test(t)) return "Casa";
  if (/fies|faculdade|curso|bermuda|relógio|relogio|perfume|loja|hocks/.test(t)) return "Pessoal";
  if (/globo|streaming|assinatura/.test(t)) return "Assinaturas";
  if (/cinema|filme|passeio|viagem/.test(t)) return "Lazer";
  return "Outros";
}

function iconFor(category: string) {
  if (category === "Carro") return <Car size={19} />;
  if (category === "Pets") return <PawPrint size={19} />;
  if (category === "Alimentação") return <Utensils size={19} />;
  if (category === "Trabalho") return <BriefcaseBusiness size={19} />;
  if (category === "Transporte") return <Bus size={19} />;
  if (category === "Casa") return <Home size={19} />;
  if (category === "Assinaturas") return <CreditCard size={19} />;
  if (category === "Pessoal") return <UserRound size={19} />;
  return <Tag size={19} />;
}

function cleanExpenseTitle(text: string) {
  return text
    .replace(/\b(?:matheus|bruna|bru|theus|casal|nós|nos|juntos|juntas)\b/gi, " ")
    .replace(/\b(?:gastei|gasto|paguei|comprei|comprou|compramos|custou|registra|registre|registrar|foi|fomos)\b/gi, " ")
    .replace(/\b(?:por|de|no|na|em|com|para|o|a|um|uma)\b/gi, " ")
    .replace(/(?:r\$\s*)?(\d{1,3}(?:\.\d{3})*(?:,\d{1,2})?|\d+(?:[.,]\d{1,2})?)/i, " ")
    .replace(/\s+/g, " ").trim().replace(/^[\s:,-]+|[\s:,-]+$/g, "") || "Novo gasto";
}

function detectPerson(text: string, fallback: Person): Person {
  if (/\bmatheus\b|\btheus\b/i.test(text)) return "Matheus";
  if (/\bbruna\b|\bbru\b/i.test(text)) return "Bruna";
  if (/\bnós\b|\bnos\b|\bcasal\b|\bjuntos\b|\bjuntas\b|\bfomos\b/i.test(text)) return "Casal";
  return fallback;
}

export default function Page() {
  const [tab, setTab] = useState<Tab>("home");
  const [activeProfile, setActiveProfile] = useState<Person>("Bruna");
  const [theme, setTheme] = useState<ThemeMode>("system");
  const [themeOpen, setThemeOpen] = useState(false);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [viewMonth, setViewMonth] = useState(dateKey());
  const [expenses, setExpenses] = useState<Expense[]>(INITIAL_EXPENSES);
  const [installments, setInstallments] = useState<Installment[]>(INITIAL_INSTALLMENTS);
  const [debts, setDebts] = useState<Debt[]>([]);
  const [incomeEntries, setIncomeEntries] = useState<IncomeEntry[]>([]);
  const [income, setIncome] = useState(13000);
  const [budgets, setBudgets] = useState(DEFAULT_BUDGETS);
  const [limits, setLimits] = useState({ Bruna: 350, Matheus: 350 });
  const [text, setText] = useState("");
  const [toast, setToast] = useState("");
  const [modal, setModal] = useState<"none" | "expense" | "installment" | "debt" | "income" | "receive" | "advance" | "settings">("none");
  const [advancingInstallment, setAdvancingInstallment] = useState<Installment | null>(null);
  const [advanceCount, setAdvanceCount] = useState("1");
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [receivingDebt, setReceivingDebt] = useState<Debt | null>(null);
  const [receiveAmount, setReceiveAmount] = useState("");
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [editingInstallment, setEditingInstallment] = useState<Installment | null>(null);
  const [editingDebt, setEditingDebt] = useState<Debt | null>(null);
  const [editingIncome, setEditingIncome] = useState<IncomeEntry | null>(null);
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false);
  const [form, setForm] = useState({ title: "", amount: "", cat: "Outros", who: "Bruna" as Person, date: viewMonth + "-01" });
  const [instForm, setInstForm] = useState({ title: "", amount: "", category: "Outros", who: "Bruna" as Person, total: "", paid: "0", nextDue: "" });
  const [debtForm, setDebtForm] = useState({ person: "Amigo", amount: "", paid: "0", destination: "bruna" as DebtDestination, note: "", month: viewMonth });
  const [incomeForm, setIncomeForm] = useState({ title: "", amount: "", who: "Bruna" as Person, date: viewMonth + "-01", destination: "conta" as "conta" | "cartao", note: "" });
  const [chat, setChat] = useState<ChatMessage[]>([{ id: 1, role: "assistant", text: "Oi! 💚 Estou falando com você como Bruna. Escolha o perfil no topo para definir quem está falando. Se a frase citar Bruna, Matheus ou casal, isso ganha prioridade." }]);
  const messagesRef = useRef<HTMLDivElement>(null);
  const chatScrollTop = useRef(0);

  const applyTheme = (mode: ThemeMode) => {
    setTheme(mode); setThemeOpen(false);
    localStorage.setItem("brumath-theme", mode);
    document.documentElement.dataset.theme = mode;
  };

  useEffect(() => {
    try {
      const storedTheme = (localStorage.getItem("brumath-theme") as ThemeMode | null) || "system";
      setTheme(storedTheme); document.documentElement.dataset.theme = storedTheme;
      const saved = localStorage.getItem("brumath-data");
      if (saved) {
        const data = JSON.parse(saved);
        if (Array.isArray(data.expenses)) setExpenses(data.expenses);
        if (Array.isArray(data.installments)) setInstallments(data.installments);
        if (Array.isArray(data.debts)) setDebts(data.debts.map((debt: Debt) => ({ ...debt, month: debt.month || data.viewMonth || dateKey() })));
        if (Array.isArray(data.incomeEntries)) setIncomeEntries(data.incomeEntries);
        if (typeof data.income === "number") setIncome(data.income);
        if (data.budgets) setBudgets({ ...DEFAULT_BUDGETS, ...data.budgets });
        if (data.limits) setLimits({ Bruna: 350, Matheus: 350, ...data.limits });
        if (data.activeProfile) setActiveProfile(data.activeProfile);
        if (data.viewMonth) setViewMonth(data.viewMonth);
      }
    } catch { document.documentElement.dataset.theme = "system"; }
  }, []);

  useEffect(() => {
    localStorage.setItem("brumath-data", JSON.stringify({ expenses, installments, debts, incomeEntries, income, budgets, limits, activeProfile, viewMonth }));
  }, [expenses, installments, debts, incomeEntries, income, budgets, limits, activeProfile, viewMonth]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 2300);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (modal === "none" && !confirmation) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [modal, confirmation]);

  const monthExpenses = useMemo(() => expenses.filter(e => e.date.startsWith(viewMonth)), [expenses, viewMonth]);
  const cats = useMemo(() => Object.entries(budgets).map(([category, budget]) => {
    const spent = monthExpenses.filter(expense => expense.cat === category).reduce((sum, expense) => sum + expense.amount, 0);
    return { category, budget, spent, percent: budget ? Math.min(100, spent / budget * 100) : 0 };
  }), [budgets, monthExpenses]);
  const limitItems = [
    ...(["Bruna", "Matheus"] as const).map(person => ({ id: person, label: `Gastos de ${person}`, amount: limits[person], spent: monthExpenses.filter(expense => expense.who === person).reduce((sum, expense) => sum + expense.amount, 0) })),
    ...cats.map(item => ({ id: `category:${item.category}`, label: item.category, amount: item.budget, spent: item.spent })),
  ];
  const monthIncome = useMemo(() => incomeEntries.filter(e => e.date.startsWith(viewMonth) && e.destination === "conta"), [incomeEntries, viewMonth]);
  const totalSpent = useMemo(() => monthExpenses.reduce((s, e) => s + e.amount, 0), [monthExpenses]);
  const extraIncome = useMemo(() => monthIncome.reduce((s, e) => s + e.amount, 0), [monthIncome]);
  const monthIncomeTotal = income + extraIncome;
  const available = monthIncomeTotal - totalSpent;
  const monthDebts = useMemo(() => debts.filter(d => {
    const debtMonth = d.month || viewMonth;
    if (debtMonth > viewMonth) return false;
    if (d.paid >= d.amount) return d.receivedMonth === viewMonth || debtMonth === viewMonth;
    return true;
  }), [debts, viewMonth]);
  const debtTotal = useMemo(() => monthDebts.reduce((s, d) => s + Math.max(0, d.amount - d.paid), 0), [monthDebts]);
  const activeInstallments = useMemo(() => installments.filter(i => i.paidInstallments < i.totalInstallments), [installments]); const remaining = useMemo(() => activeInstallments.reduce((s, i) => s + i.totalInstallments - i.paidInstallments, 0), [activeInstallments]);
  const futureMonthly = useMemo(() => installments.filter(i => i.paidInstallments < i.totalInstallments && i.nextDue.startsWith(viewMonth)).reduce((s, i) => s + i.amount, 0), [installments, viewMonth]);
  const resetExpenseForm = (expense?: Expense) => setForm(expense ? { title: expense.title, amount: String(expense.amount), cat: expense.cat, who: expense.who, date: expense.date } : { title: "", amount: "", cat: "Outros", who: activeProfile, date: `${viewMonth}-01` });
  const openNewExpense = () => { setQuickAddOpen(false); setEditingExpense(null); resetExpenseForm(); setModal("expense"); };
  const openNewInstallment = () => { setQuickAddOpen(false); setEditingInstallment(null); setInstForm({ title: "", amount: "", category: "Outros", who: activeProfile, total: "", paid: "0", nextDue: `${addMonths(viewMonth, 1)}-10` }); setModal("installment"); };
  const openNewIncome = () => { setQuickAddOpen(false); setEditingIncome(null); setIncomeForm({ title: "", amount: "", who: activeProfile, date: `${viewMonth}-01`, destination: "conta", note: "" }); setModal("income"); };
  const openDebt = (debt?: Debt) => { setDebtForm(debt ? { person: debt.person, amount: String(debt.amount), paid: String(debt.paid), destination: debt.destination, note: debt.note, month: debt.month || viewMonth } : { person: "Amigo", amount: "", paid: "0", destination: "bruna", note: "", month: viewMonth }); setEditingDebt(debt ?? null); setModal("debt"); };

  const saveExpense = (event: FormEvent) => {
    event.preventDefault(); const amount = Number(form.amount.replace(",", "."));
    if (!form.title.trim() || !amount || amount < 0) return setToast("Preencha descrição e valor."); const item: Expense = { id: editingExpense?.id ?? Date.now(), title: form.title.trim(), amount, cat: form.cat, who: form.who, date: form.date || viewMonth + "-01" }; setExpenses(cur => editingExpense ? cur.map(e => e.id === item.id ? item : e) : [item, ...cur]);
    setEditingExpense(null); setModal("none"); setToast(editingExpense ? "Gasto atualizado 💚" : "Gasto adicionado 💚");
  };

  const saveInstallment = (event: FormEvent) => {
    event.preventDefault(); const amount = Number(instForm.amount.replace(",", ".")); const total = Number(instForm.total); const paid = Math.max(0, Math.min(Number(instForm.paid) || 0, total));
    if (!instForm.title.trim() || !amount || amount < 0 || !total || total < 1) return setToast("Preencha os dados da parcela."); const item: Installment = { id: editingInstallment?.id ?? Date.now(), title: instForm.title.trim(), amount, category: instForm.category, who: instForm.who, totalInstallments: total, paidInstallments: paid, nextDue: instForm.nextDue || `${addMonths(viewMonth, 1)}-10` }; setInstallments(cur => editingInstallment ? cur.map(i => i.id === item.id ? item : i) : [item, ...cur]); setEditingInstallment(null); setModal("none"); setToast(editingInstallment ? "Parcela atualizada 💚" : "Parcela adicionada 💚");
  };

  const saveDebt = (event: FormEvent) => {
    event.preventDefault(); const amount = Number(debtForm.amount.replace(",", ".")); const paid = Number(debtForm.paid.replace(",", ".")) || 0;
    if (!debtForm.person.trim() || !amount || amount < 0) return setToast("Informe quem deve e o valor.");
    if (!Number.isFinite(paid) || paid < 0 || paid > amount) return setToast("O valor recebido precisa ficar entre R$ 0 e o valor total.");
    const item: Debt = { id: editingDebt?.id ?? Date.now(), person: debtForm.person.trim(), amount, destination: debtForm.destination, note: debtForm.note.trim(), paid, month: debtForm.month || viewMonth, receivedMonth: paid >= amount ? (editingDebt?.receivedMonth || viewMonth) : editingDebt?.receivedMonth }; setDebts(cur => editingDebt ? cur.map(d => d.id === item.id ? item : d) : [item, ...cur]); setEditingDebt(null); setModal("none"); setToast(editingDebt ? "Dívida atualizada 💚" : "Dívida adicionada 💚");
  };

  const saveIncome = (event: FormEvent) => {
    event.preventDefault(); const amount = Number(incomeForm.amount.replace(",", "."));
    if (!incomeForm.title.trim() || !amount || amount < 0) return setToast("Informe a entrada e o valor."); const item: IncomeEntry = { id: editingIncome?.id ?? Date.now(), title: incomeForm.title.trim(), amount, who: incomeForm.who, date: incomeForm.date || viewMonth + "-01", destination: incomeForm.destination, note: incomeForm.note.trim() }; setIncomeEntries(cur => editingIncome ? cur.map(i => i.id === item.id ? item : i) : [item, ...cur]); setEditingIncome(null); setModal("none"); setToast("Entrada salva 💚");
  };

  const openEditExpense = (expense: Expense) => { resetExpenseForm(expense); setEditingExpense(expense); setModal("expense"); };
  const openEditInstallment = (item: Installment) => { setInstForm({ title: item.title, amount: String(item.amount), category: item.category, who: item.who, total: String(item.totalInstallments), paid: String(item.paidInstallments), nextDue: item.nextDue }); setEditingInstallment(item); setModal("installment"); };
  const openEditIncome = (item: IncomeEntry) => { setIncomeForm({ title: item.title, amount: String(item.amount), who: item.who, date: item.date, destination: item.destination, note: item.note }); setEditingIncome(item); setModal("income"); };
  const openEditDebt = (debt: Debt) => { openDebt(debt); };
  const deleteExpense = (id: number) => {
    const item = expenses.find(expense => expense.id === id);
    if (!item) return;
    setConfirmation({ title: "Excluir gasto", description: `“${item.title}” será removido permanentemente.`, confirmLabel: "Excluir gasto", destructive: true, onConfirm: () => { setExpenses(cur => cur.filter(expense => expense.id !== id)); setToast("Gasto excluído"); } });
  };
  const deleteInstallment = (id: number) => {
    const item = installments.find(installment => installment.id === id);
    if (!item) return;
    setConfirmation({ title: "Excluir parcelamento", description: `“${item.title}” será removido permanentemente.`, confirmLabel: "Excluir parcelamento", destructive: true, onConfirm: () => { setInstallments(cur => cur.filter(installment => installment.id !== id)); setToast("Parcela excluída"); } });
  };
  const deleteDebt = (id: number) => {
    const item = debts.find(debt => debt.id === id);
    if (!item) return;
    setConfirmation({ title: "Excluir valor a receber", description: `“${item.person}” será removido permanentemente.`, confirmLabel: "Excluir valor", destructive: true, onConfirm: () => { setDebts(cur => cur.filter(debt => debt.id !== id)); setToast("Dívida excluída"); } });
  };
  const deleteIncome = (id: number) => {
    const item = incomeEntries.find(entry => entry.id === id);
    if (!item) return;
    setConfirmation({ title: "Excluir entrada", description: `“${item.title}” será removida permanentemente.`, confirmLabel: "Excluir entrada", destructive: true, onConfirm: () => { setIncomeEntries(cur => cur.filter(entry => entry.id !== id)); setToast("Entrada excluída"); } });
  };

  const payInstallment = (id: number, count: number) => {
    setInstallments(cur => cur.map(item => {
      if (item.id !== id) return item;
      const remainingForItem = item.totalInstallments - item.paidInstallments;
      const actual = Math.min(Math.max(0, count), remainingForItem);
      const nextPaid = item.paidInstallments + actual;
      return { ...item, paidInstallments: nextPaid, nextDue: nextPaid >= item.totalInstallments ? item.nextDue : shiftDate(item.nextDue, actual) };
    }));
    setToast(count > 1 ? `${count} parcelas adiantadas 💚` : count === 1 ? "Parcela marcada como paga 💚" : "Parcela quitada 💚");
  };

  const chooseAdvanceInstallments = (item: Installment) => {
    const left = item.totalInstallments - item.paidInstallments;
    if (!left) return;
    setAdvancingInstallment(item);
    setAdvanceCount(left > 2 ? "2" : "1");
    setModal("advance");
  };

  const chooseQuitInstallment = (item: Installment) => {
    const left = item.totalInstallments - item.paidInstallments;
    if (!left) return;
    setConfirmation({ title: "Quitar parcelamento", description: `“${item.title}” tem ${left} parcela${left === 1 ? "" : "s"} restante${left === 1 ? "" : "s"}. Todas serão quitadas.`, confirmLabel: "Confirmar quitação", onConfirm: () => payInstallment(item.id, left) });
  };

  const saveAdvanceInstallments = (event: FormEvent) => {
    event.preventDefault();
    if (!advancingInstallment) return;
    const left = advancingInstallment.totalInstallments - advancingInstallment.paidInstallments;
    const count = Number(advanceCount);
    if (!Number.isInteger(count) || count < 1 || count > left) {
      setToast(`Digite uma quantidade entre 1 e ${left}.`);
      return;
    }
    payInstallment(advancingInstallment.id, count);
    setAdvancingInstallment(null);
    setModal("none");
  };

  const openReceiveDebt = (debt: Debt) => {
    const open = Math.max(0, debt.amount - debt.paid);
    if (!open) return;
    setReceivingDebt(debt);
    setReceiveAmount("");
    setModal("receive");
  };

  const saveDebtReceipt = (event: FormEvent) => {
    event.preventDefault();
    if (!receivingDebt) return;
    const open = Math.max(0, receivingDebt.amount - receivingDebt.paid);
    const amount = Number(receiveAmount.replace(",", "."));
    if (!Number.isFinite(amount) || amount <= 0) return setToast("Informe quanto recebeu."); if (Math.round(amount * 100) > Math.round(open * 100)) return setToast(`O máximo que pode registrar agora é ${money(open)}.`);
    const nextPaid = Math.min(receivingDebt.amount, Math.round((receivingDebt.paid + amount) * 100) / 100);
    const destination = receivingDebt.destination === "cartao" ? "cartao" : "conta";
    setDebts(cur => cur.map(d => d.id === receivingDebt.id ? { ...d, paid: nextPaid, receivedMonth: viewMonth } : d));
    setIncomeEntries(cur => [...cur, { id: Date.now(), title: `Recebimento de ${receivingDebt.person}`, amount, who: activeProfile, date: `${viewMonth}-01`, destination, note: receivingDebt.note || "Pagamento de dívida" }]);
    setReceivingDebt(null);
    setReceiveAmount("");
    setModal("none");
    setToast(nextPaid >= receivingDebt.amount ? "Dívida quitada e registrada em O que entra 💚" : `${money(amount)} recebido. Restam ${money(receivingDebt.amount - nextPaid)} 💚`);
  };

  const send = (preset?: string) => {
    const value = (preset ?? text).trim(); if (!value) return;
    const normalized = value.toLowerCase(); const amount = parseAmount(value); const who = detectPerson(value, activeProfile);
    const push = (assistant: string) => { const now = Date.now(); setChat(cur => [...cur, { id: now, role: "user", text: value }, { id: now + 1, role: "assistant", text: assistant }]); setText(""); };
    const insightText = () => {
      const top = [...cats].sort((a, b) => b.spent - a.spent)[0];
      const nearLimit = cats.filter(x => x.budget > 0 && x.spent / x.budget >= 0.8).sort((a, b) => b.percent - a.percent);
      const personal = (["Bruna", "Matheus"] as const).map(person => {
        const spent = monthExpenses.filter(e => e.who === person).reduce((s, e) => s + e.amount, 0);
        return { person, spent, limit: limits[person] };
      });
      const personalText = personal.map(x => `${x.person}: ${money(x.spent)} de ${money(x.limit)} (${x.limit ? Math.round(x.spent / x.limit * 100) : 0}%)`).join(" • ");
      const alerts = nearLimit.slice(0, 3).map(x => `${x.category} está em ${Math.round(x.percent)}%`).join(", ");
      return `Insights de ${monthLabel(viewMonth)}: ${top ? `maior categoria: ${top.category}, ${money(top.spent)}.` : "ainda não há gastos categorizados."} ${alerts ? `Atenção: ${alerts}.` : "Nenhuma categoria chegou a 80% do limite."} Limites pessoais: ${personalText}. ${activeInstallments.length ? `${activeInstallments.length} parcelados ativos e ${money(futureMonthly)} previstos neste mês.` : "Sem parcelas ativas neste mês."} ${debtTotal ? `Você ainda tem ${money(debtTotal)} a receber.` : ""}`;
    };
    const limitWords = ["limite", "quanto ainda posso", "quanto posso gastar", "quanto resta", "quanto ainda tenho"];
    if (limitWords.some(w => normalized.includes(w))) {
      const person = /\bmatheus\b/.test(normalized) ? "Matheus" : /\bbruna\b/.test(normalized) ? "Bruna" : null;
      const budgetCategory = Object.keys(budgets).find(cat => normalized.includes(cat.toLowerCase()));
      if (budgetCategory) {
        const data = cats.find(x => x.category === budgetCategory);
        if (data) return push(`No limite de ${budgetCategory} em ${monthLabel(viewMonth)}, você já usou ${money(data.spent)} de ${money(data.budget)} (${Math.round(data.percent)}%). Restam ${money(Math.max(0, data.budget - data.spent))}.`);
      }
      if (person) {
        const spent = monthExpenses.filter(e => e.who === person).reduce((s, e) => s + e.amount, 0);
        return push(`No limite pessoal de ${person}, você já usou ${money(spent)} de ${money(limits[person])}. Restam ${money(Math.max(0, limits[person] - spent))} (${limits[person] ? Math.round(spent / limits[person] * 100) : 0}% usado).`);
      }
      return push(`Me diga a categoria ou a pessoa. Ex.: "quanto ainda tenho no limite de Casa?" ou "quanto resta do limite do Matheus?"`);
    }
    if (/insight|insights|analisa|análise|analise|como estamos|como está/.test(normalized)) return push(insightText());
    if (/resumo|situação|situacao/.test(normalized)) return push(`Em ${monthLabel(viewMonth)}: ${money(totalSpent)} gastos, ${money(available)} disponíveis, ${activeInstallments.length} parcelados ativos e ${money(debtTotal)} a receber. ${insightText()}`);
    if (/quanto temos|saldo|disponível|disponivel|quanto tem/.test(normalized)) return push(`Renda base: ${money(income)}. Entradas extras: ${money(extraIncome)}. Gastos: ${money(totalSpent)}. Disponível: ${money(available)}. A receber: ${money(debtTotal)}.`);
    if (/parcela|parcelas|futuro|compromisso/.test(normalized)) return push(`Há ${activeInstallments.length} parcelados ativos, ${remaining} parcelas restantes e ${money(futureMonthly)} previstos para ${monthLabel(viewMonth)}.`);
    if (/quem.*deve|me deve|a receber|devedor/.test(normalized)) return push(debtTotal ? `Em ${monthLabel(viewMonth)}, você tem ${money(debtTotal)} a receber. O menu Quem me deve mostra os valores desse mês e se cada pagamento vai para o cartão ou para você.` : `Ainda não há valores a receber em ${monthLabel(viewMonth)}. Use + > A receber ou o menu Quem me deve para cadastrar uma cobrança neste mês.`);
    if (/o que entra|entradas|receita|recebi/.test(normalized)) return push(`Em ${monthLabel(viewMonth)} entraram ${money(extraIncome)} além da renda base. O menu O que entra concentra salário extra, reembolsos e recebimentos.`);

    if (amount && /gastei|gasto|paguei|comprei|comprou|compramos|custou|registra|registre|foi|fomos/.test(normalized)) {
      const item: Expense = { id: Date.now(), title: cleanExpenseTitle(value), cat: categoryFromText(value), who, amount, date: new Date().toISOString().slice(0, 10) };
      setExpenses(cur => [item, ...cur]); setToast("Gasto registrado 💚");
      return push(`Registrado: ${money(amount)} em ${item.cat}, como ${item.who}. Se não houver nome na frase, uso o perfil selecionado no topo.`);
    }
    push("Posso registrar gastos, consultar saldo, parcelas, orçamento, Quem me deve e O que entra. Ex.: “Matheus comprou bermuda por 70” ou “gastei 85 no mercado”.");
  };

  const switchTab = (next: Tab) => { if (tab === "chat" && messagesRef.current) chatScrollTop.current = messagesRef.current.scrollTop; setQuickAddOpen(false); setMobileMoreOpen(false); setTab(next); };
  const selectedMonthExpenses = monthExpenses.slice().sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);
  const selectedIncome = incomeEntries.filter(i => i.date.startsWith(viewMonth)).sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);
  const selectedDebts = monthDebts.slice().sort((a, b) => a.person.localeCompare(b.person) || b.id - a.id);
  const selectedInstallments = installments.slice().sort((a, b) => a.nextDue.localeCompare(b.nextDue));
  const monthName = monthLabel(viewMonth);

  return (
    <>
    <div className="app-shell">
      {toast && <div className="toast">{toast}</div>}
      <AppSidebar activeTab={tab} onNavigate={switchTab} />
      <div className="app-workspace">
      <header className="topbar">
        <div className="brand-area">
          <div className="brand">Bru<span>Math</span> 💚</div>
          <div className="subtitle">Finanças de Bruna &amp; Matheus</div>
        </div>
        <div className="topbar-actions">
          <div className="profile-switch" aria-label="Perfil atual">
            <span className="profile-label">Falando como</span>
            {(["Bruna", "Matheus", "Casal"] as Person[]).map(person => <button key={person} type="button" className={`profile-chip ${activeProfile === person ? "active" : ""}`} onClick={() => setActiveProfile(person)}>{person}</button>)}
          </div>
          <div className="theme-control">
            <button type="button" className="theme-button" onClick={() => setThemeOpen(v => !v)} aria-label={`Tema: ${theme}`}>
              {theme === "light" ?
                <Sun size={18} /> : theme === "dark" ?
                  <Moon size={18} /> :
                  <Monitor size={18} />}
            </button>
            {themeOpen && <div className="theme-menu"><button type="button" className={`theme-option ${theme === "light" ? "active" : ""}`} onClick={() => applyTheme("light")}>
              <Sun size={16} /><span>Claro</span>
            </button><button type="button" className={`theme-option ${theme === "dark" ? "active" : ""}`} onClick={() => applyTheme("dark")}>
                <Moon size={16} /><span>Escuro</span>
              </button><button type="button" className={`theme-option ${theme === "system" ? "active" : ""}`} onClick={() => applyTheme("system")}>
                <Monitor size={16} /><span>Automático</span>
              </button></div>}
          </div>
        </div>
      </header>

      <main className="page">
        {tab !== "preferences" && <MonthSelector
          monthLabel={monthName}
          isPreviousActive={viewMonth === addMonths(dateKey(), -1)}
          isCurrentActive={viewMonth === dateKey()}
          isNextActive={viewMonth === addMonths(dateKey(), 1)}
          onPrevious={() => setViewMonth(addMonths(dateKey(), -1))}
          onCurrent={() => setViewMonth(dateKey())}
          onNext={() => setViewMonth(addMonths(dateKey(), 1))}
          onStepPrevious={() => setViewMonth(addMonths(viewMonth, -1))}
          onStepNext={() => setViewMonth(addMonths(viewMonth, 1))}
        />}

        {tab === "home" && <NewHome
  profile={activeProfile}
  monthLabel={monthName}
  balance={available}
  income={monthIncomeTotal}
  extraIncome={extraIncome}
  expenses={totalSpent}
  formatMoney={money}
                               insights={<ExpenseSummary
    receivableCount={monthDebts.filter(debt => debt.amount > debt.paid).length}
    extraIncome={money(extraIncome)}
    extraIncomeCount={selectedIncome.length}
    totalSpent={money(totalSpent)}
    expenseCount={monthExpenses.length}
    installmentCount={activeInstallments.length}
    remainingInstallments={remaining}
    onReceivablesClick={() => switchTab("debts")}
    onExtraIncomeClick={() => switchTab("income")}
    onExpensesClick={() => switchTab("stats")}
    onInstallmentsClick={() => switchTab("future")}
  />}
  limits={<HomeLimits items={limitItems} onConfigure={() => switchTab("limits")} />}
  upcoming={<>
    <HomeAssistantPreview profile={activeProfile} latestMessage={chat.length === 1 ? `Oi, ${activeProfile} 💚 O que vamos organizar hoje?` : chat.at(-1)?.text} value={text} onChange={setText} onSend={preset => { if (!(preset ?? text).trim()) return; send(preset); }} onOpenConversation={() => switchTab("chat")} />
    <HomeExpenses monthLabel={monthName} expenses={selectedMonthExpenses} onEdit={openEditExpense} onDelete={deleteExpense} formatMoney={money} formatDate={shortDate} renderIcon={iconFor} />
  </>}
/>}

        {tab === "chat" && <AssistantChat profile={activeProfile} monthLabel={monthName} messages={chat} value={text} onChange={setText} onSend={send} messagesRef={messagesRef} scrollPosition={chatScrollTop} />}

        {tab === "stats" && <ExpensesScreen monthLabel={monthName} expenses={selectedMonthExpenses} formatMoney={money} formatDate={shortDate} renderIcon={iconFor} onCreate={openNewExpense} onEdit={openEditExpense} onDelete={deleteExpense} />}

        {tab === "limits" && <LimitsScreen monthLabel={monthName} items={limitItems} onConfigure={() => {}} onSave={values => { setLimits({ Bruna: values.Bruna, Matheus: values.Matheus }); setBudgets(Object.fromEntries(Object.keys(budgets).map(category => [category, values[`category:${category}`]]))); setToast("Limites atualizados 💚"); }} />}

        {tab === "future" && <FutureScreen monthKey={viewMonth} monthLabel={monthName} available={available} installments={selectedInstallments} formatMoney={money} formatDate={shortDate} renderIcon={iconFor} onCreate={openNewInstallment} onPay={payInstallment} onAdvance={chooseAdvanceInstallments} onQuit={chooseQuitInstallment} onEdit={openEditInstallment} onDelete={deleteInstallment} />}

        {tab === "debts" && <DebtSection monthName={monthName} fallbackMonth={viewMonth} totalPending={debtTotal} openCount={selectedDebts.filter(debt => debt.amount > debt.paid).length} debts={selectedDebts} formatMoney={money} formatMonth={monthLabelShort} onCreate={() => openDebt()} onEdit={openEditDebt} onDelete={deleteDebt} onReceive={openReceiveDebt} />}

        {tab === "income" &&
          <IncomeSection monthName={monthName} income={income} extraIncome={extraIncome} totalAvailable={monthIncomeTotal} entries={selectedIncome} formatMoney={money} onCreate={openNewIncome} onEdit={openEditIncome} onDelete={deleteIncome} />}

        {tab === "preferences" && <PreferencesScreen profile={activeProfile} theme={theme} onProfileChange={setActiveProfile} onThemeChange={applyTheme} />}
      </main>
      </div>

      </div>
      <ViewportNavigation>
      <div className="fab-wrap">{quickAddOpen && <div className="quick-add-menu"><button type="button" onClick={openNewExpense}>
        <Receipt size={17} /> Gasto
      </button><button type="button" onClick={openNewInstallment}>
          <CreditCard size={17} /> Parcela
        </button><button type="button" onClick={openNewIncome}>
          <WalletCards size={17} /> Entrada
        </button><button type="button" onClick={() => { setQuickAddOpen(false); openDebt(); }}>
          <WalletCards size={17} /> A receber
        </button></div>}<button type="button" className={`floating-add ${quickAddOpen ? "is-open" : ""}`} onClick={() => setQuickAddOpen(v => !v)} aria-label="Adicionar" aria-expanded={quickAddOpen}>{quickAddOpen ?
          <X size={23} /> :
          <Plus size={25} />}
        </button></div>

      {mobileMoreOpen && <div className="mobile-more-menu" aria-label="Mais opções">
        <button type="button" onClick={() => switchTab("stats")}><Receipt size={17} /> Gastos</button>
        <button type="button" onClick={() => switchTab("limits")}><Tag size={17} /> Limites e categorias</button>
        <button type="button" onClick={() => switchTab("debts")}><WalletCards size={17} /> Quem me deve</button>
        <button type="button" onClick={() => switchTab("income")}><Sparkles size={17} /> Entradas &amp; extras</button>
        <button type="button" onClick={() => switchTab("preferences")}><Settings2 size={17} /> Preferências</button>
      </div>}

      <nav className="bottom-nav" aria-label="Navegação principal">
        <NavButton active={tab === "home"} onClick={() => switchTab("home")} icon={
          <Home size={19} />} label="Início" />
        <NavButton active={tab === "chat"} onClick={() => switchTab("chat")} icon={
          <MessageCircle size={19} />} label="Assistente" />
        <span className="bottom-nav-add-slot" aria-hidden="true" />
        <NavButton active={tab === "future"} onClick={() => switchTab("future")} icon={
          <CalendarDays size={19} />} label="Futuro" />
        <NavButton active={tab === "stats" || tab === "debts" || tab === "income" || tab === "limits" || tab === "preferences"} onClick={() => setMobileMoreOpen(open => !open)} icon={
          <MoreHorizontal size={19} />} label="Mais" />
      </nav>
      </ViewportNavigation>

      {modal !== "none" && <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) setModal("none"); }}><div className="modal-card" role="dialog" aria-modal="true">
        <div className="modal-header">
          <div><span className="eyebrow">
            <Receipt size={15} /> BruMath
          </span>
            <h2>{modal === "expense" ? (editingExpense ? "Editar gasto" : "Adicionar gasto") : modal === "installment" ? (editingInstallment ? "Editar parcela" : "Nova parcela") : modal === "debt" ? (editingDebt ? "Editar quem me deve" : "Adicionar quem me deve") : modal === "income" ? (editingIncome ? "Editar entrada" : "Nova entrada") : modal === "receive" ? "Registrar recebimento" : modal === "advance" ? "Adiantar parcelas" : "Renda e orçamento"}</h2>
          </div><button type="button" className="icon-button" onClick={() => { setAdvancingInstallment(null); setModal("none"); }}>
            <X size={18} />
          </button>
        </div>
        {modal === "expense" && <form onSubmit={saveExpense}><label className="field"><span>O que foi?</span><input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Ex.: Mercado" required /></label>
          <div className="form-grid"><label className="field"><span>Valor</span><MoneyInput value={form.amount} onValueChange={value => setForm({ ...form, amount: value })} placeholder="50,00" required /></label><label className="field"><span>Data</span><DateInput value={form.date} onValueChange={value => setForm({ ...form, date: value })} /></label></div>
          <div className="form-grid"><label className="field"><span>Categoria</span><select value={form.cat} onChange={e => setForm({ ...form, cat: e.target.value })}>{Object.keys(budgets).map(c => <option key={c}>{c}</option>)}</select></label><label className="field"><span>Quem</span><select value={form.who} onChange={e => setForm({ ...form, who: e.target.value as Person })}><option>Bruna</option>
            <option>Matheus</option>
            <option>Casal</option>
          </select></label></div><button type="submit" className="primary-button">
            <Check size={17} /> Salvar gasto
          </button>
        </form>}
        {modal === "installment" && <form onSubmit={saveInstallment}><label className="field"><span>Nome</span><input value={instForm.title} onChange={e => setInstForm({ ...instForm, title: e.target.value })} placeholder="Ex.: Notebook" required /></label>
          <div className="form-grid"><label className="field"><span>Valor mensal</span><MoneyInput value={instForm.amount} onValueChange={value => setInstForm({ ...instForm, amount: value })} placeholder="300,00" required /></label><label className="field"><span>Total de parcelas</span><input type="number" min="1" value={instForm.total} onChange={e => setInstForm({ ...instForm, total: e.target.value })} required /></label></div>
          <div className="form-grid"><label className="field"><span>Já pagas</span><input type="number" min="0" value={instForm.paid} onChange={e => setInstForm({ ...instForm, paid: e.target.value })} /></label><label className="field"><span>Próximo vencimento</span><DateInput value={instForm.nextDue} onValueChange={value => setInstForm({ ...instForm, nextDue: value })} /></label></div>
          <div className="form-grid"><label className="field"><span>Categoria</span><select value={instForm.category} onChange={e => setInstForm({ ...instForm, category: e.target.value })}>{Object.keys(budgets).map(c => <option key={c}>{c}</option>)}</select></label><label className="field"><span>Quem</span><select value={instForm.who} onChange={e => setInstForm({ ...instForm, who: e.target.value as Person })}><option>Bruna</option>
            <option>Matheus</option>
            <option>Casal</option>
          </select></label></div><button type="submit" className="primary-button">
            <Check size={17} /> Salvar parcela
          </button>
        </form>}
        {modal === "debt" && <form onSubmit={saveDebt}><label className="field"><span>Quem deve?</span><input value={debtForm.person} onChange={e => setDebtForm({ ...debtForm, person: e.target.value })} placeholder="Ex.: João" required /></label><div className="form-grid"><label className="field"><span>Valor total</span><MoneyInput value={debtForm.amount} onValueChange={value => setDebtForm({ ...debtForm, amount: value })} placeholder="13.000,00" required /></label><label className="field"><span>Já recebido</span><MoneyInput maximum={Number(debtForm.amount) || 0} value={debtForm.paid} onValueChange={value => setDebtForm({ ...debtForm, paid: value })} placeholder="0,00" /></label></div>
          <div className="form-grid"><label className="field"><span>Mês</span><input type="month" value={debtForm.month} onChange={e => setDebtForm({ ...debtForm, month: e.target.value })} /></label><label className="field"><span>Quando pagar, vai para</span><select value={debtForm.destination} onChange={e => setDebtForm({ ...debtForm, destination: e.target.value as DebtDestination })}><option value="cartao">Cartão</option>
            <option value="bruna">Bruna</option>
            <option value="matheus">Matheus</option>
            <option value="casal">Casal</option>
          </select></label></div><label className="field"><span>Observação</span><input value={debtForm.note} onChange={e => setDebtForm({ ...debtForm, note: e.target.value })} placeholder="Ex.: amigo me deve R$ 13 mil" /></label><button type="submit" className="primary-button">
            <Check size={17} /> Salvar valor a receber
          </button>
        </form>}
        {modal === "receive" && receivingDebt && <form onSubmit={saveDebtReceipt}>
          <div className="receive-summary"><span>Valor em aberto</span><strong>{money(Math.max(0, receivingDebt.amount - receivingDebt.paid))}</strong><small>{receivingDebt.person}{receivingDebt.note ? ` · ${receivingDebt.note}` : ""}</small></div><label className="field"><span>Quanto você recebeu?</span><MoneyInput autoFocus value={receiveAmount} maximum={Math.max(0, receivingDebt.amount - receivingDebt.paid)} onValueChange={setReceiveAmount} placeholder="Ex.: 200,00" required /></label>
          <p className="receive-help">Você pode receber uma parte agora e o restante continuará em aberto para os próximos meses.</p><button type="submit" className="primary-button">
            <Check size={17} /> Registrar recebimento
          </button>
        </form>}
        {modal === "advance" && advancingInstallment && <form onSubmit={saveAdvanceInstallments}>
          <div className="receive-summary"><span>Parcela</span><strong>{advancingInstallment.title}</strong><small>Você pode adiantar até {advancingInstallment.totalInstallments - advancingInstallment.paidInstallments} parcelas.</small></div>
          <label className="field"><span>Quantas parcelas deseja adiantar?</span><input autoFocus type="number" min="1" max={advancingInstallment.totalInstallments - advancingInstallment.paidInstallments} value={advanceCount} onChange={event => setAdvanceCount(event.target.value)} required /></label>
          <div className="modal-actions"><button type="button" className="secondary-button" onClick={() => { setAdvancingInstallment(null); setModal("none"); }}>Cancelar</button><button type="submit" className="primary-button"><Check size={17} /> Confirmar adianto</button></div>
        </form>}
        {modal === "income" && <form onSubmit={saveIncome}><label className="field"><span>Entrada</span><input value={incomeForm.title} onChange={e => setIncomeForm({ ...incomeForm, title: e.target.value })} placeholder="Ex.: Reembolso" required /></label>
          <div className="form-grid"><label className="field"><span>Valor</span><MoneyInput value={incomeForm.amount} onValueChange={value => setIncomeForm({ ...incomeForm, amount: value })} placeholder="500,00" required /></label><label className="field"><span>Data</span><DateInput value={incomeForm.date} onValueChange={value => setIncomeForm({ ...incomeForm, date: value })} /></label></div>
          <div className="form-grid"><label className="field"><span>Quem</span><select value={incomeForm.who} onChange={e => setIncomeForm({ ...incomeForm, who: e.target.value as Person })}><option>Bruna</option>
            <option>Matheus</option>
            <option>Casal</option>
          </select></label><label className="field"><span>Destino</span><select value={incomeForm.destination} onChange={e => setIncomeForm({ ...incomeForm, destination: e.target.value as "conta" | "cartao" })}><option value="conta">Conta</option>
            <option value="cartao">Cartão</option>
          </select></label></div><label className="field"><span>Observação</span><input value={incomeForm.note} onChange={e => setIncomeForm({ ...incomeForm, note: e.target.value })} /></label><button type="submit" className="primary-button">
            <Check size={17} /> Salvar entrada
          </button>
        </form>}
        {modal === "settings" && <form onSubmit={e => { e.preventDefault(); setModal("none"); setToast("Renda e orçamento atualizados 💚"); }}><label className="field"><span>Renda mensal base</span><MoneyInput value={income} onValueChange={value => setIncome(Number(value))} /></label>
          <div className="form-grid"><label className="field"><span>Limite Bruna</span><MoneyInput value={limits.Bruna} onValueChange={value => setLimits({ ...limits, Bruna: Number(value) })} /></label><label className="field"><span>Limite Matheus</span><MoneyInput value={limits.Matheus} onValueChange={value => setLimits({ ...limits, Matheus: Number(value) })} /></label></div>
          <div className="settings-grid">{Object.entries(budgets).map(([category, value]) => <label className="field" key={category}><span>Limite {category}</span><MoneyInput value={value} onValueChange={nextValue => setBudgets({ ...budgets, [category]: Number(nextValue) })} /></label>)}</div><button type="submit" className="primary-button">
            <Check size={17} /> Salvar orçamento
          </button>
        </form>}
      </div>
      </div>}
      {confirmation && <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) setConfirmation(null); }}><div className="modal-card" role="dialog" aria-modal="true" aria-labelledby="confirmation-title">
        <div className="modal-header"><div><span className="eyebrow"><Receipt size={15} /> BruMath</span><h2 id="confirmation-title">{confirmation.title}</h2></div><button type="button" className="icon-button" onClick={() => setConfirmation(null)} aria-label="Fechar confirmação"><X size={18} /></button></div>
        <p className="confirmation-copy">{confirmation.description}</p>
        <div className="modal-actions"><button type="button" className="secondary-button" onClick={() => setConfirmation(null)}>Cancelar</button><button type="button" className={`primary-button ${confirmation.destructive ? "danger-button" : ""}`} onClick={() => { confirmation.onConfirm(); setConfirmation(null); }}>{confirmation.destructive && <Trash2 size={17} />}{confirmation.confirmLabel}</button></div>
      </div></div>}
    </>
  );
}
