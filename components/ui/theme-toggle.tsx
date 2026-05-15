"use client";

import { useEffect, useState } from "react";
import { IconSun, IconMoon } from "@tabler/icons-react";

export function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark">("dark");

  useEffect(() => {
    const stored = localStorage.getItem("theme_override");
    const current = document.documentElement.getAttribute("data-theme");
    setTheme((stored ?? current ?? "dark") as "light" | "dark");
  }, []);

  const toggle = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    localStorage.setItem("theme_override", next);
    document.documentElement.setAttribute("data-theme", next);
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={theme === "dark" ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
      className="flex size-9 items-center justify-center rounded-[var(--border-radius-input)] border border-[var(--border-color)] text-[var(--text-secondary)] transition hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)]"
    >
      {theme === "dark" ? <IconSun className="size-4" /> : <IconMoon className="size-4" />}
    </button>
  );
}
