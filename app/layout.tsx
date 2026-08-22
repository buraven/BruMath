import "./globals.css";
import "./home-refresh.css";

export const metadata = { title: "BruMath", description: "Finanças de Bruna e Matheus" };

export default function Layout({ children }: { children: React.ReactNode }) {
  return <html lang="pt-BR"><body>{children}</body></html>;
}
