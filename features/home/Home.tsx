"use client";

import { useEffect, type ReactNode } from "react";
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
  useEffect(() => {
    const shell = document.querySelector<HTMLElement>(".app-shell");
    const nav = document.querySelector<HTMLElement>(".bottom-nav");
    if (!shell || !nav) return;
    const measure = () => {
      const bottom = Number.parseFloat(getComputedStyle(nav).bottom) || 0;
      shell.style.setProperty(
        "--home-nav-reserve",
        `${nav.getBoundingClientRect().height + bottom + 8}px`,
      );
    };
    const observer = new ResizeObserver(measure);
    observer.observe(nav);
    window.addEventListener("resize", measure);
    measure();
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
      shell.style.removeProperty("--home-nav-reserve");
    };
  }, []);
  return (
    <div className={styles.home} data-home>
      <section className={styles.metrics}>{metrics}</section>
      <div className={styles.dashboard}>
        <section className={styles.overview}>{overview}</section>
        {limits ? <section className={styles.limits}>{limits}</section> : null}
      </div>
      {content ? <section className={styles.content}>{content}</section> : null}
      {insights ? (
        <section className={styles.insights}>{insights}</section>
      ) : null}
    </div>
  );
}
