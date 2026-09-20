export type PersistenceWriteTarget = "local" | "remote" | "none";

export type FinancialPersistenceStatus =
  | "loading"
  | "local"
  | "auth-required"
  | "bootstrapping"
  | "migration-required"
  | "migrating"
  | "remote"
  | "remote-error";

/**
 * Local storage is a transition source, never an automatic fallback once this
 * browser session has activated Supabase. This avoids split-brain writes.
 */
export function resolvePersistenceWriteTarget(options: {
  hasHydrated: boolean;
  supabaseConfigured: boolean;
  status: FinancialPersistenceStatus;
  remoteActive: boolean;
  remoteWasActivated: boolean;
}): PersistenceWriteTarget {
  if (!options.hasHydrated) return "none";

  // Local persistence remains available only when Supabase is not configured.
  // A configured remote backend must never silently fall back to localStorage.
  if (!options.supabaseConfigured) return "local";

  if (options.status !== "remote" || !options.remoteActive) return "none";

  return options.remoteWasActivated ? "remote" : "none";
}
