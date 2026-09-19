import { timingSafeEqual } from "node:crypto";

type Environment = Record<string, string | undefined>;

export function isPreviewVercelRuntime(environment: Environment = process.env) {
  return environment.VERCEL === "1" && environment.VERCEL_ENV === "preview";
}

export function hasValidPreviewE2ETrigger(
  authorization: string | null,
  environment: Environment = process.env,
) {
  const token = environment.SUPABASE_E2E_TRIGGER_TOKEN;
  if (!token || !authorization?.startsWith("Bearer ")) return false;
  const expectedBuffer = Buffer.from(token);
  const suppliedBuffer = Buffer.from(authorization.slice("Bearer ".length));
  return (
    expectedBuffer.length === suppliedBuffer.length &&
    timingSafeEqual(expectedBuffer, suppliedBuffer)
  );
}
