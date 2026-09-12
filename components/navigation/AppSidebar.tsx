import {
  CalendarDays,
  Tags,
  Receipt,
  Home,
  MessageCircle,
  Settings2,
  Sparkles,
  WalletCards,
} from "lucide-react";
import { NavButton } from "./NavButton";
import styles from "./AppSidebar.module.css";
import type { NavigationTab } from "../../lib/app/AppTypes";

export type { NavigationTab } from "../../lib/app/AppTypes";

type AppSidebarProps = {
  activeTab: NavigationTab;
  onNavigate: (tab: NavigationTab) => void;
};

const items = [
  { tab: "home", label: "Início", icon: <Home size={18} /> },
  { tab: "chat", label: "Assistente", icon: <MessageCircle size={18} /> },
  { tab: "stats", label: "Gastos", icon: <Receipt size={18} /> },
  { tab: "limits", label: "Limites e categorias", icon: <Tags size={18} /> },
  { tab: "future", label: "Futuro", icon: <CalendarDays size={18} /> },
  { tab: "debts", label: "Quem me deve", icon: <WalletCards size={18} /> },
  { tab: "income", label: "Entradas & extras", icon: <Sparkles size={18} /> },
  { tab: "preferences", label: "Preferências", icon: <Settings2 size={18} /> },
] as const;

export function AppSidebar({ activeTab, onNavigate }: AppSidebarProps) {
  return (
    <aside className={styles.sidebar} aria-label="Navegação principal">
      <div className={styles.brand}>
        <strong>
          Bru<span>Math</span>
        </strong>
        <small>Planeje. Controle. Conquiste.</small>
      </div>

      <nav className={styles.navigation}>
        {items.map((item) => (
          <NavButton
            key={item.tab}
            active={activeTab === item.tab}
            icon={item.icon}
            label={item.label}
            onClick={() => onNavigate(item.tab)}
            variant="sidebar"
          />
        ))}
      </nav>

      <p className={styles.hint}>As suas finanças, em um só lugar.</p>
    </aside>
  );
}
