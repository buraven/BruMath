import type { SupabaseClient } from "@supabase/supabase-js";

export function magicLinkRedirectUrl(origin: string, isDevelopment: boolean) {
  return isDevelopment ? new URL("/auth/callback", origin).toString() : origin;
}

export async function requestMagicLink(
  client: SupabaseClient,
  email: string,
  emailRedirectTo: string,
) {
  const { error } = await client.auth.signInWithOtp({
    email,
    options: { emailRedirectTo, shouldCreateUser: false },
  });
  if (error) throw new Error("Não foi possível enviar o link de acesso.");
}

export async function requireAuthenticatedUser(
  client: SupabaseClient,
  accessToken?: string,
) {
  const { data, error } = await client.auth.getUser(accessToken);
  if (error || !data.user)
    throw new Error("É necessário entrar para acessar os dados financeiros.");
  return data.user;
}

/**
 * Creates only the authenticated user's own household, owner membership and
 * default financial settings. The RPC is SECURITY INVOKER and remains subject
 * to RLS; it is not a privileged client-side bootstrap shortcut.
 */
export async function bootstrapFinancialHousehold(
  client: SupabaseClient,
  accessToken?: string,
) {
  await requireAuthenticatedUser(client, accessToken);
  const { data, error } = await client.rpc("bootstrap_financial_household");
  if (error || !data)
    throw new Error("Não foi possível preparar o espaço financeiro seguro.");
  return data as string;
}

/** Resolves an existing household through the authenticated user's RLS scope. */
export async function resolveFinancialHousehold(
  client: SupabaseClient,
  accessToken?: string,
) {
  const user = await requireAuthenticatedUser(client, accessToken);
  const { data, error } = await client
    .from("household_members")
    .select("household_id")
    .eq("user_id", user.id);
  if (error) throw new Error("Não foi possível resolver sua household segura.");
  const households = [...new Set((data ?? []).map((row) => row.household_id))];
  if (households.length !== 1)
    throw new Error(
      "A sessão não possui uma household única para o pré-flight.",
    );
  return households[0]!;
}
