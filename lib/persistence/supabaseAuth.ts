import type { SupabaseClient } from "@supabase/supabase-js";

export async function requestMagicLink(
  client: SupabaseClient,
  email: string,
  emailRedirectTo: string,
) {
  const { error } = await client.auth.signInWithOtp({
    email,
    options: { emailRedirectTo },
  });
  if (error) throw new Error("Não foi possível enviar o link de acesso.");
}

export async function requireAuthenticatedUser(client: SupabaseClient) {
  const { data, error } = await client.auth.getUser();
  if (error || !data.user)
    throw new Error("É necessário entrar para acessar os dados financeiros.");
  return data.user;
}

/**
 * Creates only the authenticated user's own household, owner membership and
 * default financial settings. The RPC is SECURITY INVOKER and remains subject
 * to RLS; it is not a privileged client-side bootstrap shortcut.
 */
export async function bootstrapFinancialHousehold(client: SupabaseClient) {
  await requireAuthenticatedUser(client);
  const { data, error } = await client.rpc("bootstrap_financial_household");
  if (error || !data)
    throw new Error("Não foi possível preparar o espaço financeiro seguro.");
  return data as string;
}
