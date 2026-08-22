import type { ReactNode } from "react";
import styles from "./Home.module.css";

type HomeProps = {
  header: ReactNode;
  balance: ReactNode;
  summary?: ReactNode;
  limits?: ReactNode;
  upcoming?: ReactNode;
  insights?: ReactNode;
};

export function Home({ header, balance, summary, limits, upcoming, insights }: HomeProps) {
  return (
    <main className={styles.home}>
      <section className={styles.header}>{header}</section>
      <section className={styles.balance}>{balance}</section>
      {summary ? <section className={styles.summary}>{summary}</section> : null}
      <div className={styles.grid}>
        {limits ? <section>{limits}</section> : null}
        {upcoming ? <section>{upcoming}</section> : null}
      </div>
      {insights ? <section className={styles.insights}>{insights}</section> : null}
    </main>
  );
}
