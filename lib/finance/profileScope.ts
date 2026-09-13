import type { TransactionOwner } from "./transactions";

/**
 * A personal profile sees only records assigned to that person. Casal is the
 * consolidated household view and therefore includes records of both people
 * and records assigned directly to Casal.
 */
export function isWithinProfileScope(
  owner: TransactionOwner,
  profile: TransactionOwner,
): boolean {
  return profile === "Casal" || owner === profile;
}
