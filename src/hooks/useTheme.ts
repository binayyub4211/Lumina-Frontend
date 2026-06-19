"use client";

import { useCallback, useEffect, useState } from "react";

export type Theme = "light" | "dark" | "solar";

const STORAGE_KEY = "lumina-theme";
const SOLAR_CLASS = "solar";
const DARK_CLASS = "dark";

function getStoredTheme(): Theme {
  if (typeof window === "undefined") return "light";
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "light" || stored === "dark" || stored === "solar") {
      return stored;
    }
  } catch {}
  return "light";
}

function getSystemTheme(): "light" | "dark" {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.classList.remove(SOLAR_CLASS, DARK_CLASS);
  if (theme === "solar") {
    root.classList.add(SOLAR_CLASS);
  } else if (theme === "dark") {
    root.classList.add(DARK_CLASS);
  }
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>("light");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const initial = getStoredTheme();
    setThemeState(initial);
    applyTheme(initial);
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => {
      if (!localStorage.getItem(STORAGE_KEY)) {
        const system = getSystemTheme();
        if (theme !== "solar") {
          setThemeState(system);
          applyTheme(system);
        }
      }
    };
    mediaQuery.addEventListener("change", handler);
    return () => mediaQuery.removeEventListener("change", handler);
  }, [mounted, theme]);

  const setTheme = useCallback((newTheme: Theme) => {
    setThemeState(newTheme);
    applyTheme(newTheme);
    try {
      localStorage.setItem(STORAGE_KEY, newTheme);
    } catch {}
  }, []);

  const cycleTheme = useCallback(() => {
    const order: Theme[] = ["light", "dark", "solar"];
    const idx = order.indexOf(theme);
    setTheme(order[(idx + 1) % order.length]);
  }, [theme, setTheme]);

  return { theme, setTheme, cycleTheme, mounted };
}
