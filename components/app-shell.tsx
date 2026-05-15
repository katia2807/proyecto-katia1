"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, useState } from "react";
import {
  IconBuildingWarehouse,
  IconChartBar,
  IconChartLine,
  IconFileDownload,
  IconFileText,
  IconLayoutDashboard,
  IconMenu2,
  IconNotes,
  IconPackages,
  IconReceipt,
  IconShieldCheck,
  IconShieldX,
  IconTool,
  IconTruck,
  IconUserCircle,
  IconUsers,
  IconWallet,
} from "@tabler/icons-react";
import { navItems } from "@/lib/constants";
import { logout } from "@/app/(auth)/actions";
import type { AppRole } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";
import { AppShellAccessGuard } from "@/components/app-shell-access-guard";
import { FloatingHelp } from "@/components/ui/floating-help";
import { GlobalSearch } from "@/components/ui/global-search";
import { ThemeToggle } from "@/components/ui/theme-toggle";

const icons = {
  "/": IconLayoutDashboard,
  "/caja": IconWallet,
  "/inventario": IconPackages,
  "/gerencial": IconChartLine,
  "/ventas": IconBuildingWarehouse,
  "/ventas/muebles-personalizados": IconTool,
  "/cotizacion": IconReceipt,
  "/registro": IconNotes,
  "/ventas/alquiler-mixer": IconTruck,
  "/personal": IconUsers,
  "/reportes": IconChartBar,
  "/reportes/antifraude": IconShieldX,
  "/seguridad": IconShieldCheck,
  "/cuenta": IconUserCircle,
  "/admin/empresa": IconUserCircle,
  "/admin/importar": IconFileDownload,
  "/admin/respaldo": IconFileText,
  "/admin/usuarios": IconUsers,
} as const;

type AppShellProps = {
  children: React.ReactNode;
  userName: string;
  userRole: AppRole;
  uiRole: "owner_admin" | "operaciones" | "readonly" | null;
  /** Si se pasa, solo esos `href` aparecen en el menú lateral. */
  navAllowlist: Set<string>;
  globalSearchItems?: React.ComponentProps<typeof GlobalSearch>["items"];
  navBadges?: Record<string, number>;
};

const navSections = [
  { label: "General", items: ["/", "/caja", "/inventario", "/gerencial", "/registro"] },
  {
    label: "Ventas",
    items: ["/ventas"],
  },
  { label: "Admin", items: ["/admin/empresa", "/admin/importar", "/admin/respaldo", "/admin/usuarios", "/cuenta"] },
  { label: "Control", items: ["/reportes", "/reportes/antifraude", "/seguridad", "/personal"] },
] as const;

function roleLabel(role: AppRole, uiRole: AppShellProps["uiRole"]) {
  if (uiRole === "owner_admin") return "Dueña / owner_admin";
  if (uiRole === "operaciones") return "Gerencia";
  if (uiRole === "readonly") return "Vendedor";
  if (role === "vendedor") return "Vendedor";
  if (role === "almacen") return "Almacén";
  if (role === "caja") return "Caja";
  return role;
}

