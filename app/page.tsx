"use client";

import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { ViewportNavigation } from "../components/navigation/ViewportNavigation";
import {
  CalendarDays,
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
  Receipt,
  Settings2,
  Send,
  Sparkles,
  Sun,
  Tag,
  Trash2,
  WalletCards,
  X,
} from "lucide-react";
import { MoneyInput } from "../components/ui/MoneyInput";
import { DateInput } from "../components/ui/DateInput";
import { ExpenseList } from "../components/finance/ExpenseList";
import { DebtSection } from "../components/finance/DebtSection";
import { LimitsScreen } from "../features/limits/LimitsScreen";
import { HomeLimits } from "../features/home/components/Limits/HomeLimits";
import { IncomeSection } from "../components/finance/IncomeSection";
import { QuickActions } from "../components/finance/QuickActions";

import { NavButton } from "../components/navigation/NavButton";
import { AppSidebar } from "../components/navigation/AppSidebar";
import { MonthSelector } from "../components/navigation/MonthSelector";
import { NewHome } from "../features/home/NewHome";
import { HomeAssistantPreview } from "../features/home/components/HomeAssistantPreview/HomeAssistantPreview";
import { HomeExpenses } from "../features/home/components/HomeExpenses/HomeExpenses";
import { HomeInsights } from "../features/home/components/HomeInsights/HomeInsights";
import { deriveHomeInsights } from "../features/home/components/HomeInsights/radarInsights";
import { ExpensesScreen } from "../features/expenses/ExpensesScreen";
import { AssistantChat } from "../features/assistant/AssistantChat";
import { useAssistantController } from "../features/assistant/useAssistantController";
import { FutureScreen } from "../features/future/FutureScreen";
import { PreferencesScreen } from "../features/preferences/PreferencesScreen";
import { useThemePreference } from "../features/preferences/useThemePreference";
import { usePersistedFinancialState } from "../features/app/usePersistedFinancialState";
import { deriveFinancialSelectors } from "../features/app/financialSelectors";
import { renderCategoryIcon } from "../features/app/renderCategoryIcon";
import {
  DEFAULT_BUDGETS,
  INITIAL_EXPENSES,
  INITIAL_INSTALLMENTS,
} from "../features/app/defaultFinancialData";
import type {
  Confirmation,
  Debt,
  DebtDestination,
  Expense,
  IncomeEntry,
  Installment,
  Person,
  Tab,
  ThemeMode,
} from "../lib/app/AppTypes";

const money = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dateKey = (date = new Date()) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
};
const monthLabel = (key: string) => {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });
};
const monthLabelShort = (key: string) => {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("pt-BR", {
    month: "short",
    year: "numeric",
  });
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
const shortDate = (value: string) =>
  value
    ? new Date(`${value}T12:00:00`).toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
      })
    : "—";
