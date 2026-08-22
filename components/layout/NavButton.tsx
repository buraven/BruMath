import type { ReactNode } from "react";

type NavButtonProps = {
  active: boolean;
  onClick: () => void;
  icon: ReactNode;
  label: string;
};

export function NavButton({ active, onClick, icon, label }: NavButtonProps) {
  return (
    <button type="button" className={active ? "active" : ""} onClick={onClick}>
      {icon}
      <span>{label}</span>
    </button>
  );
}
