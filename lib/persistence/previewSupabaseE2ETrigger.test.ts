import assert from "node:assert/strict";
import test from "node:test";
import {
  hasValidPreviewE2ETrigger,
  isPreviewVercelRuntime,
} from "./previewSupabaseE2ETrigger";

test("only permits the synthetic trigger in a Vercel Preview runtime", () => {
  assert.equal(
    isPreviewVercelRuntime({ VERCEL: "1", VERCEL_ENV: "preview" }),
    true,
  );
  assert.equal(
    isPreviewVercelRuntime({ VERCEL: "1", VERCEL_ENV: "production" }),
    false,
  );
  assert.equal(isPreviewVercelRuntime({ VERCEL_ENV: "preview" }), false);
});

test("requires a matching server-only trigger token", () => {
  const environment = { SUPABASE_E2E_TRIGGER_TOKEN: "test-trigger" };
  assert.equal(
    hasValidPreviewE2ETrigger("Bearer test-trigger", environment),
    true,
  );
  assert.equal(hasValidPreviewE2ETrigger("Bearer wrong", environment), false);
  assert.equal(hasValidPreviewE2ETrigger(null, environment), false);
});
