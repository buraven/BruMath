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
import { CalendarScreen } from "../features/calendar/CalendarScreen";
import { AdvanceInstallmentsDialog } from "../features/future/AdvanceInstallmentsDialog";
import { InstallmentFormDialog } from "../features/future/InstallmentFormDialog";
import { FinancialSettingsDialog } from "../features/limits/FinancialSettingsDialog";
import { PreferencesScreen } from "../features/preferences/PreferencesScreen";
import { InvoicesScreen } from "../features/invoices/InvoicesScreen";
import { CreditCardFormDialog } from "../features/invoices/CreditCardFormDialog";
import { useThemePreference } from "../features/preferences/useThemePreference";
import { createSignOutConfirmation } from "../features/preferences/createSignOutConfirmation";
import { usePersistedFinancialState } from "../features/app/usePersistedFinancialState";
import { SupabasePersistencePanel } from "../features/persistence/SupabasePersistencePanel";
import {
  canOfferSupabaseSignOut,
  canRenderFinancialApplication,
} from "../lib/persistence/financialAccessGate";
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
  DEFAULT_CATEGORIES,
  DEFAULT_BUDGETS,
  INITIAL_EXPENSES,
  INITIAL_INSTALLMENTS,
  INITIAL_CREDIT_CARDS,
} from "../features/app/defaultFinancialData";
import { DEFAULT_PERSONAL_LIMITS } from "../lib/finance/personalLimits";
import type {
  Confirmation,
  CreditCard as CreditCardModel,
  Debt,
  Expense,
  IncomeEntry,
  Installment,
  Person,
  Tab,
  ThemeMode,
} from "../lib/app/AppTypes";
import {
  deriveInvoices,
  registerInvoicePayment,
  type DerivedInvoice,
} from "../lib/finance/invoices";
import { deriveCalendarProjection } from "../lib/finance/calendar";

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
    personalLimits,
    setPersonalLimits,
    creditCards,
    setCreditCards,
    invoicePayments,
    setInvoicePayments,
    activeProfile,
    setActiveProfile,
    viewMonth,
    setViewMonth,
    persistence,
  } = usePersistedFinancialState({
    expenses: INITIAL_EXPENSES,
    installments: INITIAL_INSTALLMENTS,
    debts: [],
    incomeEntries: [],
    income: 13000,
    budgets: DEFAULT_BUDGETS,
    limits: { Bruna: 350, Matheus: 350 },
    personalLimits: DEFAULT_PERSONAL_LIMITS,
    creditCards: INITIAL_CREDIT_CARDS,
    invoicePayments: [],
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
    | "card"
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
    categories: [...DEFAULT_CATEGORIES],
    setExpenses,
    setConfirmation,
    setToast,
    formatMoney: money,
    formatDate: shortDate,
    financialDataSource: persistence.financialDataSource,
  });
  const [receivingDebt, setReceivingDebt] = useState<Debt | null>(null);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [expenseCardPreset, setExpenseCardPreset] = useState<number>();
  const [editingInstallment, setEditingInstallment] =
    useState<Installment | null>(null);
  const [editingDebt, setEditingDebt] = useState<Debt | null>(null);
  const [editingIncome, setEditingIncome] = useState<IncomeEntry | null>(null);
  const [editingCard, setEditingCard] = useState<CreditCardModel | null>(null);
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
        personalLimits,
        viewMonth,
        profile: activeProfile,
      }),
    [
      expenses,
      installments,
      debts,
      incomeEntries,
      income,
      budgets,
      personalLimits,
      viewMonth,
      activeProfile,
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
    personalLimits,
    setLimits,
    setBudgets,
    setPersonalLimits,
  });
  const invoices = useMemo(
    () =>
      deriveInvoices({
        cards: creditCards,
        expenses,
        installments,
        payments: invoicePayments,
        profile: activeProfile,
        referenceMonth: viewMonth,
      }),
    [
      creditCards,
      expenses,
      installments,
      invoicePayments,
      activeProfile,
      viewMonth,
    ],
  );
  const calendarProjection = useMemo(
    () =>
      deriveCalendarProjection({
        month: viewMonth,
        profile: activeProfile,
        expenses,
        incomeEntries,
        installments,
        cards: creditCards,
        payments: invoicePayments,
        baseBalance: available,
        referenceDate: `${viewMonth}-01`,
      }),
    [
      activeProfile,
      available,
      creditCards,
      expenses,
      incomeEntries,
      installments,
      invoicePayments,
      viewMonth,
    ],
  );
  const saveCreditCard = (card: CreditCardModel, editing: boolean) => {
    setCreditCards((current) =>
      editing
        ? current.map((item) => (item.id === card.id ? card : item))
        : [...current, card],
    );
    setEditingCard(null);
    setModal("none");
    setToast(editing ? "Cartão atualizado 💚" : "Cartão adicionado 💚");
  };
  const payInvoice = (invoice: DerivedInvoice) => {
    setConfirmation({
      title: "Pagar fatura",
      description: `A fatura ${invoice.card.name} será marcada como paga. As compras originais não serão alteradas.`,
      confirmLabel: "Confirmar pagamento",
      onConfirm: () => {
        setInvoicePayments((current) =>
          registerInvoicePayment(
            current,
            invoice,
            new Date().toISOString().slice(0, 10),
            Date.now(),
          ),
        );
        setToast("Fatura marcada como paga 💚");
      },
    });
  };
  const openNewExpense = () => {
    setQuickAddOpen(false);
    setEditingExpense(null);
    setExpenseCardPreset(undefined);
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
    setExpenseCardPreset(undefined);
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
  const canSignOut = canOfferSupabaseSignOut({
    supabaseConfigured: persistence.configured,
    persistenceStatus: persistence.status,
  });

  if (
    !canRenderFinancialApplication({
      supabaseConfigured: persistence.configured,
      persistenceStatus: persistence.status,
    })
  ) {
    return (
      <main className="persistence-gate">
        <SupabasePersistencePanel
          configured={persistence.configured}
          status={persistence.status}
          error={persistence.error}
          migrationPreview={persistence.migrationPreview}
          onSendMagicLink={persistence.sendMagicLink}
          onImport={persistence.importLocalData}
          onRetry={persistence.retryRemoteWrite}
          onSignOut={persistence.signOut}
        />
      </main>
    );
  }

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
                    personal: {
                      bruna_nails:
                        values["personal:bruna_nails"] ??
                        personalLimits.bruna_nails,
                      bruna_personal:
                        values["personal:bruna_personal"] ??
                        personalLimits.bruna_personal,
                      matheus_personal:
                        values["personal:matheus_personal"] ??
                        personalLimits.matheus_personal,
                    },
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

            {tab === "invoices" && (
              <InvoicesScreen
                monthLabel={monthName}
                invoices={invoices}
                cards={creditCards}
                formatMoney={money}
                formatDate={shortDate}
                onCreateCard={() => {
                  setEditingCard(null);
                  setModal("card");
                }}
                onEditCard={(card) => {
                  setEditingCard(card);
                  setModal("card");
                }}
                onPay={payInvoice}
                onAddPurchase={(card) => {
                  setEditingExpense(null);
                  setExpenseCardPreset(card.id);
                  setModal("expense");
                }}
                onEditExpense={openEditExpense}
                onDeleteExpense={deleteExpense}
              />
            )}

            {tab === "future" && (
              <CalendarScreen
                month={viewMonth}
                monthLabel={monthName}
                projection={calendarProjection}
                profile={activeProfile}
                installments={installments}
                formatMoney={money}
                formatDate={shortDate}
                onPayInstallment={(id) => payInstallment(id, 1)}
                onAdvanceInstallment={chooseAdvanceInstallments}
                onQuitInstallment={chooseQuitInstallment}
                onCreateInstallment={openNewInstallment}
                onEditInstallment={openEditInstallment}
                onDeleteInstallment={deleteInstallment}
                onOpenInvoices={() => switchTab("invoices")}
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
                {...(canSignOut
                  ? {
                      onSignOut: () =>
                        setConfirmation(
                          createSignOutConfirmation(persistence.signOut),
                        ),
                    }
                  : {})}
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
            <button type="button" onClick={() => switchTab("invoices")}>
              <Receipt size={17} /> Faturas
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
            label="Calendário"
          />
          <NavButton
            active={
              tab === "stats" ||
              tab === "debts" ||
              tab === "income" ||
              tab === "categories" ||
              tab === "limits" ||
              tab === "preferences" ||
              tab === "invoices"
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
          categories={DEFAULT_CATEGORIES}
          creditCards={creditCards}
          initialCreditCardId={expenseCardPreset}
          activeProfile={activeProfile}
          viewMonth={viewMonth}
          onSave={(expense, isEditing) => {
            expenseIncomeMutations.saveExpense(expense, isEditing);
            setEditingExpense(null);
            setExpenseCardPreset(undefined);
            setModal("none");
          }}
          onClose={() => {
            setExpenseCardPreset(undefined);
            setModal("none");
          }}
          onInvalid={setToast}
        />
      )}
      {modal === "installment" && (
        <InstallmentFormDialog
          installment={editingInstallment}
          categories={DEFAULT_CATEGORIES}
          activeProfile={activeProfile}
          defaultNextDue={`${addMonths(viewMonth, 1)}-10`}
          creditCards={creditCards}
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
          personalLimits={personalLimits}
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
      {modal === "card" && (
        <CreditCardFormDialog
          card={editingCard}
          activeProfile={activeProfile}
          onSave={saveCreditCard}
          onClose={() => setModal("none")}
          onInvalid={setToast}
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
