import type { ReactNode } from "react";
import styles from "./NavButton.module.css";

type NavButtonProps = {
  active: boolean;
  onClick: () => void;
  icon: ReactNode;
  label: string;
  variant?: "bottom" | "sidebar";
};

export function NavButton({
  active,
  onClick,
  icon,
  label,
  variant = "bottom",
}: NavButtonProps) {
  return (
    <button
      type="button"
      className={`${styles.button} ${variant === "sidebar" ? styles.sidebar : ""} ${active ? styles.active : ""}`}
      onClick={onClick}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}
