import assert from "node:assert/strict";
import test from "node:test";
import {
  canOfferSupabaseSignOut,
  canRenderFinancialApplication,
} from "./financialAccessGate";

test("keeps financial UI behind the configured Supabase auth gate", () => {
  assert.equal(
    canRenderFinancialApplication({
      supabaseConfigured: true,
      persistenceStatus: "loading",
    }),
    false,
  );
  assert.equal(
    canRenderFinancialApplication({
      supabaseConfigured: true,
      persistenceStatus: "auth-required",
    }),
    false,
  );
  assert.equal(
    canRenderFinancialApplication({
      supabaseConfigured: true,
      persistenceStatus: "migration-required",
    }),
    false,
  );
  assert.equal(
    canRenderFinancialApplication({
      supabaseConfigured: true,
      persistenceStatus: "remote",
    }),
    true,
  );
  assert.equal(
    canRenderFinancialApplication({
      supabaseConfigured: false,
      persistenceStatus: "local",
    }),
    true,
  );
});

test("offers logout only while the Supabase backend is active", () => {
  assert.equal(
    canOfferSupabaseSignOut({
      supabaseConfigured: true,
      persistenceStatus: "remote",
    }),
    true,
  );
  assert.equal(
    canOfferSupabaseSignOut({
      supabaseConfigured: true,
      persistenceStatus: "auth-required",
    }),
    false,
  );
  assert.equal(
    canOfferSupabaseSignOut({
      supabaseConfigured: false,
      persistenceStatus: "local",
    }),
    false,
  );
});
