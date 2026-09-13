import type { PersonalLimitBucket } from "./personalLimitBuckets";

export const PERSONAL_LIMIT_BUCKETS = [
  "bruna_nails",
  "bruna_personal",
  "matheus_personal",
] as const;

export type PersonalLimitConfiguration = Record<PersonalLimitBucket, number>;

export type PersonalLimitUsage = {
  id: string;
  label: string;
  owner: "Bruna" | "Matheus";
  amount: number;
  spent: number;
};

export const DEFAULT_PERSONAL_LIMITS: PersonalLimitConfiguration = {
  bruna_nails: 150,
  bruna_personal: 350,
  matheus_personal: 350,
};

export function isPersonalLimitBucket(
  value: unknown,
): value is PersonalLimitBucket {
  return (
    typeof value === "string" &&
    (PERSONAL_LIMIT_BUCKETS as readonly string[]).includes(value)
  );
}

type BucketExpense = {
  amount: number;
  personalLimitBucket?: PersonalLimitBucket;
};

function spentFor(
  expenses: readonly BucketExpense[],
  bucket: PersonalLimitBucket,
) {
  return expenses.reduce(
    (total, expense) =>
      expense.personalLimitBucket === bucket
        ? total + Math.max(0, expense.amount)
        : total,
    0,
  );
}

/**
 * Personal allowance is independent from owner and category. Only an explicit
 * bucket participates, so legacy expenses remain outside personal allowances.
 */
export function calculatePersonalLimitUsages(
  limits: PersonalLimitConfiguration,
  expenses: readonly BucketExpense[],
): readonly PersonalLimitUsage[] {
  const brunaNails = spentFor(expenses, "bruna_nails");
  const brunaPersonal = spentFor(expenses, "bruna_personal");
  const matheusPersonal = spentFor(expenses, "matheus_personal");

  return [
    {
      id: "personal:bruna_total",
      label: "Bruna — Total pessoal",
      owner: "Bruna",
      amount: limits.bruna_nails + limits.bruna_personal,
      spent: brunaNails + brunaPersonal,
    },
    {
      id: "personal:bruna_nails",
      label: "Bruna — Unha",
      owner: "Bruna",
      amount: limits.bruna_nails,
      spent: brunaNails,
    },
    {
      id: "personal:bruna_personal",
      label: "Bruna — Pessoal",
      owner: "Bruna",
      amount: limits.bruna_personal,
      spent: brunaPersonal,
    },
    {
      id: "personal:matheus_personal",
      label: "Matheus — Pessoal",
      owner: "Matheus",
      amount: limits.matheus_personal,
      spent: matheusPersonal,
    },
  ];
}

/** Keeps existing `limits` snapshots usable while introducing explicit buckets. */
export function resolvePersonalLimits(
  stored: unknown,
  legacy: Partial<Record<"Bruna" | "Matheus", number>> | undefined,
  defaults: PersonalLimitConfiguration = DEFAULT_PERSONAL_LIMITS,
): PersonalLimitConfiguration {
  const values =
    stored && typeof stored === "object" && !Array.isArray(stored)
      ? (stored as Partial<Record<PersonalLimitBucket, unknown>>)
      : {};
  const legacyBruna = legacy?.Bruna;
  const legacyMatheus = legacy?.Matheus;

  return {
    bruna_nails:
      typeof values.bruna_nails === "number" && values.bruna_nails >= 0
        ? values.bruna_nails
        : defaults.bruna_nails,
    bruna_personal:
      typeof values.bruna_personal === "number" && values.bruna_personal >= 0
        ? values.bruna_personal
        : typeof legacyBruna === "number" && legacyBruna >= 0
          ? legacyBruna
          : defaults.bruna_personal,
    matheus_personal:
      typeof values.matheus_personal === "number" &&
      values.matheus_personal >= 0
        ? values.matheus_personal
        : typeof legacyMatheus === "number" && legacyMatheus >= 0
          ? legacyMatheus
          : defaults.matheus_personal,
  };
}
