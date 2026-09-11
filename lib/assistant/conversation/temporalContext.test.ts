import assert from "node:assert/strict";
import test from "node:test";
import { resolveFinancialMonth, resolveRelativeDate } from "./temporalContext";

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
  assert.equal(
    resolveRelativeDate("anteontem", {
      currentDate: "2026-09-10",
      timeZone: "America/Sao_Paulo",
    }),
    "2026-09-08",
  );
});

test("anchors financial relative periods to the selected month across year rollover", () => {
  assert.equal(resolveFinancialMonth("selected", "2026-08"), "2026-08");
  assert.equal(resolveFinancialMonth("previous", "2026-01"), "2025-12");
  assert.equal(resolveFinancialMonth("next", "2026-12"), "2027-01");
});
