import assert from "node:assert/strict";
import test from "node:test";
import { resolveRelativeDate } from "./temporalContext";

test("resolves relative dates across month and year boundaries", () => {
  assert.equal(
    resolveRelativeDate("ontem", {
      currentDate: "2026-09-10",
      timeZone: "America/Sao_Paulo",
    }),
    "2026-09-09",
  );
  assert.equal(
    resolveRelativeDate("ontem", {
      currentDate: "2026-10-01",
      timeZone: "America/Sao_Paulo",
    }),
    "2026-09-30",
  );
  assert.equal(
    resolveRelativeDate("ontem", {
      currentDate: "2027-01-01",
      timeZone: "America/Sao_Paulo",
    }),
    "2026-12-31",
  );
  assert.equal(
    resolveRelativeDate("hoje", {
      currentDate: "2026-09-10",
      timeZone: "America/Sao_Paulo",
    }),
    "2026-09-10",
  );
});
