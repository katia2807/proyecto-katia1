"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  ChartColumn,
  CheckCircle2,
  Database,
  Download,
  HandCoins,
  LayoutDashboard,
  NotepadText,
  Menu,
  Package,
  ReceiptText,
  ShieldAlert,
  ShieldCheck,
  Truck,
  UserCog,
  Users,
  Wallet,
  Wrench,
} from "lucide-react";
import { navItems } from "@/lib/constants";
import { logout } from "@/app/(auth)/actions";
import type { AppRole } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";

const icons = {
  "/": LayoutDashboard,
  "/caja": Wallet,
  "/inventario": Package,
  "/ventas": HandCoins,
  "/ventas/muebles-personalizados": Wrench,
  "/cotizacion": ReceiptText,
  "/registro": NotepadText,
  "/ventas/alquiler-mixer": Truck,
  "/personal": Users,
  "/reportes": ChartColumn,
  "/reportes/antifraude": ShieldAlert,
  "/checklist": CheckCircle2,
  "/seguridad": ShieldCheck,
  "/cuenta": UserCog,
  "/admin/empresa": UserCog,
  "/admin/importar": Download,
  "/admin/respaldo": Database,
  "/admin/usuarios": Users,
} as const;

type AppShellProps = {
  children: React.ReactNode;
  userName: string;
  userRole: AppRole;
  uiRole: "owner_admin" | "operaciones" | "readonly" | null;
  /** Si se pasa, solo esos `href` aparecen en el menú lateral. */
  navAllowlist: Set<string>;
};

function roleLabel(role: AppRole, uiRole: AppShellProps["uiRole"]) {
  if (uiRole === "owner_admin") return "Dueña / owner_admin";
  if (uiRole === "operaciones") return "Operaciones";
  if (uiRole === "readonly") return "Solo lectura";
  return role;
}

