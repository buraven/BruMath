"use client";

import { useEffect, useState } from "react";
import type { ThemeMode } from "../../lib/app/AppTypes";

const STORAGE_KEY = "brumath-theme";

export function useThemePreference() {
  const [theme, setTheme] = useState<ThemeMode>("system");

  const applyTheme = (mode: ThemeMode) => {
    setTheme(mode);
    window.localStorage.setItem(STORAGE_KEY, mode);
    document.documentElement.dataset.theme = mode;
  };

  useEffect(() => {
    try {
      const storedTheme =
        (window.localStorage.getItem(STORAGE_KEY) as ThemeMode | null) ||
        "system";
      setTheme(storedTheme);
      document.documentElement.dataset.theme = storedTheme;
    } catch {
      document.documentElement.dataset.theme = "system";
    }
  }, []);

  return { theme, applyTheme };
}
