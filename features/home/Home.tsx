"use client";

import type { ReactNode } from "react";
import styles from "./Home.module.css";

type HomeProps = {
  metrics: ReactNode;
  overview: ReactNode;
  limits?: ReactNode;
  highlights?: ReactNode;
  assistant?: ReactNode;
  content?: ReactNode;
  insights?: ReactNode;
};

export function Home({
  metrics,
  overview,
  limits,
  highlights,
  assistant,
  content,
  insights,
}: HomeProps) {
  return (
    <div className={styles.home} data-home>
      <section className={styles.metrics}>{metrics}</section>
      <div className={styles.dashboard}>
        <section className={styles.overview}>{overview}</section>
        {limits ? <section className={styles.limits}>{limits}</section> : null}
      </div>
      {highlights ? (
        <section className={styles.highlights}>{highlights}</section>
      ) : null}
      {assistant || insights ? (
        <div className={styles.assistantInsights}>
          {assistant ? (
            <section className={styles.assistant}>{assistant}</section>
          ) : null}
          {insights ? (
            <section className={styles.insights}>{insights}</section>
          ) : null}
        </div>
      ) : null}
      {content ? <section className={styles.content}>{content}</section> : null}
    </div>
  );
}
