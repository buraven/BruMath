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
