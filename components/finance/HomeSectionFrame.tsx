import type { ReactNode } from "react";
import styles from "./HomeSectionFrame.module.css";

type HomeSectionFrameProps = {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
};

export function HomeSectionFrame({ title, subtitle, action, children }: HomeSectionFrameProps) {
  return (
    <section className={styles.section}>
      <div className={styles.header}>
        <div>
          <h2>{title}</h2>
          {subtitle ? <span>{subtitle}</span> : null}
        </div>
        {action ? <div className={styles.action}>{action}</div> : null}
      </div>
      {children}
    </section>
  );
}
