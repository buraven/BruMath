import assert from "node:assert/strict";
import test from "node:test";
import { quickActionInstruction } from "./quickActions";

test("official quick actions carry a deterministic intent", () => {
  assert.match(
    quickActionInstruction("incoming-summary") ?? "",
    /não pergunte/i,
  );
  assert.match(
    quickActionInstruction("insights") ?? "",
    /sem exigir categoria/i,
  );
  assert.match(quickActionInstruction("installments") ?? "", /getInstallments/);
});
