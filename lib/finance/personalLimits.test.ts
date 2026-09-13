import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_PERSONAL_LIMITS,
  calculatePersonalLimitUsages,
  isPersonalLimitBucket,
  resolvePersonalLimits,
} from "./personalLimits";

test("keeps Bruna total as a derived aggregate, never a persistible bucket", () => {
  assert.equal(isPersonalLimitBucket("bruna_total"), false);
  assert.deepEqual(
    resolvePersonalLimits(
      {
        bruna_nails: 150,
        bruna_personal: 350,
        matheus_personal: 350,
        bruna_total: 500,
      },
      undefined,
    ),
    DEFAULT_PERSONAL_LIMITS,
  );

  const usages = calculatePersonalLimitUsages(DEFAULT_PERSONAL_LIMITS, [
    { amount: 40, personalLimitBucket: "bruna_nails" },
    { amount: 30, personalLimitBucket: "bruna_personal" },
  ]);

  assert.deepEqual(
    usages.find((usage) => usage.id === "personal:bruna_total"),
    {
      id: "personal:bruna_total",
      label: "Bruna — Total pessoal",
      owner: "Bruna",
      amount: 500,
      spent: 70,
    },
  );
});

test("keeps category spending and explicit personal buckets independent", () => {
  const usages = calculatePersonalLimitUsages(DEFAULT_PERSONAL_LIMITS, [
    { amount: 553.2 },
    { amount: 50 },
    { amount: 30, personalLimitBucket: "bruna_personal" },
    { amount: 40, personalLimitBucket: "bruna_nails" },
    { amount: 80, personalLimitBucket: "matheus_personal" },
  ]);

  assert.equal(
    usages.find((usage) => usage.id === "personal:bruna_nails")?.spent,
    40,
  );
  assert.equal(
    usages.find((usage) => usage.id === "personal:bruna_personal")?.spent,
    30,
  );
  assert.equal(
    usages.find((usage) => usage.id === "personal:matheus_personal")?.spent,
    80,
  );
});