export default function Page() {
  const [tab, setTab] = useState<Tab>("home");
  const { theme, applyTheme } = useThemePreference();
  const [themeOpen, setThemeOpen] = useState(false);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const {
    expenses,
    setExpenses,
    installments,
    setInstallments,
    debts,
    setDebts,
    incomeEntries,
    setIncomeEntries,
    income,
    setIncome,
    budgets,
    setBudgets,
    limits,
    setLimits,
    activeProfile,
    setActiveProfile,
    viewMonth,
    setViewMonth,
  } = usePersistedFinancialState({
    expenses: INITIAL_EXPENSES,
    installments: INITIAL_INSTALLMENTS,
    debts: [],
    incomeEntries: [],
    income: 13000,
    budgets: DEFAULT_BUDGETS,
    limits: { Bruna: 350, Matheus: 350 },
    activeProfile: "Bruna",
    viewMonth: dateKey(),
  });
  const [toast, setToast] = useState("");
  const [modal, setModal] = useState<
    | "none"
    | "expense"
    | "installment"
    | "debt"
    | "income"
    | "receive"
    | "advance"
    | "settings"
  >("none");
  const [advancingInstallment, setAdvancingInstallment] =
    useState<Installment | null>(null);
  const [advanceCount, setAdvanceCount] = useState("1");
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const {
    text,
    setText,
    assistantLoading,
    chat,
    compactAssistantMessage,
    messagesRef,
    chatScrollTop,
    send,
  } = useAssistantController({
    activeProfile,
    viewMonth,
    categories: Object.keys(budgets),
    setExpenses,
    setConfirmation,
    setToast,
    formatMoney: money,
    formatDate: shortDate,
  });
  const [receivingDebt, setReceivingDebt] = useState<Debt | null>(null);
  const [receiveAmount, setReceiveAmount] = useState("");
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [editingInstallment, setEditingInstallment] =
    useState<Installment | null>(null);
  const [editingDebt, setEditingDebt] = useState<Debt | null>(null);
  const [editingIncome, setEditingIncome] = useState<IncomeEntry | null>(null);
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false);
  const [form, setForm] = useState({
    title: "",
    amount: "",
    cat: "Outros",
    who: "Bruna" as Person,
    date: viewMonth + "-01",
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
    paid: "0",
    destination: "bruna" as DebtDestination,
    note: "",
    month: viewMonth,
  });
  const [incomeForm, setIncomeForm] = useState({
    title: "",
    amount: "",
    who: "Bruna" as Person,
    date: viewMonth + "-01",
    destination: "conta" as "conta" | "cartao",
    note: "",
  });
  const selectTheme = (mode: ThemeMode) => {
    applyTheme(mode);
    setThemeOpen(false);
  };

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

  const {
    monthExpenses,
    limitItems,
    monthIncome,
    totalSpent,
    extraIncome,
    monthIncomeTotal,
    available,
    monthDebts,
    debtTotal,
    activeInstallments,
    remaining,
  } = useMemo(
    () =>
      deriveFinancialSelectors({
        expenses,
        installments,
        debts,
        incomeEntries,
        income,
        budgets,
        limits,
        viewMonth,
      }),
    [
      expenses,
      installments,
      debts,
      incomeEntries,
      income,
      budgets,
      limits,
      viewMonth,
    ],
  );
  const resetExpenseForm = (expense?: Expense) =>
    setForm(
      expense
        ? {
            title: expense.title,
            amount: String(expense.amount),
            cat: expense.cat,
            who: expense.who,
            date: expense.date,
          }
        : {
            title: "",
            amount: "",
            cat: "Outros",
            who: activeProfile,
            date: `${viewMonth}-01`,
          },
    );
  const openNewExpense = () => {
    setQuickAddOpen(false);
    setEditingExpense(null);
    resetExpenseForm();
    setModal("expense");
  };
  const openNewInstallment = () => {
    setQuickAddOpen(false);
    setEditingInstallment(null);
    setInstForm({
      title: "",
      amount: "",
      category: "Outros",
      who: activeProfile,
      total: "",
      paid: "0",
      nextDue: `${addMonths(viewMonth, 1)}-10`,
    });
    setModal("installment");
  };
  const openNewIncome = () => {
    setQuickAddOpen(false);
    setEditingIncome(null);
    setIncomeForm({
      title: "",
      amount: "",
      who: activeProfile,
      date: `${viewMonth}-01`,
      destination: "conta",
      note: "",
    });
    setModal("income");
  };
  const openDebt = (debt?: Debt) => {
    setDebtForm(
      debt
        ? {
            person: debt.person,
            amount: String(debt.amount),
            paid: String(debt.paid),
            destination: debt.destination,
            note: debt.note,
            month: debt.month || viewMonth,
          }
        : {
            person: "Amigo",
            amount: "",
            paid: "0",
            destination: "bruna",
            note: "",
            month: viewMonth,
          },
    );
    setEditingDebt(debt ?? null);
    setModal("debt");
  };

  const saveExpense = (event: FormEvent) => {
    event.preventDefault();
    const amount = Number(form.amount.replace(",", "."));
    if (!form.title.trim() || !amount || amount < 0)
      return setToast("Preencha descrição e valor.");
    const item: Expense = {
      id: editingExpense?.id ?? Date.now(),
      title: form.title.trim(),
      amount,
      cat: form.cat,
      who: form.who,
      date: form.date || viewMonth + "-01",
    };
    setExpenses((cur) =>
      editingExpense
        ? cur.map((e) => (e.id === item.id ? item : e))
        : [item, ...cur],
    );
    setEditingExpense(null);
    setModal("none");
    setToast(editingExpense ? "Gasto atualizado 💚" : "Gasto adicionado 💚");
  };

  const saveInstallment = (event: FormEvent) => {
    event.preventDefault();
    const amount = Number(instForm.amount.replace(",", "."));
    const total = Number(instForm.total);
    const paid = Math.max(0, Math.min(Number(instForm.paid) || 0, total));
    if (!instForm.title.trim() || !amount || amount < 0 || !total || total < 1)
      return setToast("Preencha os dados da parcela.");
    const item: Installment = {
      id: editingInstallment?.id ?? Date.now(),
      title: instForm.title.trim(),
      amount,
      category: instForm.category,
      who: instForm.who,
      totalInstallments: total,
      paidInstallments: paid,
      nextDue: instForm.nextDue || `${addMonths(viewMonth, 1)}-10`,
    };
    setInstallments((cur) =>
      editingInstallment
        ? cur.map((i) => (i.id === item.id ? item : i))
        : [item, ...cur],
    );
    setEditingInstallment(null);
    setModal("none");
    setToast(
      editingInstallment ? "Parcela atualizada 💚" : "Parcela adicionada 💚",
    );
  };

  const saveDebt = (event: FormEvent) => {
    event.preventDefault();
    const amount = Number(debtForm.amount.replace(",", "."));
    const paid = Number(debtForm.paid.replace(",", ".")) || 0;
    if (!debtForm.person.trim() || !amount || amount < 0)
      return setToast("Informe quem deve e o valor.");
    if (!Number.isFinite(paid) || paid < 0 || paid > amount)
      return setToast(
        "O valor recebido precisa ficar entre R$ 0 e o valor total.",
      );
    const item: Debt = {
      id: editingDebt?.id ?? Date.now(),
      person: debtForm.person.trim(),
      amount,
      destination: debtForm.destination,
      note: debtForm.note.trim(),
      paid,
      month: debtForm.month || viewMonth,
      receivedMonth:
        paid >= amount
          ? editingDebt?.receivedMonth || viewMonth
          : editingDebt?.receivedMonth,
    };
    setDebts((cur) =>
      editingDebt
        ? cur.map((d) => (d.id === item.id ? item : d))
        : [item, ...cur],
    );
    setEditingDebt(null);
    setModal("none");
    setToast(editingDebt ? "Dívida atualizada 💚" : "Dívida adicionada 💚");
  };

  const saveIncome = (event: FormEvent) => {
    event.preventDefault();
    const amount = Number(incomeForm.amount.replace(",", "."));
    if (!incomeForm.title.trim() || !amount || amount < 0)
      return setToast("Informe a entrada e o valor.");
    const item: IncomeEntry = {
      id: editingIncome?.id ?? Date.now(),
      title: incomeForm.title.trim(),
      amount,
      who: incomeForm.who,
      date: incomeForm.date || viewMonth + "-01",
      destination: incomeForm.destination,
      note: incomeForm.note.trim(),
    };
    setIncomeEntries((cur) =>
      editingIncome
        ? cur.map((i) => (i.id === item.id ? item : i))
        : [item, ...cur],
    );
    setEditingIncome(null);
    setModal("none");
    setToast("Entrada salva 💚");
  };

  const openEditExpense = (expense: Expense) => {
    resetExpenseForm(expense);
    setEditingExpense(expense);
    setModal("expense");
  };
  const openEditInstallment = (item: Installment) => {
    setInstForm({
      title: item.title,
      amount: String(item.amount),
      category: item.category,
      who: item.who,
      total: String(item.totalInstallments),
      paid: String(item.paidInstallments),
      nextDue: item.nextDue,
    });
    setEditingInstallment(item);
    setModal("installment");
  };
  const openEditIncome = (item: IncomeEntry) => {
    setIncomeForm({
      title: item.title,
      amount: String(item.amount),
      who: item.who,
      date: item.date,
      destination: item.destination,
      note: item.note,
    });
    setEditingIncome(item);
    setModal("income");
  };
  const openEditDebt = (debt: Debt) => {
    openDebt(debt);
  };
  const deleteExpense = (id: number) => {
    const item = expenses.find((expense) => expense.id === id);
    if (!item) return;
    setConfirmation({
      title: "Excluir gasto",
      description: `“${item.title}” será removido permanentemente.`,
      confirmLabel: "Excluir gasto",
      destructive: true,
      onConfirm: () => {
        setExpenses((cur) => cur.filter((expense) => expense.id !== id));
        setToast("Gasto excluído");
      },
    });
  };
  const deleteInstallment = (id: number) => {
    const item = installments.find((installment) => installment.id === id);
    if (!item) return;
    setConfirmation({
      title: "Excluir parcelamento",
      description: `“${item.title}” será removido permanentemente.`,
      confirmLabel: "Excluir parcelamento",
      destructive: true,
      onConfirm: () => {
        setInstallments((cur) =>
          cur.filter((installment) => installment.id !== id),
        );
        setToast("Parcela excluída");
      },
    });
  };
  const deleteDebt = (id: number) => {
    const item = debts.find((debt) => debt.id === id);
    if (!item) return;
    setConfirmation({
      title: "Excluir valor a receber",
      description: `“${item.person}” será removido permanentemente.`,
      confirmLabel: "Excluir valor",
      destructive: true,
      onConfirm: () => {
        setDebts((cur) => cur.filter((debt) => debt.id !== id));
        setToast("Dívida excluída");
      },
    });
  };
  const deleteIncome = (id: number) => {
    const item = incomeEntries.find((entry) => entry.id === id);
    if (!item) return;
    setConfirmation({
      title: "Excluir entrada",
      description: `“${item.title}” será removida permanentemente.`,
      confirmLabel: "Excluir entrada",
      destructive: true,
      onConfirm: () => {
        setIncomeEntries((cur) => cur.filter((entry) => entry.id !== id));
        setToast("Entrada excluída");
      },
    });
  };

  const payInstallment = (id: number, count: number) => {
    setInstallments((cur) =>
      cur.map((item) => {
        if (item.id !== id) return item;
        const remainingForItem = item.totalInstallments - item.paidInstallments;
        const actual = Math.min(Math.max(0, count), remainingForItem);
        const nextPaid = item.paidInstallments + actual;
        return {
          ...item,
          paidInstallments: nextPaid,
          nextDue:
            nextPaid >= item.totalInstallments
              ? item.nextDue
              : shiftDate(item.nextDue, actual),
        };
      }),
    );
    setToast(
      count > 1
        ? `${count} parcelas adiantadas 💚`
        : count === 1
          ? "Parcela marcada como paga 💚"
          : "Parcela quitada 💚",
    );
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
    setConfirmation({
      title: "Quitar parcelamento",
      description: `“${item.title}” tem ${left} parcela${left === 1 ? "" : "s"} restante${left === 1 ? "" : "s"}. Todas serão quitadas.`,
      confirmLabel: "Confirmar quitação",
      onConfirm: () => payInstallment(item.id, left),
    });
  };

  const saveAdvanceInstallments = (event: FormEvent) => {
    event.preventDefault();
    if (!advancingInstallment) return;
    const left =
      advancingInstallment.totalInstallments -
      advancingInstallment.paidInstallments;
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
    if (!Number.isFinite(amount) || amount <= 0)
      return setToast("Informe quanto recebeu.");
    if (Math.round(amount * 100) > Math.round(open * 100))
      return setToast(`O máximo que pode registrar agora é ${money(open)}.`);
    const nextPaid = Math.min(
      receivingDebt.amount,
      Math.round((receivingDebt.paid + amount) * 100) / 100,
    );
    const destination =
      receivingDebt.destination === "cartao" ? "cartao" : "conta";
    setDebts((cur) =>
      cur.map((d) =>
        d.id === receivingDebt.id
          ? { ...d, paid: nextPaid, receivedMonth: viewMonth }
          : d,
      ),
    );
    setIncomeEntries((cur) => [
      ...cur,
      {
        id: Date.now(),
        title: `Recebimento de ${receivingDebt.person}`,
        amount,
        who: activeProfile,
        date: `${viewMonth}-01`,
        destination,
        note: receivingDebt.note || "Pagamento de dívida",
      },
    ]);
    setReceivingDebt(null);
    setReceiveAmount("");
    setModal("none");
    setToast(
      nextPaid >= receivingDebt.amount
        ? "Dívida quitada e registrada em O que entra 💚"
        : `${money(amount)} recebido. Restam ${money(receivingDebt.amount - nextPaid)} 💚`,
    );
  };

  const switchTab = (next: Tab) => {
    if (tab === "chat" && messagesRef.current)
      chatScrollTop.current = messagesRef.current.scrollTop;
    setQuickAddOpen(false);
    setMobileMoreOpen(false);
    setTab(next);
  };
  const selectedMonthExpenses = monthExpenses
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);
  const selectedIncome = incomeEntries
    .filter((i) => i.date.startsWith(viewMonth))
    .sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);
  const selectedDebts = monthDebts
    .slice()
    .sort((a, b) => a.person.localeCompare(b.person) || b.id - a.id);
  const selectedInstallments = installments
    .slice()
    .sort((a, b) => a.nextDue.localeCompare(b.nextDue));
  const monthName = monthLabel(viewMonth);
  const homeInsights = deriveHomeInsights({
    limitItems,
    remainingInstallments: remaining,
    activeInstallmentCount: activeInstallments.length,
    receivableTotal: debtTotal,
    formatMoney: money,
  });

  return (
    <>
      <div className="app-shell">
        {toast && <div className="toast">{toast}</div>}
        <AppSidebar activeTab={tab} onNavigate={switchTab} />
        <div className="app-workspace">
          <header className="topbar">
            <div className="brand-area">
              <div className="brand">
                Bru<span>Math</span> 💚
              </div>
              <div className="subtitle">Finanças de Bruna &amp; Matheus</div>
            </div>
            <div className="topbar-actions">
              <div className="profile-switch" aria-label="Perfil atual">
                <span className="profile-label">Falando como</span>
                {(["Bruna", "Matheus", "Casal"] as Person[]).map((person) => (
                  <button
                    key={person}
                    type="button"
                    className={`profile-chip ${activeProfile === person ? "active" : ""}`}
                    onClick={() => setActiveProfile(person)}
                  >
                    {person}
                  </button>
                ))}
              </div>
              <div className="theme-control">
                <button
                  type="button"
                  className="theme-button"
                  onClick={() => setThemeOpen((v) => !v)}
                  aria-label={`Tema: ${theme}`}
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
                      onClick={() => selectTheme("light")}
                    >
                      <Sun size={16} />
                      <span>Claro</span>
                    </button>
                    <button
                      type="button"
                      className={`theme-option ${theme === "dark" ? "active" : ""}`}
                      onClick={() => selectTheme("dark")}
                    >
                      <Moon size={16} />
                      <span>Escuro</span>
                    </button>
                    <button
                      type="button"
                      className={`theme-option ${theme === "system" ? "active" : ""}`}
                      onClick={() => selectTheme("system")}
                    >
                      <Monitor size={16} />
                      <span>Automático</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </header>

          <main className="page">
            {tab !== "preferences" && (
              <MonthSelector
                monthLabel={monthName}
                isPreviousActive={viewMonth === addMonths(dateKey(), -1)}
                isCurrentActive={viewMonth === dateKey()}
                isNextActive={viewMonth === addMonths(dateKey(), 1)}
                onPrevious={() => setViewMonth(addMonths(dateKey(), -1))}
                onCurrent={() => setViewMonth(dateKey())}
                onNext={() => setViewMonth(addMonths(dateKey(), 1))}
                onStepPrevious={() => setViewMonth(addMonths(viewMonth, -1))}
                onStepNext={() => setViewMonth(addMonths(viewMonth, 1))}
              />
            )}

            {tab === "home" && (
              <NewHome
                profile={activeProfile}
                monthLabel={monthName}
                balance={available}
                income={monthIncomeTotal}
                extraIncome={extraIncome}
                expenses={totalSpent}
                formatMoney={money}
                insights={<HomeInsights items={homeInsights} />}
                limits={
                  <HomeLimits
                    items={limitItems}
                    onConfigure={() => switchTab("limits")}
                  />
                }
                upcoming={
                  <>
                    <HomeAssistantPreview
                      profile={activeProfile}
                      latestMessage={compactAssistantMessage}
                      value={text}
                      onChange={setText}
                      onSend={(request) => {
                        const message = request?.message ?? text;
                        if (!message.trim()) return;
                        send(message, "compact", request?.quickAction);
                      }}
                      onOpenConversation={() => switchTab("chat")}
                    />
                    <HomeExpenses
                      monthLabel={monthName}
                      expenses={selectedMonthExpenses}
                      onEdit={openEditExpense}
                      onDelete={deleteExpense}
                      formatMoney={money}
                      formatDate={shortDate}
                      renderIcon={renderCategoryIcon}
                    />
                  </>
                }
              />
            )}

            {tab === "chat" && (
              <AssistantChat
                profile={activeProfile}
                monthLabel={monthName}
                messages={chat}
                value={text}
                onChange={setText}
                onSend={(message, quickAction) =>
                  send(message, "full", quickAction)
                }
                isLoading={assistantLoading}
                messagesRef={messagesRef}
                scrollPosition={chatScrollTop}
              />
            )}

            {tab === "stats" && (
              <ExpensesScreen
                monthLabel={monthName}
                expenses={selectedMonthExpenses}
                formatMoney={money}
                formatDate={shortDate}
                renderIcon={renderCategoryIcon}
                onCreate={openNewExpense}
                onEdit={openEditExpense}
                onDelete={deleteExpense}
              />
            )}

            {tab === "limits" && (
              <LimitsScreen
                monthLabel={monthName}
                items={limitItems}
                onConfigure={() => {}}
                onSave={(values) => {
                  setLimits({ Bruna: values.Bruna, Matheus: values.Matheus });
                  setBudgets(
                    Object.fromEntries(
                      Object.keys(budgets).map((category) => [
                        category,
                        values[`category:${category}`],
                      ]),
                    ),
                  );
                  setToast("Limites atualizados 💚");
                }}
              />
            )}

            {tab === "future" && (
              <FutureScreen
                monthKey={viewMonth}
                monthLabel={monthName}
                available={available}
                installments={selectedInstallments}
                formatMoney={money}
                formatDate={shortDate}
                renderIcon={renderCategoryIcon}
                onCreate={openNewInstallment}
                onPay={payInstallment}
                onAdvance={chooseAdvanceInstallments}
                onQuit={chooseQuitInstallment}
                onEdit={openEditInstallment}
                onDelete={deleteInstallment}
              />
            )}

            {tab === "debts" && (
              <DebtSection
                monthName={monthName}
                fallbackMonth={viewMonth}
                totalPending={debtTotal}
                openCount={
                  selectedDebts.filter((debt) => debt.amount > debt.paid).length
                }
                debts={selectedDebts}
                formatMoney={money}
                formatMonth={monthLabelShort}
                onCreate={() => openDebt()}
                onEdit={openEditDebt}
                onDelete={deleteDebt}
                onReceive={openReceiveDebt}
              />
            )}

            {tab === "income" && (
              <IncomeSection
                monthName={monthName}
                income={income}
                extraIncome={extraIncome}
                totalAvailable={monthIncomeTotal}
                entries={selectedIncome}
                formatMoney={money}
                onCreate={openNewIncome}
                onEdit={openEditIncome}
                onDelete={deleteIncome}
              />
            )}

            {tab === "preferences" && (
              <PreferencesScreen
                profile={activeProfile}
                theme={theme}
                onProfileChange={setActiveProfile}
                onThemeChange={applyTheme}
              />
            )}
          </main>
        </div>
      </div>
      <ViewportNavigation>
        <div className="fab-wrap">
          {quickAddOpen && (
            <div className="quick-add-menu">
              <button type="button" onClick={openNewExpense}>
                <Receipt size={17} /> Gasto
              </button>
              <button type="button" onClick={openNewInstallment}>
                <CreditCard size={17} /> Parcela
              </button>
              <button type="button" onClick={openNewIncome}>
                <WalletCards size={17} /> Entrada
              </button>
              <button
                type="button"
                onClick={() => {
                  setQuickAddOpen(false);
                  openDebt();
                }}
              >
                <WalletCards size={17} /> A receber
              </button>
            </div>
          )}
          <button
            type="button"
            className={`floating-add ${quickAddOpen ? "is-open" : ""}`}
            onClick={() => setQuickAddOpen((v) => !v)}
            aria-label="Adicionar"
            aria-expanded={quickAddOpen}
          >
            {quickAddOpen ? <X size={23} /> : <Plus size={25} />}
          </button>
        </div>

        {mobileMoreOpen && (
          <div className="mobile-more-menu" aria-label="Mais opções">
            <button type="button" onClick={() => switchTab("stats")}>
              <Receipt size={17} /> Gastos
            </button>
            <button type="button" onClick={() => switchTab("limits")}>
              <Tag size={17} /> Limites e categorias
            </button>
            <button type="button" onClick={() => switchTab("debts")}>
              <WalletCards size={17} /> Quem me deve
            </button>
            <button type="button" onClick={() => switchTab("income")}>
              <Sparkles size={17} /> Entradas &amp; extras
            </button>
            <button type="button" onClick={() => switchTab("preferences")}>
              <Settings2 size={17} /> Preferências
            </button>
          </div>
        )}

        <nav className="bottom-nav" aria-label="Navegação principal">
          <NavButton
            active={tab === "home"}
            onClick={() => switchTab("home")}
            icon={<Home size={19} />}
            label="Início"
          />
          <NavButton
            active={tab === "chat"}
            onClick={() => switchTab("chat")}
            icon={<MessageCircle size={19} />}
            label="Assistente"
          />
          <span className="bottom-nav-add-slot" aria-hidden="true" />
          <NavButton
            active={tab === "future"}
            onClick={() => switchTab("future")}
            icon={<CalendarDays size={19} />}
            label="Futuro"
          />
          <NavButton
            active={
              tab === "stats" ||
              tab === "debts" ||
              tab === "income" ||
              tab === "limits" ||
              tab === "preferences"
            }
            onClick={() => setMobileMoreOpen((open) => !open)}
            icon={<MoreHorizontal size={19} />}
            label="Mais"
          />
        </nav>
      </ViewportNavigation>

      {modal !== "none" && (
        <div
          className="modal-backdrop"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setModal("none");
          }}
        >
          <div className="modal-card" role="dialog" aria-modal="true">
            <div className="modal-header">
              <div>
                <span className="eyebrow">
                  <Receipt size={15} /> BruMath
                </span>
                <h2>
                  {modal === "expense"
                    ? editingExpense
                      ? "Editar gasto"
                      : "Adicionar gasto"
                    : modal === "installment"
                      ? editingInstallment
                        ? "Editar parcela"
                        : "Nova parcela"
                      : modal === "debt"
                        ? editingDebt
                          ? "Editar quem me deve"
                          : "Adicionar quem me deve"
                        : modal === "income"
                          ? editingIncome
                            ? "Editar entrada"
                            : "Nova entrada"
                          : modal === "receive"
                            ? "Registrar recebimento"
                            : modal === "advance"
                              ? "Adiantar parcelas"
                              : "Renda e orçamento"}
                </h2>
              </div>
              <button
                type="button"
                className="icon-button"
                onClick={() => {
                  setAdvancingInstallment(null);
                  setModal("none");
                }}
              >
                <X size={18} />
              </button>
            </div>
            {modal === "expense" && (
              <form onSubmit={saveExpense}>
                <label className="field">
                  <span>O que foi?</span>
                  <input
                    value={form.title}
                    onChange={(e) =>
                      setForm({ ...form, title: e.target.value })
                    }
                    placeholder="Ex.: Mercado"
                    required
                  />
                </label>
                <div className="form-grid">
                  <label className="field">
                    <span>Valor</span>
                    <MoneyInput
                      value={form.amount}
                      onValueChange={(value) =>
                        setForm({ ...form, amount: value })
                      }
                      placeholder="50,00"
                      required
                    />
                  </label>
                  <label className="field">
                    <span>Data</span>
                    <DateInput
                      value={form.date}
                      onValueChange={(value) =>
                        setForm({ ...form, date: value })
                      }
                    />
                  </label>
                </div>
                <div className="form-grid">
                  <label className="field">
                    <span>Categoria</span>
                    <select
                      value={form.cat}
                      onChange={(e) =>
                        setForm({ ...form, cat: e.target.value })
                      }
                    >
                      {Object.keys(budgets).map((c) => (
                        <option key={c}>{c}</option>
                      ))}
                    </select>
                  </label>
                  <label className="field">
                    <span>Quem</span>
                    <select
                      value={form.who}
                      onChange={(e) =>
                        setForm({ ...form, who: e.target.value as Person })
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
                    onChange={(e) =>
                      setInstForm({ ...instForm, title: e.target.value })
                    }
                    placeholder="Ex.: Notebook"
                    required
                  />
                </label>
                <div className="form-grid">
                  <label className="field">
                    <span>Valor mensal</span>
                    <MoneyInput
                      value={instForm.amount}
                      onValueChange={(value) =>
                        setInstForm({ ...instForm, amount: value })
                      }
                      placeholder="300,00"
                      required
                    />
                  </label>
                  <label className="field">
                    <span>Total de parcelas</span>
                    <input
                      type="number"
                      min="1"
                      value={instForm.total}
                      onChange={(e) =>
                        setInstForm({ ...instForm, total: e.target.value })
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
                      onChange={(e) =>
                        setInstForm({ ...instForm, paid: e.target.value })
                      }
                    />
                  </label>
                  <label className="field">
                    <span>Próximo vencimento</span>
                    <DateInput
                      value={instForm.nextDue}
                      onValueChange={(value) =>
                        setInstForm({ ...instForm, nextDue: value })
                      }
                    />
                  </label>
                </div>
                <div className="form-grid">
                  <label className="field">
                    <span>Categoria</span>
                    <select
                      value={instForm.category}
                      onChange={(e) =>
                        setInstForm({ ...instForm, category: e.target.value })
                      }
                    >
                      {Object.keys(budgets).map((c) => (
                        <option key={c}>{c}</option>
                      ))}
                    </select>
                  </label>
                  <label className="field">
                    <span>Quem</span>
                    <select
                      value={instForm.who}
                      onChange={(e) =>
                        setInstForm({
                          ...instForm,
                          who: e.target.value as Person,
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
                    onChange={(e) =>
                      setDebtForm({ ...debtForm, person: e.target.value })
                    }
                    placeholder="Ex.: João"
                    required
                  />
                </label>
                <div className="form-grid">
                  <label className="field">
                    <span>Valor total</span>
                    <MoneyInput
                      value={debtForm.amount}
                      onValueChange={(value) =>
                        setDebtForm({ ...debtForm, amount: value })
                      }
                      placeholder="13.000,00"
                      required
                    />
                  </label>
                  <label className="field">
                    <span>Já recebido</span>
                    <MoneyInput
                      maximum={Number(debtForm.amount) || 0}
                      value={debtForm.paid}
                      onValueChange={(value) =>
                        setDebtForm({ ...debtForm, paid: value })
                      }
                      placeholder="0,00"
                    />
                  </label>
                </div>
                <div className="form-grid">
                  <label className="field">
                    <span>Mês</span>
                    <input
                      type="month"
                      value={debtForm.month}
                      onChange={(e) =>
                        setDebtForm({ ...debtForm, month: e.target.value })
                      }
                    />
                  </label>
                  <label className="field">
                    <span>Quando pagar, vai para</span>
                    <select
                      value={debtForm.destination}
                      onChange={(e) =>
                        setDebtForm({
                          ...debtForm,
                          destination: e.target.value as DebtDestination,
                        })
                      }
                    >
                      <option value="cartao">Cartão</option>
                      <option value="bruna">Bruna</option>
                      <option value="matheus">Matheus</option>
                      <option value="casal">Casal</option>
                    </select>
                  </label>
                </div>
                <label className="field">
                  <span>Observação</span>
                  <input
                    value={debtForm.note}
                    onChange={(e) =>
                      setDebtForm({ ...debtForm, note: e.target.value })
                    }
                    placeholder="Ex.: amigo me deve R$ 13 mil"
                  />
                </label>
                <button type="submit" className="primary-button">
                  <Check size={17} /> Salvar valor a receber
                </button>
              </form>
            )}
            {modal === "receive" && receivingDebt && (
              <form onSubmit={saveDebtReceipt}>
                <div className="receive-summary">
                  <span>Valor em aberto</span>
                  <strong>
                    {money(
                      Math.max(0, receivingDebt.amount - receivingDebt.paid),
                    )}
                  </strong>
                  <small>
                    {receivingDebt.person}
                    {receivingDebt.note ? ` · ${receivingDebt.note}` : ""}
                  </small>
                </div>
                <label className="field">
                  <span>Quanto você recebeu?</span>
                  <MoneyInput
                    autoFocus
                    value={receiveAmount}
                    maximum={Math.max(
                      0,
                      receivingDebt.amount - receivingDebt.paid,
                    )}
                    onValueChange={setReceiveAmount}
                    placeholder="Ex.: 200,00"
                    required
                  />
                </label>
                <p className="receive-help">
                  Você pode receber uma parte agora e o restante continuará em
                  aberto para os próximos meses.
                </p>
                <button type="submit" className="primary-button">
                  <Check size={17} /> Registrar recebimento
                </button>
              </form>
            )}
            {modal === "advance" && advancingInstallment && (
              <form onSubmit={saveAdvanceInstallments}>
                <div className="receive-summary">
                  <span>Parcela</span>
                  <strong>{advancingInstallment.title}</strong>
                  <small>
                    Você pode adiantar até{" "}
                    {advancingInstallment.totalInstallments -
                      advancingInstallment.paidInstallments}{" "}
                    parcelas.
                  </small>
                </div>
                <label className="field">
                  <span>Quantas parcelas deseja adiantar?</span>
                  <input
                    autoFocus
                    type="number"
                    min="1"
                    max={
                      advancingInstallment.totalInstallments -
                      advancingInstallment.paidInstallments
                    }
                    value={advanceCount}
                    onChange={(event) => setAdvanceCount(event.target.value)}
                    required
                  />
                </label>
                <div className="modal-actions">
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => {
                      setAdvancingInstallment(null);
                      setModal("none");
                    }}
                  >
                    Cancelar
                  </button>
                  <button type="submit" className="primary-button">
                    <Check size={17} /> Confirmar adianto
                  </button>
                </div>
              </form>
            )}
            {modal === "income" && (
              <form onSubmit={saveIncome}>
                <label className="field">
                  <span>Entrada</span>
                  <input
                    value={incomeForm.title}
                    onChange={(e) =>
                      setIncomeForm({ ...incomeForm, title: e.target.value })
                    }
                    placeholder="Ex.: Reembolso"
                    required
                  />
                </label>
                <div className="form-grid">
                  <label className="field">
                    <span>Valor</span>
                    <MoneyInput
                      value={incomeForm.amount}
                      onValueChange={(value) =>
                        setIncomeForm({ ...incomeForm, amount: value })
                      }
                      placeholder="500,00"
                      required
                    />
                  </label>
                  <label className="field">
                    <span>Data</span>
                    <DateInput
                      value={incomeForm.date}
                      onValueChange={(value) =>
                        setIncomeForm({ ...incomeForm, date: value })
                      }
                    />
                  </label>
                </div>
                <div className="form-grid">
                  <label className="field">
                    <span>Quem</span>
                    <select
                      value={incomeForm.who}
                      onChange={(e) =>
                        setIncomeForm({
                          ...incomeForm,
                          who: e.target.value as Person,
                        })
                      }
                    >
                      <option>Bruna</option>
                      <option>Matheus</option>
                      <option>Casal</option>
                    </select>
                  </label>
                  <label className="field">
                    <span>Destino</span>
                    <select
                      value={incomeForm.destination}
                      onChange={(e) =>
                        setIncomeForm({
                          ...incomeForm,
                          destination: e.target.value as "conta" | "cartao",
                        })
                      }
                    >
                      <option value="conta">Conta</option>
                      <option value="cartao">Cartão</option>
                    </select>
                  </label>
                </div>
                <label className="field">
                  <span>Observação</span>
                  <input
                    value={incomeForm.note}
                    onChange={(e) =>
                      setIncomeForm({ ...incomeForm, note: e.target.value })
                    }
                  />
                </label>
                <button type="submit" className="primary-button">
                  <Check size={17} /> Salvar entrada
                </button>
              </form>
            )}
            {modal === "settings" && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  setModal("none");
                  setToast("Renda e orçamento atualizados 💚");
                }}
              >
                <label className="field">
                  <span>Renda mensal base</span>
                  <MoneyInput
                    value={income}
                    onValueChange={(value) => setIncome(Number(value))}
                  />
                </label>
                <div className="form-grid">
                  <label className="field">
                    <span>Limite Bruna</span>
                    <MoneyInput
                      value={limits.Bruna}
                      onValueChange={(value) =>
                        setLimits({ ...limits, Bruna: Number(value) })
                      }
                    />
                  </label>
                  <label className="field">
                    <span>Limite Matheus</span>
                    <MoneyInput
                      value={limits.Matheus}
                      onValueChange={(value) =>
                        setLimits({ ...limits, Matheus: Number(value) })
                      }
                    />
                  </label>
                </div>
                <div className="settings-grid">
                  {Object.entries(budgets).map(([category, value]) => (
                    <label className="field" key={category}>
                      <span>Limite {category}</span>
                      <MoneyInput
                        value={value}
                        onValueChange={(nextValue) =>
                          setBudgets({
                            ...budgets,
                            [category]: Number(nextValue),
                          })
                        }
                      />
                    </label>
                  ))}
                </div>
                <button type="submit" className="primary-button">
                  <Check size={17} /> Salvar orçamento
                </button>
              </form>
            )}
          </div>
        </div>
      )}
      {confirmation && (
        <div
          className="modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setConfirmation(null);
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
                onClick={() => setConfirmation(null)}
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
              <button
                type="button"
                className="secondary-button"
                onClick={() => setConfirmation(null)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className={`primary-button ${confirmation.destructive ? "danger-button" : ""}`}
                onClick={() => {
                  confirmation.onConfirm();
                  setConfirmation(null);
                }}
              >
                {confirmation.destructive && <Trash2 size={17} />}
                {confirmation.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