export function AppShell({ children, userName, userRole, uiRole, navAllowlist }: AppShellProps) {
  const pathname = usePathname();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [themeMode, setThemeMode] = useState<"dark" | "light">(() => {
    if (typeof window === "undefined") return "dark";
    const fromStorage = window.localStorage.getItem("theme_override");
    if (fromStorage === "light" || fromStorage === "dark") return fromStorage;
    const current = document.documentElement.getAttribute("data-theme");
    return current === "light" ? "light" : "dark";
  });
  const activeHref =
    [...navItems]
      .filter((item) => item.href === "/" ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`))
      .sort((a, b) => b.href.length - a.href.length)[0]?.href ?? "/";

  function toggleThemeMode() {
    const next: "dark" | "light" = themeMode === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    window.localStorage.setItem("theme_override", next);
    setThemeMode(next);
  }

  const navMarkup = (
    <nav className="space-y-1.5">
      {navItems.filter((item) => navAllowlist.has(item.href)).map((item) => {
        const Icon = icons[item.href] ?? LayoutDashboard;
        const active = activeHref === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            title={item.label}
            onClick={() => setIsMobileMenuOpen(false)}
            className={cn(
              "flex items-center rounded-[var(--radius-md)] py-2 text-sm font-medium transition",
              isMenuOpen ? "gap-2 px-3" : "justify-center px-2",
              active
                ? "bg-[linear-gradient(120deg,color-mix(in_srgb,var(--color-primary-soft)_80%,var(--color-surface)),color-mix(in_srgb,var(--color-accent-soft)_22%,var(--color-surface)))] text-[var(--color-text-primary)] shadow-[var(--shadow-soft)]"
                : "text-[var(--color-text-secondary)] hover:bg-[color-mix(in_srgb,var(--color-primary-soft)_58%,transparent)] hover:text-[var(--color-text-primary)]",
            )}
          >
            <Icon className="size-4 shrink-0" />
            <span className={cn("truncate", !isMenuOpen && "hidden")}>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="flex min-h-screen bg-[var(--color-bg)]">
      <aside
        className={cn(
          "hidden border-r border-[var(--color-border)] bg-[var(--color-surface)]/95 p-3 shadow-[var(--shadow-card)] backdrop-blur lg:block",
          "transition-all duration-200 ease-out",
          isMenuOpen ? "w-72" : "w-20",
        )}
        onMouseEnter={() => setIsMenuOpen(true)}
        onMouseLeave={() => setIsMenuOpen(false)}
      >
        <div className="mb-4 flex items-center justify-center">
          <button
            type="button"
            className="menu-orb flex size-10 items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-primary-soft)] text-[var(--color-text-primary)]"
            onClick={() => setIsMenuOpen((prev) => !prev)}
            aria-label={isMenuOpen ? "Contraer menú" : "Expandir menú"}
            title={isMenuOpen ? "Contraer menú" : "Expandir menú"}
          >
            <Menu className="size-5" />
          </button>
        </div>
        {navMarkup}
      </aside>
      {isMobileMenuOpen ? (
        <div className="fixed inset-0 z-40 bg-black/35 lg:hidden" onClick={() => setIsMobileMenuOpen(false)} />
      ) : null}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-72 border-r border-[var(--color-border)] bg-[var(--color-surface)] p-3 shadow-[var(--shadow-card)] transition-transform lg:hidden",
          isMobileMenuOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="mb-4 flex items-center justify-between">
          <div className="menu-orb flex size-10 items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-primary-soft)] text-[var(--color-text-primary)]">
            <Menu className="size-5" />
          </div>
          <button
            type="button"
            className="rounded-full border border-[var(--color-border)] px-3 py-1 text-xs font-semibold"
            onClick={() => setIsMobileMenuOpen(false)}
          >
            Cerrar
          </button>
        </div>
        {navMarkup}
      </aside>
      <main className="flex min-w-0 flex-1 flex-col">
        <header className="header-chrome flex h-16 items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-surface)]/90 px-4 backdrop-blur md:px-6">
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="rounded-[var(--radius-sm)] border border-[var(--color-border)] p-2 text-[var(--color-text-primary)] lg:hidden"
              onClick={() => setIsMobileMenuOpen(true)}
              aria-label="Abrir menú"
            >
              <Menu className="size-4" />
            </button>
            <div className="profile-chip hidden items-center gap-3 rounded-2xl border border-[var(--color-border)] px-3 py-1.5 sm:flex">
              <div className="profile-avatar flex size-9 items-center justify-center rounded-full bg-[var(--color-primary-soft)] text-sm font-bold text-[var(--color-text-primary)]">
                {userName.slice(0, 1).toUpperCase()}
              </div>
              <div>
                <p className="text-sm font-semibold text-[var(--color-text-primary)]">{userName}</p>
                <p className="text-xs text-[var(--color-text-secondary)]">Rol: {roleLabel(userRole, uiRole)}</p>
              </div>
            </div>
          </div>
          <div className="profile-chip flex items-center gap-3 rounded-2xl border border-[var(--color-border)] px-3 py-1.5 sm:hidden">
            <div className="profile-avatar flex size-9 items-center justify-center rounded-full bg-[var(--color-primary-soft)] text-sm font-bold text-[var(--color-text-primary)]">
              {userName.slice(0, 1).toUpperCase()}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleThemeMode}
              className="rounded-full border border-[var(--color-border)] px-3 py-1 text-xs font-semibold text-[var(--color-text-primary)] transition hover:bg-[var(--color-primary-soft)]"
            >
              {themeMode === "dark" ? "Modo claro" : "Modo oscuro"}
            </button>
            <form action={logout}>
              <button
                type="submit"
                className="rounded-full border border-[var(--color-border)] px-3 py-1 text-xs font-semibold text-[var(--color-text-secondary)] transition hover:bg-[var(--color-primary-soft)]"
              >
                Cerrar sesión
              </button>
            </form>
          </div>
        </header>
        <div className="dashboard-content p-4 md:p-6 lg:p-8">{children}</div>
      </main>
    </div>
  );
}
