"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { AppFinancialData } from "../../lib/app/AppTypes";
import type { FinancialDataSnapshot } from "../../lib/assistant/context/FinancialDataSource";
import { SupabaseFinancialDataSource } from "../../lib/assistant/context/SupabaseFinancialDataSource";
import { BruMathDataRepository } from "../../lib/persistence/BruMathDataRepository";
import { resolvePersistenceWriteTarget } from "../../lib/persistence/financialPersistencePolicy";
import {
  importLocalSnapshot,
  type LocalMigrationPreview,
  normalizeSnapshot,
  previewLocalMigration,
} from "../../lib/persistence/LocalSnapshotMigration";
import { SupabaseFinancialImportTarget } from "../../lib/persistence/SupabaseFinancialImportTarget";
import {
  createBruMathSupabaseClient,
  isBruMathSupabaseConfigured,
} from "../../lib/persistence/supabaseClient";
import {
  bootstrapFinancialHousehold,
  requestMagicLink,
} from "../../lib/persistence/supabaseAuth";

export type PersistenceStatus =
  | "loading"
  | "local"
  | "auth-required"
  | "bootstrapping"
  | "migration-required"
  | "migrating"
  | "remote"
  | "remote-error";

function toAppData(
  snapshot: FinancialDataSnapshot,
  fallback: AppFinancialData,
): AppFinancialData {
  return {
    expenses: [...snapshot.expenses] as AppFinancialData["expenses"],
    installments: [
      ...snapshot.installments,
    ] as AppFinancialData["installments"],
    debts: [...snapshot.debts] as AppFinancialData["debts"],
    incomeEntries: [
      ...snapshot.incomeEntries,
    ] as AppFinancialData["incomeEntries"],
    income: snapshot.income,
    budgets: { ...snapshot.budgets },
    limits: snapshot.limits as AppFinancialData["limits"],
    personalLimits: snapshot.personalLimits ?? fallback.personalLimits,
    creditCards: [
      ...(snapshot.creditCards ?? []),
    ] as AppFinancialData["creditCards"],
    invoicePayments: [
      ...(snapshot.invoicePayments ?? []),
    ] as AppFinancialData["invoicePayments"],
    activeProfile: snapshot.activeProfile ?? fallback.activeProfile,
    viewMonth: snapshot.viewMonth ?? fallback.viewMonth,
  };
}