function pageTitleFromPath(pathname: string) {
  const active = [...navItems]
    .filter((item) =>
      item.href === "/" ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`),
    )
    .sort((a, b) => b.href.length - a.href.length)[0];
  return active?.label ?? "Panel";
}

export function AppShell({
  children,
  userName,
  userRole,
  uiRole,
  navAllowlist,
  globalSearchItems = [],
  navBadges = {},
}: AppShellProps) {
  const pathname = usePathname();
  const [isMenuOpen, setIsMenuOpen] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const activeHref =
    [...navItems]
      .filter((item) => item.href === "/" ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`))
      .sort((a, b) => b.href.length - a.href.length)[0]?.href ?? "/";

  const pageTitle = pageTitleFromPath(pathname);
  const userInitial = userName.trim().charAt(0).toUpperCase() || "U";

  const navMarkup = (
    <nav className="space-y-4">
      {navSections.map((section) => {
        const items = section.items
          .map((href) => navItems.find((it) => it.href === href))
          .filter((item): item is (typeof navItems)[number] => Boolean(item))
          .filter((item) => navAllowlist.has(item.href));
        if (items.length === 0) return null;
        return (
          <div key={section.label} className="space-y-1.5">
            <p
              className={cn(
                "px-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--text-muted)]",
                !isMenuOpen && "hidden",
              )}
            >
              {section.label}
            </p>
            {items.map((item) => {
                  const Icon = icons[item.href] ?? IconLayoutDashboard;
              const active = activeHref === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  title={item.label}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={cn(
                    "flex min-h-10 items-center rounded-[var(--border-radius-input)] border-l-[3px] transition",
                    isMenuOpen ? "gap-2 px-3" : "justify-center px-2",
                    active
                      ? "border-l-[var(--accent-primary)] bg-[rgba(124,58,237,0.15)] text-[var(--text-primary)]"
                      : "border-l-transparent text-[var(--text-secondary)] hover:bg-[rgba(124,58,237,0.1)] hover:text-[var(--text-primary)]",
                  )}
                >
                  <Icon className="size-4 shrink-0" />
                  <span className={cn("truncate text-sm", !isMenuOpen && "hidden")}>{item.label}</span>
                  {isMenuOpen && (navBadges[item.href] ?? 0) > 0 ? (
                    <span className="ml-auto rounded-full bg-[var(--color-danger)] px-1.5 py-0.5 text-[10px] font-bold text-white">
                      {navBadges[item.href]}
                    </span>
                  ) : null}
                </Link>
              );
            })}
          </div>
        );
      })}
    </nav>
  );

  return (
    <div className="flex min-h-screen bg-[var(--color-bg)]">
      <Suspense fallback={null}>
        <AppShellAccessGuard pathname={pathname} uiRole={uiRole} userRole={userRole} />
      </Suspense>
      <aside
        className={cn(
          "hidden shrink-0 border-r border-[var(--border-color)] bg-[var(--bg-sidebar)] p-3 lg:flex lg:flex-col",
          "transition-[width] duration-200 ease-out",
          isMenuOpen ? "w-[220px]" : "w-16",
        )}
      >
        <div className={cn("mb-4 flex items-center", isMenuOpen ? "justify-between" : "justify-center")}>
          <div className={cn("flex items-center gap-2", !isMenuOpen && "hidden")}>
            <div className="menu-orb flex size-8 items-center justify-center rounded-full text-xs font-semibold">K</div>
            <p className="text-sm font-semibold tracking-wide text-[var(--text-primary)]">ERP KATIA</p>
          </div>
          <button
            type="button"
            className="flex size-9 items-center justify-center rounded-[var(--border-radius-input)] border border-[var(--border-color)] text-[var(--text-secondary)] hover:bg-[rgba(124,58,237,0.1)]"
            onClick={() => setIsMenuOpen((prev) => !prev)}
            aria-label={isMenuOpen ? "Contraer menú" : "Expandir menú"}
          >
            <IconMenu2 className="size-4" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto pr-1">{navMarkup}</div>
        <div className="mt-4 space-y-2 border-t border-[var(--border-color)] pt-3">
          <div className={cn("flex items-center gap-2", !isMenuOpen && "justify-center")}>
            <div className="profile-avatar flex size-9 items-center justify-center rounded-full text-sm font-semibold">{userInitial}</div>
            <div className={cn(!isMenuOpen && "hidden")}>
              <p className="text-sm font-medium text-[var(--text-primary)]">{userName}</p>
              <p className="text-xs text-[var(--text-secondary)]">{roleLabel(userRole, uiRole)}</p>
            </div>
          </div>
          <form action={logout}>
            <button
              type="submit"
              className={cn(
                "w-full rounded-[var(--border-radius-input)] border border-[var(--border-color)] px-3 py-2 text-xs font-semibold text-[var(--text-secondary)] hover:bg-[rgba(255,255,255,0.04)]",
                !isMenuOpen && "px-0",
              )}
            >
              {isMenuOpen ? "Cerrar sesión" : "↪"}
            </button>
          </form>
        </div>
      </aside>
      {isMobileMenuOpen ? (
        <div className="fixed inset-0 z-40 bg-black/35 lg:hidden" onClick={() => setIsMobileMenuOpen(false)} />
      ) : null}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-[220px] border-r border-[var(--border-color)] bg-[var(--bg-sidebar)] p-3 transition-transform lg:hidden",
          isMobileMenuOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="mb-4 flex items-center justify-between">
          <p className="text-sm font-semibold tracking-wide text-[var(--text-primary)]">ERP KATIA</p>
          <button
            type="button"
            className="rounded-[var(--border-radius-input)] border border-[var(--border-color)] px-3 py-1 text-xs text-[var(--text-secondary)]"
            onClick={() => setIsMobileMenuOpen(false)}
          >
            Cerrar
          </button>
        </div>
        {navMarkup}
      </aside>
      <main className="flex min-w-0 flex-1 flex-col">
        <header className="header-chrome flex h-16 items-center justify-between border-b border-[rgba(255,255,255,0.05)] bg-[var(--bg-primary)] px-4 md:px-6">
          <div className="flex min-w-0 items-center gap-2">
            <button
              type="button"
              className="rounded-[var(--border-radius-input)] border border-[var(--border-color)] p-2 text-[var(--text-secondary)] lg:hidden"
              onClick={() => setIsMobileMenuOpen(true)}
              aria-label="Abrir menú"
            >
              <IconMenu2 className="size-4" />
            </button>
            <h1 className="truncate text-base font-semibold text-[var(--text-primary)]">{pageTitle}</h1>
          </div>
          <GlobalSearch items={globalSearchItems} />
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <div className="profile-avatar flex size-9 items-center justify-center rounded-full text-sm font-semibold">
              {userInitial}
            </div>
          </div>
        </header>
        <div className="dashboard-content p-4 md:p-6 lg:p-8">{children}</div>
      </main>
      <FloatingHelp />
    </div>
  );
}
