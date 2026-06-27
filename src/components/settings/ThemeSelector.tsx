"use client";

import { useThemeContext } from "@/src/components/providers/ThemeProvider";
import type { Theme } from "@/src/hooks/useTheme";

const themeOptions: { value: Theme; label: string; icon: string }[] = [
  { value: "light", label: "Light", icon: "\u2600" },
  { value: "dark", label: "Dark", icon: "\u263E" },
  { value: "solar", label: "High Contrast (Solar)", icon: "\u2600\uFE0F" },
];

export function ThemeSelector() {
  const { theme, setTheme } = useThemeContext();

  return (
    <div
      role="radiogroup"
      aria-label="Theme selection"
      className="flex items-center gap-1"
    >
      {themeOptions.map((option) => {
        const isActive = theme === option.value;
        return (
          <button
            key={option.value}
            role="radio"
            aria-checked={isActive}
            aria-label={option.label}
            onClick={() => setTheme(option.value)}
            title={option.label}
            className={`flex items-center justify-center rounded-md px-2.5 py-1.5 text-sm font-medium transition-all ${
              isActive
                ? "bg-[var(--color-primary,#0f766e)] text-[var(--color-primary-text,#ffffff)]"
                : "text-[var(--color-text-secondary,#3e3830)] hover:bg-[var(--color-surface,#f0f0f0)]"
            }`}
          >
            <span className="mr-1.5" aria-hidden="true">
              {option.icon}
            </span>
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
