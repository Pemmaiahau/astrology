"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

const STORAGE_KEY = "jyotisha.theme";

/**
 * Light/dark toggle. The class strategy (`.dark` on <html>) is applied
 * pre-paint by the inline script in layout.tsx; this control just flips
 * and persists it. Rendered after mount to avoid hydration mismatch.
 */
export default function ThemeToggle() {
  const [dark, setDark] = useState<boolean | null>(null);

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  if (dark === null) return <span className="h-7 w-7" aria-hidden />;

  const toggle = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem(STORAGE_KEY, next ? "dark" : "light");
    } catch {
      /* storage unavailable — theme lasts for this session */
    }
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}
      title={dark ? "Switch to light theme" : "Switch to dark theme"}
      className="flex h-7 w-7 items-center justify-center rounded-lg border border-line-2 bg-surface-2 text-fg-muted transition hover:text-heading"
    >
      {dark ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
    </button>
  );
}
