import { runSupabaseSyntheticE2E } from "./supabase-synthetic-e2e.mjs";

const result = await runSupabaseSyntheticE2E();
console.log(`Supabase E2E sintético: ${result.status}.`);
for (const scenario of result.scenarios)
  console.log(`${scenario.status}: ${scenario.name}`);
if (result.status !== "PASS") process.exitCode = 1;
