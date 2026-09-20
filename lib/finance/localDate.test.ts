import assert from "node:assert/strict";
import test from "node:test";
import {
  formatBrazilianDateDraft,
  formatLocalDate,
  isLocalDate,
  parseBrazilianDate,
} from "./localDate";

test("formats and parses a local calendar date without shifting its day", () => {
  assert.equal(formatLocalDate("2026-10-05"), "05/10/2026");
  assert.equal(parseBrazilianDate("05/10/2026"), "2026-10-05");
});

test("validates leap days as local dates", () => {
  assert.equal(isLocalDate("2028-02-29"), true);
  assert.equal(isLocalDate("2027-02-29"), false);
  assert.equal(parseBrazilianDate("29/02/2027"), "");
});

test("keeps the Brazilian keyboard draft separate from the canonical value", () => {
  assert.equal(formatBrazilianDateDraft("05102026"), "05/10/2026");
  assert.equal(formatBrazilianDateDraft("0510"), "05/10");
});
