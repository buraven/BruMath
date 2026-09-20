import type { Confirmation } from "../../lib/app/AppTypes";

export function createSignOutConfirmation(
  signOut: () => Promise<void>,
): Confirmation {
  return {
    title: "Sair do BruMath",
    description:
      "Você precisará entrar novamente para acessar seus dados financeiros neste dispositivo.",
    confirmLabel: "Sair do BruMath",
    destructive: true,
    onConfirm: () => {
      void signOut();
    },
  };
}
