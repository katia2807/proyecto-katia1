"use client";

import { useEffect } from "react";

function resolveThemeFromHour(hour: number) {
  // Day mode from 07:00 to 18:59, dark mode at night.
  return hour >= 7 && hour < 19 ? "light" : "dark";
}

export function ThemeByTime() {
  useEffect(() => {
    const applyTheme = () => {
      const manual = window.localStorage.getItem("theme_override");
      if (manual === "light" || manual === "dark") {
        document.documentElement.setAttribute("data-theme", manual);
        return;
      }
      const hour = new Date().getHours();
      const nextTheme = resolveThemeFromHour(hour);
      document.documentElement.setAttribute("data-theme", nextTheme);
    };

    applyTheme();
    const timer = window.setInterval(applyTheme, 60_000);
    return () => window.clearInterval(timer);
  }, []);

  return null;
}
