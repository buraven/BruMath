import type { HTMLAttributes, ReactNode } from "react";

type CardProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
  tone?: "default" | "success" | "warning" | "danger";
};

export function Card({ children, tone = "default", className = "", ...props }: CardProps) {
  return (
    <section className={`ui-card ui-card-${tone} ${className}`.trim()} {...props}>
      {children}
    </section>
  );
}
