"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { AppFinancialData } from "../../lib/app/AppTypes";
import type { FinancialDataSnapshot } from "../../lib/assistant/context/FinancialDataSource";
import { SupabaseFinancialDataSource } from "../../lib/assistant/context/SupabaseFinancialDataSource";
import { BruMathDataRepository } from "../../lib/persistence/BruMathDataRepository";
import {
  resolvePersistenceWriteTarget,
  type FinancialPersistenceStatus,
} from "../../lib/persistence/financialPersistencePolicy";
import {
  importLocalSnapshot,
  hasImportedLocalSnapshot,
  localStorageSourceHash,
  type LocalMigrationPreview,
  previewLocalMigration,
} from "../../lib/persistence/LocalSnapshotMigration";
import {
  normalizePersistedFinancialSnapshot,
  remotePersistenceDiagnostic,
  SupabaseFinancialImportTarget,
  type RemotePersistenceDiagnostic,
} from "../../lib/persistence/SupabaseFinancialImportTarget";
import { RemoteSnapshotWriteQueue } from "../../lib/persistence/RemoteSnapshotWriteQueue";
import { RemoteSessionInitializationGate } from "../../lib/persistence/RemoteSessionInitializationGate";
import {
  createBruMathSupabaseClient,
  isBruMathSupabaseConfigured,
} from "../../lib/persistence/supabaseClient";
import {
  bootstrapFinancialHousehold,
  magicLinkRedirectUrl,
  requestMagicLink,
} from "../../lib/persistence/supabaseAuth";
import { decideAuthenticatedBootstrap } from "./remoteBootstrapDecision";
import { hydrateCategoryCatalog } from "../../lib/finance/categoryCatalog";

export type PersistenceStatus = FinancialPersistenceStatus;

