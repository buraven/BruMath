export type PersistenceWriteTarget = "local" | "remote" | "none";

/**
 * Local storage is a transition source, never an automatic fallback once this
 * browser session has activated Supabase. This avoids split-brain writes.
 */
export function resolvePersistenceWriteTarget(options: {
  remoteActive: boolean;
  remoteWasActivated: boolean;
}): PersistenceWriteTarget {
  if (options.remoteActive) return "remote";
  return options.remoteWasActivated ? "none" : "local";
}