const revision = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random()}`;

export function usePersistedFinancialState(defaults: AppFinancialData) {
  const defaultsRef = useRef(defaults);
  const initial = defaultsRef.current;
  const [expenses, setExpenses] = useState(initial.expenses);
  const [installments, setInstallments] = useState(initial.installments);
  const [debts, setDebts] = useState(initial.debts);
  const [incomeEntries, setIncomeEntries] = useState(initial.incomeEntries);
  const [income, setIncome] = useState(initial.income);
  const [budgets, setBudgets] = useState(initial.budgets);
  const [limits, setLimits] = useState(initial.limits);
  const [personalLimits, setPersonalLimits] = useState(initial.personalLimits);
  const [creditCards, setCreditCards] = useState(initial.creditCards);
  const [invoicePayments, setInvoicePayments] = useState(
    initial.invoicePayments,
  );
  const [activeProfile, setActiveProfile] = useState(initial.activeProfile);
  const [viewMonth, setViewMonth] = useState(initial.viewMonth);
  const [status, setStatus] = useState<PersistenceStatus>("loading");
  const [persistenceError, setPersistenceError] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [hasLocalSnapshot, setHasLocalSnapshot] = useState(false);
  const [migrationPreview, setMigrationPreview] =
    useState<LocalMigrationPreview>();
  const [hasHydrated, setHasHydrated] = useState(false);
  const repositoryRef = useRef<BruMathDataRepository>();
  const remoteSourceRef = useRef<SupabaseFinancialDataSource>();
  const householdIdRef = useRef("");
  const remoteBackendRef = useRef(false);
  // Once this browser session has activated the remote backend, never use the
  // legacy snapshot as an implicit write fallback. The local copy remains
  // untouched for recovery, but a remote failure must remain visible.
  const remoteWasActivatedRef = useRef(false);
  const lastRemoteSnapshotRef = useRef("");
  const remoteQueueRef = useRef(Promise.resolve());

  const snapshot = useMemo<AppFinancialData>(
    () => ({
      expenses,
      installments,
      debts,
      incomeEntries,
      income,
      budgets,
      limits,
      personalLimits,
      creditCards,
      invoicePayments,
      activeProfile,
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
      personalLimits,
      creditCards,
      invoicePayments,
      activeProfile,
      viewMonth,
    ],
  );

  const applySnapshot = (data: AppFinancialData) => {
    setExpenses(data.expenses);
    setInstallments(data.installments);
    setDebts(data.debts);
    setIncomeEntries(data.incomeEntries);
    setIncome(data.income);
    setBudgets(data.budgets);
    setLimits(data.limits);
    setPersonalLimits(data.personalLimits);
    setCreditCards(data.creditCards);
    setInvoicePayments(data.invoicePayments);
    setActiveProfile(data.activeProfile);
    setViewMonth(data.viewMonth);
  };

  useEffect(() => {
    const repository = new BruMathDataRepository();
    repositoryRef.current = repository;
    const stored = repository.readStoredData();
    const localSnapshot = repository.load(initial);
    const localExists = Object.keys(stored).length > 0;
    setHasLocalSnapshot(localExists);
    applySnapshot(localSnapshot);
    setHasHydrated(true);

    if (!isBruMathSupabaseConfigured()) {
      setStatus("local");
      return;
    }

    const client = createBruMathSupabaseClient();
    let mounted = true;
    const initialize = async () => {
      const { data } = await client.auth.getSession();
      if (!mounted) return;
      setIsAuthenticated(Boolean(data.session));
      if (!data.session) {
        setStatus("auth-required");
        return;
      }
      try {
        setStatus("bootstrapping");
        const householdId = await bootstrapFinancialHousehold(client);
        if (!mounted) return;
        householdIdRef.current = householdId;
        const target = new SupabaseFinancialImportTarget(client);
        const source = new SupabaseFinancialDataSource(client, householdId);
        remoteSourceRef.current = source;
        if (localExists) {
          const preview = previewLocalMigration(localSnapshot);
          setMigrationPreview(preview);
          if (!preview.valid) throw new Error(preview.issues.join(" "));
          if (!(await target.hasImport(householdId, preview.sourceHash))) {
            setStatus("migration-required");
            return;
          }
        }
        const remote = toAppData(await source.read(), initial);
        remoteBackendRef.current = true;
        remoteWasActivatedRef.current = true;
        lastRemoteSnapshotRef.current = normalizeSnapshot(remote);
        applySnapshot(remote);
        setStatus("remote");
      } catch (error) {
        if (!mounted) return;
        setPersistenceError(
          error instanceof Error
            ? error.message
            : "Não foi possível preparar a persistência remota.",
        );
        setStatus("remote-error");
      }
    };
    void initialize();
    const { data: listener } = client.auth.onAuthStateChange(() => {
      void initialize();
    });
    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, [initial]);

  useEffect(() => {
    if (
      !hasHydrated ||
      status === "loading" ||
      status === "bootstrapping" ||
      status === "migrating"
    ) {
      return;
    }
    const serialized = normalizeSnapshot(snapshot);
    const writeTarget = resolvePersistenceWriteTarget({
      remoteActive: remoteBackendRef.current,
      remoteWasActivated: remoteWasActivatedRef.current,
    });
    if (writeTarget === "local") {
      repositoryRef.current?.save(snapshot);
      return;
    }
    if (writeTarget === "none") {
      return;
    }
    if (serialized === lastRemoteSnapshotRef.current) return;
    const source = remoteSourceRef.current;
    if (!source) return;
    remoteQueueRef.current = remoteQueueRef.current
      .catch(() => undefined)
      .then(async () => {
        const persisted = await source.write(snapshot, revision());
        lastRemoteSnapshotRef.current = normalizeSnapshot(persisted);
        setPersistenceError("");
        setStatus("remote");
      })
      .catch(() => {
        setPersistenceError(
          "A alteração não foi salva no Supabase. Os dados locais não foram usados como fallback; tente novamente.",
        );
        setStatus("remote-error");
      });
  }, [hasHydrated, snapshot, status]);

  const sendMagicLink = async (email: string) => {
    if (!isBruMathSupabaseConfigured()) return;
    await requestMagicLink(
      createBruMathSupabaseClient(),
      email,
      window.location.origin,
    );
  };

  const importLocalData = async () => {
    const source = remoteSourceRef.current;
    const repository = repositoryRef.current;
    if (!source || !repository || !householdIdRef.current) return;
    setStatus("migrating");
    setPersistenceError("");
    try {
      const local = repository.load(initial);
      await importLocalSnapshot({
        target: new SupabaseFinancialImportTarget(
          createBruMathSupabaseClient(),
        ),
        householdId: householdIdRef.current,
        snapshot: local,
      });
      const remote = toAppData(await source.read(), initial);
      remoteBackendRef.current = true;
      remoteWasActivatedRef.current = true;
      lastRemoteSnapshotRef.current = normalizeSnapshot(remote);
      applySnapshot(remote);
      setStatus("remote");
    } catch (error) {
      setPersistenceError(
        error instanceof Error
          ? error.message
          : "A migração não foi concluída. Os dados locais foram preservados.",
      );
      setStatus("migration-required");
    }
  };

  const retryRemoteWrite = async () => {
    const source = remoteSourceRef.current;
    if (!source) return;
    try {
      const persisted = await source.write(snapshot, revision());
      lastRemoteSnapshotRef.current = normalizeSnapshot(persisted);
      setPersistenceError("");
      setStatus("remote");
    } catch {
      setPersistenceError("Ainda não foi possível salvar os dados remotos.");
      setStatus("remote-error");
    }
  };

  const signOut = async () => {
    if (!isBruMathSupabaseConfigured()) return;
    await createBruMathSupabaseClient().auth.signOut();
    remoteBackendRef.current = false;
    remoteSourceRef.current = undefined;
    setIsAuthenticated(false);
    setStatus("local");
  };

  return {
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
    persistence: {
      configured: isBruMathSupabaseConfigured(),
      status,
      error: persistenceError,
      isAuthenticated,
      hasLocalSnapshot,
      migrationPreview,
      sendMagicLink,
      importLocalData,
      retryRemoteWrite,
      signOut,
      financialDataSource: remoteBackendRef.current
        ? remoteSourceRef.current
        : undefined,
    },
  };
}
