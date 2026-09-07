"use client";

import { useLayoutEffect, useRef, type ReactNode } from "react";
import styles from "./ViewportNavigation.module.css";

// Keep the shared navigation outside the shell's scrolling/clipping ancestors.
export function ViewportNavigation({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const viewport = window.visualViewport;
    const update = () => {
      if (!ref.current) return;
      ref.current.style.height = `${viewport?.height ?? window.innerHeight}px`;
      ref.current.style.top = `${viewport?.offsetTop ?? 0}px`;
    };
    update();
    window.addEventListener("resize", update);
    viewport?.addEventListener("resize", update);
    viewport?.addEventListener("scroll", update);
    return () => {
      window.removeEventListener("resize", update);
      viewport?.removeEventListener("resize", update);
      viewport?.removeEventListener("scroll", update);
    };
  }, []);
  return (
    <div ref={ref} className={styles.viewport}>
      {children}
    </div>
  );
}
