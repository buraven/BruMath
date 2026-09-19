export type SyntheticE2EScenario = { name: string; status: "PASS" | "FAIL" };
export type SyntheticE2EResult = {
  status: "PASS" | "FAIL";
  scenarios: SyntheticE2EScenario[];
};
export function runSupabaseSyntheticE2E(
  environment?: NodeJS.ProcessEnv,
): Promise<SyntheticE2EResult>;
