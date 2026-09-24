import assert from "node:assert/strict";
import test from "node:test";
import type { AppFinancialData } from "../../lib/app/AppTypes";
import { decideAuthenticatedBootstrap } from "./remoteBootstrapDecision";

const emptyRemote: AppFinancialData = {
  expenses: [],
  installments: [],
  debts: [],
  incomeEntries: [],
  income: 0,
  budgets: {},
  limits: { Bruna: 0, Matheus: 0 },
  personalLimits: {
    bruna_nails: 0,
    bruna_personal: 0,
    matheus_personal: 0,
  },
  creditCards: [],
  invoicePayments: [],
  invoiceAdjustments: [],
  installmentInvoiceEvents: [],
  installmentReimbursementAllocations: [],
  activeProfile: "Bruna",
  viewMonth: "2026-09",
};

test("offers migration only for a successfully read empty remote snapshot with legacy local data", () => {
  assert.equal(
    decideAuthenticatedBootstrap({
      localExists: true,
      remote: emptyRemote,
      localAlreadyImported: false,
    }),
    "migration-required",
  );
});

test("hydrates a populated remote snapshot instead of offering legacy local migration", () => {
  assert.equal(
    decideAuthenticatedBootstrap({
      localExists: true,
      remote: {
        ...emptyRemote,
        expenses: [
          {
            id: 1,
            title: "Despesa remota",
            cat: "Teste",
            who: "Casal",
            amount: 1,
            date: "2026-09-01",
          },
        ],
      },
      localAlreadyImported: false,
    }),
    "remote",
  );
});

test("hydrates a populated remote snapshot without local data", () => {
  assert.equal(
    decideAuthenticatedBootstrap({
      localExists: false,
      remote: {
        ...emptyRemote,
        creditCards: [
          {
            id: 1,
            name: "Cartão",
            owner: "Casal",
            creditLimit: 1,
            closingDay: 1,
            dueDay: 1,
            active: true,
          },
        ],
      },
      localAlreadyImported: false,
    }),
    "remote",
  );
});

test("never mistakes a failed remote read for an empty household", () => {
  assert.equal(
    decideAuthenticatedBootstrap({
      localExists: true,
      remote: undefined,
      localAlreadyImported: false,
    }),
    "remote-error",
  );
});

test("keeps an already-imported legacy source from being offered again when remote is empty", () => {
  assert.equal(
    decideAuthenticatedBootstrap({
      localExists: true,
      remote: emptyRemote,
      localAlreadyImported: true,
    }),
    "remote",
  );
});
