import type { ReactNode } from "react";
import styles from "./NavButton.module.css";

type NavButtonProps = {
  active: boolean;
  onClick: () => void;
  icon: ReactNode;
  label: string;
};

export function NavButton({ active, onClick, icon, label }: NavButtonProps) {
  return (
    <button type="button" className={`${styles.button} ${active ? styles.active : ""}`} onClick={onClick}>
      {icon}
      <span>{label}</span>
    </button>
  );
}
