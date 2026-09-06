import type { ReactNode } from "react";
import styles from "./Home.module.css";

type HomeProps = {
  metrics: ReactNode;
  overview: ReactNode;
  limits?: ReactNode;
  content?: ReactNode;
  insights?: ReactNode;
};

export function Home({
  metrics,
  overview,
  limits,
  content,
  insights,
}: HomeProps) {
  return (
    <main className={styles.home}>
      <section className={styles.metrics}>{metrics}</section>
      <div className={styles.dashboard}>
        <section className={styles.overview}>{overview}</section>
        {limits ? <section className={styles.limits}>{limits}</section> : null}
      </div>
      {content ? <section className={styles.content}>{content}</section> : null}
      {insights ? (
        <section className={styles.insights}>{insights}</section>
      ) : null}
    </main>
  );
}
