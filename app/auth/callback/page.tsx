"use client";

import { useEffect, useState } from "react";
import { createBruMathSupabaseClient } from "../../../lib/persistence/supabaseClient";

export default function AuthCallbackPage() {
  const [message, setMessage] = useState("Concluindo seu acesso seguro...");

  useEffect(() => {
    const complete = async () => {
      try {
        const { error } = await createBruMathSupabaseClient().auth.getSession();
        if (error) throw error;
        window.location.replace("/");
      } catch {
        setMessage(
          "Não foi possível concluir seu acesso. Solicite um novo link.",
        );
      }
    };
    void complete();
  }, []);

  return (
    <main className="home-shell">
      <p>{message}</p>
    </main>
  );
}
