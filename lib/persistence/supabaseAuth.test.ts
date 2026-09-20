import assert from "node:assert/strict";
import test from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { brumathSupabaseAuthOptions } from "./supabaseClient";
import { requestMagicLink } from "./supabaseAuth";

test("persists and refreshes Supabase sessions in the browser", () => {
  assert.deepEqual(brumathSupabaseAuthOptions, {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  });
});

test("requests a Magic Link without allowing app-side signup", async () => {
  let options: Record<string, unknown> | undefined;
  const client = {
    auth: {
      signInWithOtp: async (input: { options?: Record<string, unknown> }) => {
        options = input.options;
        return { error: null };
      },
    },
  } as unknown as SupabaseClient;

  await requestMagicLink(
    client,
    "authorized@example.test",
    "https://example.test",
  );

  assert.deepEqual(options, {
    emailRedirectTo: "https://example.test",
    shouldCreateUser: false,
  });
});
