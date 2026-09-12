"use client";

import { useEffect, useMemo, useState } from "react";
import { ViewportNavigation } from "../components/navigation/ViewportNavigation";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Home,
  MessageCircle,
  Monitor,
  MoreHorizontal,
  Moon,
  Pencil,
  Receipt,
  Settings2,
  Send,
  Sparkles,
  Sun,
  Tag,
  WalletCards,
} from "lucide-react";
import { ConfirmationDialog } from "../components/ui/ConfirmationDialog";
import { IncomeFormDialog } from "../components/finance/IncomeFormDialog";
import { ReceivableFormDialog } from "../components/finance/ReceivableFormDialog";
import { ReceivePaymentDialog } from "../components/finance/ReceivePaymentDialog";
import { ExpenseList } from "../components/finance/ExpenseList";
import { DebtSection } from "../components/finance/DebtSection";
import { LimitsScreen } from "../features/limits/LimitsScreen";
import { CategoriesScreen } from "../features/categories/CategoriesScreen";
import { HomeLimits } from "../features/home/components/Limits/HomeLimits";
import { IncomeSection } from "../components/finance/IncomeSection";
import { QuickActions } from "../components/finance/QuickActions";

import { NavButton } from "../components/navigation/NavButton";
import { AppSidebar } from "../components/navigation/AppSidebar";
import { QuickAddMenu } from "../components/navigation/QuickAddMenu";
import { MonthSelector } from "../components/navigation/MonthSelector";
import { NewHome } from "../features/home/NewHome";
import { HomeAssistantPreview } from "../features/home/components/HomeAssistantPreview/HomeAssistantPreview";
import { HomeExpenses } from "../features/home/components/HomeExpenses/HomeExpenses";
import { HomeInsights } from "../features/home/components/HomeInsights/HomeInsights";
import { deriveHomeInsights } from "../features/home/components/HomeInsights/radarInsights";
import { ExpensesScreen } from "../features/expenses/ExpensesScreen";
import { ExpenseFormDialog } from "../features/expenses/ExpenseFormDialog";
import { AssistantChat } from "../features/assistant/AssistantChat";
import { useAssistantController } from "../features/assistant/useAssistantController";
import { FutureScreen } from "../features/future/FutureScreen";
import { AdvanceInstallmentsDialog } from "../features/future/AdvanceInstallmentsDialog";
import { InstallmentFormDialog } from "../features/future/InstallmentFormDialog";
import { FinancialSettingsDialog } from "../features/limits/FinancialSettingsDialog";
import { PreferencesScreen } from "../features/preferences/PreferencesScreen";
import { useThemePreference } from "../features/preferences/useThemePreference";
import { usePersistedFinancialState } from "../features/app/usePersistedFinancialState";
import {
  deriveCategorySpending,
  deriveFinancialSelectors,
} from "../features/app/financialSelectors";
import {
  createExpenseIncomeMutations,
  createInstallmentMutations,
  createLimitMutations,
  createReceivableMutations,
} from "../features/app/financialMutationControllers";
import { renderCategoryIcon } from "../features/app/renderCategoryIcon";
import { HomeFinancialHighlights } from "../features/home/components/HomeFinancialHighlights/HomeFinancialHighlights";
import {
  DEFAULT_BUDGETS,
  INITIAL_EXPENSES,
  INITIAL_INSTALLMENTS,
} from "../features/app/defaultFinancialData";
import type {
  Confirmation,
  Debt,
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
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [editingInstallment, setEditingInstallment] =
    useState<Installment | null>(null);
  const [editingDebt, setEditingDebt] = useState<Debt | null>(null);
  const [editingIncome, setEditingIncome] = useState<IncomeEntry | null>(null);
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false);
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
  const expenseIncomeMutations = createExpenseIncomeMutations({
    expenses,
    incomeEntries,
    setExpenses,
    setIncomeEntries,
    setConfirmation,
    setToast,
  });
  const installmentMutations = createInstallmentMutations({
    installments,
    setInstallments,
    setConfirmation,
    setToast,
  });
  const receivableMutations = createReceivableMutations({
    debts,
    setDebts,
    setIncomeEntries,
    setConfirmation,
    setToast,
  });
  const limitMutations = createLimitMutations({
    limits,
    budgets,
    setLimits,
    setBudgets,
  });
  const openNewExpense = () => {
    setQuickAddOpen(false);
    setEditingExpense(null);
    setModal("expense");
  };
  const openNewInstallment = () => {
    setQuickAddOpen(false);
    setEditingInstallment(null);
    setModal("installment");
  };
  const openNewIncome = () => {
    setQuickAddOpen(false);
    setEditingIncome(null);
    setModal("income");
  };
  const openDebt = (debt?: Debt) => {
    setEditingDebt(debt ?? null);
    setModal("debt");
  };

  const openEditExpense = (expense: Expense) => {
    setEditingExpense(expense);
    setModal("expense");
  };
  const openEditInstallment = (item: Installment) => {
    setEditingInstallment(item);
    setModal("installment");
  };
  const openEditIncome = (item: IncomeEntry) => {
    setEditingIncome(item);
    setModal("income");
  };
  const openEditDebt = (debt: Debt) => {
    openDebt(debt);
  };
  const deleteExpense = expenseIncomeMutations.deleteExpense;
  const deleteInstallment = installmentMutations.delete;
  const deleteDebt = receivableMutations.delete;
  const deleteIncome = expenseIncomeMutations.deleteIncome;
  const payInstallment = installmentMutations.pay;

  const chooseAdvanceInstallments = (item: Installment) => {
    const left = item.totalInstallments - item.paidInstallments;
    if (!left) return;
    setAdvancingInstallment(item);
    setModal("advance");
  };

  const chooseQuitInstallment = installmentMutations.confirmQuit;

  const saveAdvanceInstallments = (count: number) => {
    if (!advancingInstallment) return;
    payInstallment(advancingInstallment.id, count);
    setAdvancingInstallment(null);
    setModal("none");
  };

  const openReceiveDebt = (debt: Debt) => {
    const open = Math.max(0, debt.amount - debt.paid);
    if (!open) return;
    setReceivingDebt(debt);
    setModal("receive");
  };

  const saveDebtReceipt = (amount: number) => {
    if (!receivingDebt) return;
    const nextPaid = receivableMutations.registerReceipt({
      debt: receivingDebt,
      amount,
      month: viewMonth,
      owner: activeProfile,
    });
    setReceivingDebt(null);
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
  const categorySpending = deriveCategorySpending(monthExpenses);

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
            {tab !== "preferences" && (
              <div className="topbar-period">
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
              </div>
            )}
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
            {tab === "home" && (
              <NewHome
                profile={activeProfile}
                monthLabel={monthName}
                balance={available}
                income={monthIncomeTotal}
                extraIncome={extraIncome}
                expenses={totalSpent}
                categories={categorySpending}
                formatMoney={money}
                insights={<HomeInsights items={homeInsights} />}
                limits={
                  <HomeLimits
                    items={limitItems}
                    onConfigure={() => switchTab("categories")}
                    renderIcon={renderCategoryIcon}
                  />
                }
                highlights={
                  <HomeFinancialHighlights
                    baseIncome={income}
                    extraIncome={extraIncome}
                    debts={selectedDebts}
                    installments={selectedInstallments}
                    formatMoney={money}
                    formatDate={shortDate}
                    onOpenIncome={() => switchTab("income")}
                    onOpenDebts={() => switchTab("debts")}
                    onOpenFuture={() => switchTab("future")}
                  />
                }
                assistant={
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
                }
                upcoming={
                  <HomeExpenses
                    monthLabel={monthName}
                    expenses={selectedMonthExpenses}
                    onEdit={openEditExpense}
                    onDelete={deleteExpense}
                    formatMoney={money}
                    formatDate={shortDate}
                    renderIcon={renderCategoryIcon}
                  />
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
                  limitMutations.save({
                    personal: { Bruna: values.Bruna, Matheus: values.Matheus },
                    categories: Object.fromEntries(
                      Object.keys(budgets).map((category) => [
                        category,
                        values[`category:${category}`],
                      ]),
                    ),
                  });
                  setToast("Limites atualizados 💚");
                }}
                renderIcon={renderCategoryIcon}
              />
            )}

            {tab === "categories" && (
              <CategoriesScreen
                monthLabel={monthName}
                profile={activeProfile}
                expenses={monthExpenses}
                budgets={budgets}
                onConfigureLimits={() => switchTab("limits")}
                onEditExpense={openEditExpense}
                onDeleteExpense={deleteExpense}
                formatMoney={money}
                formatDate={shortDate}
                renderIcon={renderCategoryIcon}
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
        <QuickAddMenu
          open={quickAddOpen}
          onToggle={() => setQuickAddOpen((value) => !value)}
          onExpense={openNewExpense}
          onInstallment={openNewInstallment}
          onIncome={openNewIncome}
          onReceivable={() => {
            setQuickAddOpen(false);
            openDebt();
          }}
        />

        {mobileMoreOpen && (
          <div className="mobile-more-menu" aria-label="Mais opções">
            <button type="button" onClick={() => switchTab("stats")}>
              <Receipt size={17} /> Gastos
            </button>
            <button type="button" onClick={() => switchTab("categories")}>
              <Tag size={17} /> Categorias
            </button>
            <button type="button" onClick={() => switchTab("limits")}>
              <Tag size={17} /> Limites
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
              tab === "categories" ||
              tab === "limits" ||
              tab === "preferences"
            }
            onClick={() => setMobileMoreOpen((open) => !open)}
            icon={<MoreHorizontal size={19} />}
            label="Mais"
          />
        </nav>
      </ViewportNavigation>

      {modal === "expense" && (
        <ExpenseFormDialog
          expense={editingExpense}
          categories={Object.keys(budgets)}
          activeProfile={activeProfile}
          viewMonth={viewMonth}
          onSave={(expense, isEditing) => {
            expenseIncomeMutations.saveExpense(expense, isEditing);
            setEditingExpense(null);
            setModal("none");
          }}
          onClose={() => setModal("none")}
          onInvalid={setToast}
        />
      )}
      {modal === "installment" && (
        <InstallmentFormDialog
          installment={editingInstallment}
          categories={Object.keys(budgets)}
          activeProfile={activeProfile}
          defaultNextDue={`${addMonths(viewMonth, 1)}-10`}
          onSave={(installment, isEditing) => {
            installmentMutations.save(installment, isEditing);
            setEditingInstallment(null);
            setModal("none");
          }}
          onClose={() => setModal("none")}
          onInvalid={setToast}
        />
      )}
      {modal === "debt" && (
        <ReceivableFormDialog
          debt={editingDebt}
          viewMonth={viewMonth}
          onSave={(debt, isEditing) => {
            receivableMutations.save(debt, isEditing);
            setEditingDebt(null);
            setModal("none");
          }}
          onClose={() => setModal("none")}
          onInvalid={setToast}
        />
      )}
      {modal === "receive" && receivingDebt && (
        <ReceivePaymentDialog
          debt={receivingDebt}
          formatMoney={money}
          onReceive={saveDebtReceipt}
          onClose={() => {
            setReceivingDebt(null);
            setModal("none");
          }}
          onInvalid={setToast}
        />
      )}
      {modal === "advance" && advancingInstallment && (
        <AdvanceInstallmentsDialog
          installment={advancingInstallment}
          onAdvance={saveAdvanceInstallments}
          onClose={() => {
            setAdvancingInstallment(null);
            setModal("none");
          }}
          onInvalid={setToast}
        />
      )}
      {modal === "income" && (
        <IncomeFormDialog
          income={editingIncome}
          activeProfile={activeProfile}
          viewMonth={viewMonth}
          onSave={(incomeEntry, isEditing) => {
            expenseIncomeMutations.saveIncome(incomeEntry, isEditing);
            setEditingIncome(null);
            setModal("none");
          }}
          onClose={() => setModal("none")}
          onInvalid={setToast}
        />
      )}
      {modal === "settings" && (
        <FinancialSettingsDialog
          income={income}
          limits={limits}
          budgets={budgets}
          onIncomeChange={setIncome}
          onPersonalLimitChange={limitMutations.updatePersonal}
          onCategoryLimitChange={limitMutations.updateCategory}
          onSave={() => {
            setModal("none");
            setToast("Renda e orçamento atualizados 💚");
          }}
          onClose={() => setModal("none")}
        />
      )}
      {confirmation && (
        <ConfirmationDialog
          confirmation={confirmation}
          onClose={() => setConfirmation(null)}
        />
      )}
    </>
  );
}
