import type { PersistenceStatus } from "../../features/app/usePersistedFinancialState";

/** A configured Supabase project never renders financial UI before remote auth. */
export function canRenderFinancialApplication(options: {
  supabaseConfigured: boolean;
  persistenceStatus: PersistenceStatus;
}) {
  return !options.supabaseConfigured || options.persistenceStatus === "remote";
}

export function canOfferSupabaseSignOut(options: {
  supabaseConfigured: boolean;
  persistenceStatus: PersistenceStatus;
}) {
  return options.supabaseConfigured && options.persistenceStatus === "remote";
}
