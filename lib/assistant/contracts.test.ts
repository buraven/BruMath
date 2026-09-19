import assert from "node:assert/strict";
import test from "node:test";
import {
  isDeterministicProvenance,
  providerInferenceProvenance,
} from "./contracts";

test("keeps provider wording distinct from confirmed financial provenance", () => {
  const providerProvenance = providerInferenceProvenance("provider-mock");

  assert.equal(providerProvenance[0]?.kind, "inference");
  assert.equal(isDeterministicProvenance(providerProvenance[0]!), false);
  assert.equal(
    isDeterministicProvenance({
      kind: "calculation",
      label: "Saldo calculado pelo BruMath.",
    }),
    true,
  );
});
