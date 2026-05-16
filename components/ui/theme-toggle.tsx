"use client";

import { useEffect, useState } from "react";
import { IconSun, IconMoon } from "@tabler/icons-react";

export function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark">("dark");

  useEffect(() => {
    const stored = localStorage.getItem("theme_override");
    const current = document.documentElement.getAttribute("data-theme");
    // eslint-disable-next-line react-hooks/set-state-in-effect
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
      className="flex size-9 items-center justify-center rounded-[var(--katia-radius-md)] border border-[var(--katia-border-default)] text-[var(--katia-text-secondary)] transition-all duration-150 hover:bg-[var(--katia-bg-elevated)] hover:text-[var(--katia-text-primary)] hover:border-[var(--katia-border-emphasis)]"
    >
      {theme === "dark" ? <IconSun className="size-4" /> : <IconMoon className="size-4" />}
    </button>
  );
}