function toAppData(
  snapshot: FinancialDataSnapshot,
  fallback: AppFinancialData,
): AppFinancialData {
  return {
    categories: [...(snapshot.categories ?? [])],
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
    categoryBudgets: { ...(snapshot.categoryBudgets ?? {}) },
    limits: snapshot.limits as AppFinancialData["limits"],
    personalLimits: snapshot.personalLimits ?? fallback.personalLimits,
    creditCards: [
      ...(snapshot.creditCards ?? []),
    ] as AppFinancialData["creditCards"],
    invoicePayments: [
      ...(snapshot.invoicePayments ?? []),
    ] as AppFinancialData["invoicePayments"],
    invoiceAdjustments: [...(snapshot.invoiceAdjustments ?? [])],
    installmentInvoiceEvents: [...(snapshot.installmentInvoiceEvents ?? [])],
    installmentReimbursementAllocations: [
      ...(snapshot.installmentReimbursementAllocations ?? []),
    ],
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
  const [categories, setCategories] = useState(initial.categories ?? []);
  const [installments, setInstallments] = useState(initial.installments);
  const [debts, setDebts] = useState(initial.debts);
  const [incomeEntries, setIncomeEntries] = useState(initial.incomeEntries);
  const [income, setIncome] = useState(initial.income);
  const [budgets, setBudgets] = useState(initial.budgets);
  const [categoryBudgets, setCategoryBudgets] = useState(
    initial.categoryBudgets ?? {},
  );
  const [limits, setLimits] = useState(initial.limits);
  const [personalLimits, setPersonalLimits] = useState(initial.personalLimits);
  const [creditCards, setCreditCards] = useState(initial.creditCards);
  const [invoicePayments, setInvoicePayments] = useState(
    initial.invoicePayments,
  );
  const [invoiceAdjustments, setInvoiceAdjustments] = useState(
    initial.invoiceAdjustments ?? [],
  );
  const [installmentInvoiceEvents, setInstallmentInvoiceEvents] = useState(
    initial.installmentInvoiceEvents ?? [],
  );
  const [
    installmentReimbursementAllocations,
    setInstallmentReimbursementAllocations,
  ] = useState(initial.installmentReimbursementAllocations ?? []);
  const [activeProfile, setActiveProfile] = useState(initial.activeProfile);
  const [viewMonth, setViewMonth] = useState(initial.viewMonth);
  const [status, setStatus] = useState<PersistenceStatus>("loading");
  const [persistenceError, setPersistenceError] = useState("");
  const [persistenceDiagnostic, setPersistenceDiagnostic] =
    useState<RemotePersistenceDiagnostic>();
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
  const remoteWriterRef = useRef<RemoteSnapshotWriteQueue<AppFinancialData>>();
  const remoteInitializationGateRef = useRef(
    new RemoteSessionInitializationGate(),
  );
  const initializeRemoteRef = useRef<(() => Promise<void>) | undefined>();
  const localSourceHashRef = useRef("");
  const legacyLocalSourceHashRef = useRef("");

  const snapshot = useMemo<AppFinancialData>(
    () => ({
      categories,
      expenses,
      installments,
      debts,
      incomeEntries,
      income,
      budgets,
      categoryBudgets,
      limits,
      personalLimits,
      creditCards,
      invoicePayments,
      invoiceAdjustments,
      installmentInvoiceEvents,
      installmentReimbursementAllocations,
      activeProfile,
      viewMonth,
    }),
    [
      categories,
      expenses,
      installments,
      debts,
      incomeEntries,
      income,
      budgets,
      categoryBudgets,
      limits,
      personalLimits,
      creditCards,
      invoicePayments,
      invoiceAdjustments,
      installmentInvoiceEvents,
      installmentReimbursementAllocations,
      activeProfile,
      viewMonth,
    ],
  );

  const applySnapshot = (data: AppFinancialData) => {
    const hydrated = hydrateCategoryCatalog(data);
    setCategories(hydrated.categories);
    setExpenses(hydrated.expenses);
    setInstallments(hydrated.installments);
    setDebts(hydrated.debts);
    setIncomeEntries(hydrated.incomeEntries);
    setIncome(hydrated.income);
    setBudgets(hydrated.budgets);
    setCategoryBudgets(hydrated.categoryBudgets ?? {});
    setLimits(hydrated.limits);
    setPersonalLimits(hydrated.personalLimits);
    setCreditCards(hydrated.creditCards);
    setInvoicePayments(hydrated.invoicePayments);
    setInvoiceAdjustments(hydrated.invoiceAdjustments ?? []);
    setInstallmentInvoiceEvents(hydrated.installmentInvoiceEvents ?? []);
    setInstallmentReimbursementAllocations(
      hydrated.installmentReimbursementAllocations ?? [],
    );
    setActiveProfile(hydrated.activeProfile);
    setViewMonth(hydrated.viewMonth);
  };

  useEffect(() => {
    const repository = new BruMathDataRepository();
    repositoryRef.current = repository;
    const stored = repository.readStoredData();
    const localSnapshot = repository.load(initial);
    const localExists = Object.keys(stored).length > 0;
    localSourceHashRef.current = localStorageSourceHash(stored);
    legacyLocalSourceHashRef.current =
      previewLocalMigration(localSnapshot).sourceHash;
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
      const { data, error } = await client.auth.getSession();
      if (!mounted) return;
      if (error) {
        setIsAuthenticated(false);
        setPersistenceError("Não foi possível restaurar sua sessão.");
        setStatus("auth-required");
        return;
      }
      setIsAuthenticated(Boolean(data.session));
      if (!data.session) {
        setStatus("auth-required");
        return;
      }
      try {
        await remoteInitializationGateRef.current.initialize(
          data.session.user.id,
          async () => {
            setStatus("bootstrapping");
            const householdId = await bootstrapFinancialHousehold(client);
            if (!mounted) return;
            householdIdRef.current = householdId;
            const target = new SupabaseFinancialImportTarget(client);
            const source = new SupabaseFinancialDataSource(client, householdId);
            remoteSourceRef.current = source;
            // A successful remote read is the only safe basis for deciding
            // whether legacy local data can be offered for explicit migration.
            const remote = toAppData(await source.read(), initial);
            if (!mounted) return;
            let localAlreadyImported = false;
            if (localExists) {
              const preview = previewLocalMigration(
                localSnapshot,
                localSourceHashRef.current,
              );
              setMigrationPreview(preview);
              if (!preview.valid) throw new Error(preview.issues.join(" "));
              localAlreadyImported = await hasImportedLocalSnapshot({
                target,
                householdId,
                sourceHash: preview.sourceHash,
                legacySourceHash: legacyLocalSourceHashRef.current,
              });
            }
            const bootstrapDecision = decideAuthenticatedBootstrap({
              localExists,
              remote,
              localAlreadyImported,
            });
            if (bootstrapDecision === "migration-required") {
              setStatus("migration-required");
              return;
            }
            if (bootstrapDecision === "remote-error") {
              throw new Error("Não foi possível ler o snapshot remoto.");
            }
            remoteBackendRef.current = true;
            remoteWasActivatedRef.current = true;
            const writer = new RemoteSnapshotWriteQueue(
              normalizePersistedFinancialSnapshot,
              async (nextSnapshot) => source.write(nextSnapshot, revision()),
            );
            writer.markConfirmed(remote);
            remoteWriterRef.current = writer;
            applySnapshot(remote);
            setStatus("remote");
          },
        );
      } catch {
        if (!mounted) return;
        setPersistenceError("Não foi possível preparar a persistência remota.");
        setStatus("remote-error");
      }
    };
    initializeRemoteRef.current = initialize;
    void initialize();
    const { data: listener } = client.auth.onAuthStateChange(
      (_event, session) => {
        if (!session) {
          remoteInitializationGateRef.current.reset();
          remoteBackendRef.current = false;
          remoteSourceRef.current = undefined;
          setIsAuthenticated(false);
          setStatus("auth-required");
          return;
        }
        void initialize();
      },
    );
    return () => {
      mounted = false;
      initializeRemoteRef.current = undefined;
      listener.subscription.unsubscribe();
    };
  }, [initial]);

  useEffect(() => {
    const writeTarget = resolvePersistenceWriteTarget({
      hasHydrated,
      supabaseConfigured: isBruMathSupabaseConfigured(),
      status,
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
    const writer = remoteWriterRef.current;
    if (!writer) return;
    void writer
      .enqueue(snapshot)
      .then(() => {
        setPersistenceError("");
        setPersistenceDiagnostic(undefined);
      })
      .catch((error: unknown) => {
        const diagnostic = remotePersistenceDiagnostic(error);
        console.error("Remote financial persistence failed", diagnostic);
        setPersistenceDiagnostic(diagnostic);
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
      magicLinkRedirectUrl(
        window.location.origin,
        process.env.NODE_ENV === "development",
      ),
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
        sourceHash: localSourceHashRef.current,
      });
      const remote = toAppData(await source.read(), initial);
      remoteBackendRef.current = true;
      remoteWasActivatedRef.current = true;
      const writer = new RemoteSnapshotWriteQueue(
        normalizePersistedFinancialSnapshot,
        async (nextSnapshot) => source.write(nextSnapshot, revision()),
      );
      writer.markConfirmed(remote);
      remoteWriterRef.current = writer;
      applySnapshot(remote);
      setStatus("remote");
    } catch {
      setPersistenceError(
        "A migração não foi concluída. Os dados locais foram preservados.",
      );
      setStatus("migration-required");
    }
  };

  const retryRemoteWrite = async () => {
    if (!remoteBackendRef.current) {
      await initializeRemoteRef.current?.();
      return;
    }
    const writer = remoteWriterRef.current;
    if (!writer) return;
    try {
      await writer.enqueue(snapshot, true);
      setPersistenceError("");
      setPersistenceDiagnostic(undefined);
      setStatus("remote");
    } catch (error) {
      const diagnostic = remotePersistenceDiagnostic(error);
      console.error("Remote financial persistence retry failed", diagnostic);
      setPersistenceDiagnostic(diagnostic);
      setPersistenceError("Ainda não foi possível salvar os dados remotos.");
      setStatus("remote-error");
    }
  };

  const signOut = async () => {
    if (!isBruMathSupabaseConfigured()) return;
    if (remoteBackendRef.current) {
      const writer = remoteWriterRef.current;
      if (!writer) return;
      try {
        await writer.flush(snapshot);
      } catch {
        setPersistenceError(
          "A alteração remota ainda não foi confirmada. Tente novamente antes de sair.",
        );
        setStatus("remote-error");
        return;
      }
    }
    const { error } = await createBruMathSupabaseClient().auth.signOut();
    if (error) {
      setPersistenceError("Não foi possível encerrar sua sessão agora.");
      setStatus("remote-error");
      return;
    }
    remoteBackendRef.current = false;
    remoteSourceRef.current = undefined;
    remoteWriterRef.current = undefined;
    setIsAuthenticated(false);
    setPersistenceError("");
    setStatus("auth-required");
  };

  return {
    expenses,
    setExpenses,
    categories,
    setCategories,
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
    categoryBudgets,
    setCategoryBudgets,
    limits,
    setLimits,
    personalLimits,
    setPersonalLimits,
    creditCards,
    setCreditCards,
    invoicePayments,
    setInvoicePayments,
    invoiceAdjustments,
    setInvoiceAdjustments,
    installmentInvoiceEvents,
    setInstallmentInvoiceEvents,
    installmentReimbursementAllocations,
    setInstallmentReimbursementAllocations,
    activeProfile,
    setActiveProfile,
    viewMonth,
    setViewMonth,
    persistence: {
      configured: isBruMathSupabaseConfigured(),
      status,
      error: persistenceError,
      diagnostic: persistenceDiagnostic,
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
