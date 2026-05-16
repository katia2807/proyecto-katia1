"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, useState, useEffect } from "react";
import {
  IconBuildingWarehouse,
  IconChartBar,
  IconChartLine,
  IconFileDownload,
  IconFileText,
  IconHelp,
  IconLayoutDashboard,
  IconMenu2,
  IconNotes,
  IconPackages,
  IconReceipt,
  IconSettings,
  IconShieldCheck,
  IconShieldX,
  IconTool,
  IconTruck,
  IconUserCircle,
  IconUsers,
  IconUsersGroup,
  IconWallet,
} from "@tabler/icons-react";
import { navItems } from "@/lib/constants";
import { logout } from "@/app/(auth)/actions";
import type { AppRole } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";
import { AppShellAccessGuard } from "@/components/app-shell-access-guard";
import { AppFooter } from "@/components/app-footer";
import { FloatingHelp } from "@/components/ui/floating-help";
import { GlobalSearch } from "@/components/ui/global-search";
import { NotificationBell, type Notification } from "@/components/ui/notification-bell";
import { ThemeToggle } from "@/components/ui/theme-toggle";

const icons = {
  "/": IconLayoutDashboard,
  "/caja": IconWallet,
  "/inventario": IconPackages,
  "/gerencial": IconChartLine,
  "/ventas": IconBuildingWarehouse,
  "/ventas/clientes": IconUsersGroup,
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
  "/configuracion": IconSettings,
  "/ayuda": IconHelp,
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
  companyName?: string | null;
  notifications?: Notification[];
};

const navSections = [
  {
    label: "Operación diaria",
    items: ["/", "/caja", "/ventas", "/cotizacion"],
  },
  {
    label: "Catálogo",
    items: ["/inventario", "/ventas/clientes"],
  },
  {
    label: "Gestión",
    items: ["/gerencial", "/reportes", "/reportes/antifraude", "/registro"],
  },
  {
    label: "Configuración",
    items: ["/configuracion", "/admin/respaldo", "/admin/usuarios", "/admin/importar", "/seguridad", "/personal", "/ayuda"],
  },
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

const BADGE_SEEN_KEY = "katia_badge_seen";

function getTodayStr() {
  return new Date().toISOString().slice(0, 10);
}

function loadSeenRoutes(): Record<string, string> {
  try {
    const raw = localStorage.getItem(BADGE_SEEN_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, string>;
  } catch {
    return {};
  }
}

function saveSeenRoutes(seen: Record<string, string>) {
  try {
    localStorage.setItem(BADGE_SEEN_KEY, JSON.stringify(seen));
  } catch {
    // ignore
  }
}

export function AppShell({
  children,
  userName,
  userRole,
  uiRole,
  navAllowlist,
  globalSearchItems = [],
  navBadges = {},
  companyName,
  notifications = [],
}: AppShellProps) {
  const pathname = usePathname();
  const [isMenuOpen, setIsMenuOpen] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  // Tracks which badge routes the user has "seen" today (localStorage)
  const [seenRoutes, setSeenRoutes] = useState<Record<string, string>>({});

  // Load seen routes on mount
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    setSeenRoutes(loadSeenRoutes());
  }, []);

  // When user visits a badge route, mark it as seen today
  useEffect(() => {
    const today = getTodayStr();
    const badgeRoutes = Object.keys(navBadges).filter((r) => (navBadges[r] ?? 0) > 0);
    const matchedRoute = badgeRoutes.find(
      (r) => pathname === r || pathname.startsWith(`${r}/`),
    );
    if (!matchedRoute) return;
    setSeenRoutes((prev) => {
      if (prev[matchedRoute] === today) return prev; // already marked today
      const next = { ...prev, [matchedRoute]: today };
      saveSeenRoutes(next);
      return next;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // Returns effective badge count: 0 if seen today, original count otherwise
  function effectiveBadge(href: string): { count: number; seen: boolean } {
    const count = navBadges[href] ?? 0;
    if (count === 0) return { count: 0, seen: false };
    const today = getTodayStr();
    const seen = seenRoutes[href] === today;
    return { count: seen ? 0 : count, seen };
  }
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
                "px-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--katia-text-tertiary)]",
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
                    "flex min-h-10 items-center rounded-[var(--katia-radius-md)] border-l-[3px] transition-all duration-150",
                    isMenuOpen ? "gap-2 px-3" : "justify-center px-2",
                    active
                      ? "border-l-[var(--katia-primary)] bg-[var(--katia-primary-soft)] text-[var(--katia-text-primary)] font-medium"
                      : "border-l-transparent text-[var(--katia-text-secondary)] hover:bg-[var(--katia-primary-soft)]/60 hover:text-[var(--katia-text-primary)]",
                  )}
                >
                  <Icon className="size-4 shrink-0" />
                  <span className={cn("truncate text-sm", !isMenuOpen && "hidden")}>{item.label}</span>
                  {isMenuOpen && (() => {
                    const { count } = effectiveBadge(item.href);
                    return count > 0 ? (
                      <span className="ml-auto rounded-full bg-[var(--katia-danger)] px-1.5 py-0.5 text-[10px] font-bold text-white">
                        {count}
                      </span>
                    ) : null;
                  })()}
                </Link>
              );
            })}
          </div>
        );
      })}
    </nav>
  );

  return (
    <div className="flex min-h-screen bg-[var(--katia-bg-base)]">
      <Suspense fallback={null}>
        <AppShellAccessGuard pathname={pathname} uiRole={uiRole} userRole={userRole} />
      </Suspense>
      <aside
        className={cn(
          "hidden shrink-0 border-r border-[var(--katia-border-subtle)] bg-[var(--bg-sidebar)] p-3 lg:flex lg:flex-col",
          "transition-[width] duration-200 ease-out",
          isMenuOpen ? "w-[220px]" : "w-16",
        )}
      >
        <div className={cn("mb-4 flex items-center", isMenuOpen ? "justify-between" : "justify-center")}>
          <div className={cn("flex items-center gap-2", !isMenuOpen && "hidden")}>
            <div className="menu-orb flex size-8 items-center justify-center rounded-full text-xs font-semibold">K</div>
            <p className="text-sm font-semibold tracking-wide text-[var(--katia-text-primary)]">Katia Suite</p>
          </div>
          <button
            type="button"
            className="flex size-9 items-center justify-center rounded-[var(--katia-radius-md)] border border-[var(--katia-border-default)] text-[var(--katia-text-secondary)] transition-all duration-150 hover:bg-[var(--katia-primary-soft)] hover:text-[var(--katia-text-primary)]"
            onClick={() => setIsMenuOpen((prev) => !prev)}
            aria-label={isMenuOpen ? "Contraer menú" : "Expandir menú"}
          >
            <IconMenu2 className="size-4" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto pr-1">{navMarkup}</div>
        <div className="mt-4 space-y-2 border-t border-[var(--katia-border-subtle)] pt-3">
          <div className={cn("flex items-center gap-2", !isMenuOpen && "justify-center")}>
            <div className="profile-avatar flex size-9 items-center justify-center rounded-full text-sm font-semibold">{userInitial}</div>
            <div className={cn(!isMenuOpen && "hidden")}>
              <p className="text-sm font-medium text-[var(--katia-text-primary)]">{userName}</p>
              <p className="text-xs text-[var(--katia-text-secondary)]">{roleLabel(userRole, uiRole)}</p>
            </div>
          </div>
          <form action={logout}>
            <button
              type="submit"
              className={cn(
                "w-full rounded-[var(--katia-radius-md)] border border-[var(--katia-border-default)] px-3 py-2 text-xs font-semibold text-[var(--katia-text-secondary)] transition-all duration-150 hover:bg-[var(--katia-bg-overlay)] hover:text-[var(--katia-text-primary)]",
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
          "fixed inset-y-0 left-0 z-50 w-[220px] border-r border-[var(--katia-border-subtle)] bg-[var(--bg-sidebar)] p-3 transition-transform lg:hidden",
          isMobileMenuOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="mb-4 flex items-center justify-between">
          <p className="text-sm font-semibold tracking-wide text-[var(--katia-text-primary)]">Katia Suite</p>
          <button
            type="button"
            className="rounded-[var(--katia-radius-md)] border border-[var(--katia-border-default)] px-3 py-1 text-xs text-[var(--katia-text-secondary)]"
            onClick={() => setIsMobileMenuOpen(false)}
          >
            Cerrar
          </button>
        </div>
        {navMarkup}
      </aside>
      <main className="flex min-w-0 flex-1 flex-col">
        <header className="header-chrome flex h-14 items-center justify-between border-b border-[var(--katia-border-subtle)] bg-[var(--katia-bg-base)] px-4 md:px-6">
          <div className="flex min-w-0 items-center gap-2">
            <button
              type="button"
              className="rounded-[var(--katia-radius-md)] border border-[var(--katia-border-default)] p-2 text-[var(--katia-text-secondary)] transition-colors hover:bg-[var(--katia-primary-soft)] lg:hidden"
              onClick={() => setIsMobileMenuOpen(true)}
              aria-label="Abrir menú"
            >
              <IconMenu2 className="size-4" />
            </button>
            <h1 className="truncate text-base font-semibold text-[var(--katia-text-primary)]">{pageTitle}</h1>
          </div>
          <GlobalSearch items={globalSearchItems} />
          <div className="flex items-center gap-2">
            <NotificationBell notifications={notifications} />
            <ThemeToggle />
            <div className="profile-avatar flex size-9 items-center justify-center rounded-full text-sm font-semibold">
              {userInitial}
            </div>
          </div>
        </header>
        <div className="dashboard-content p-4 md:p-6 lg:p-8">{children}</div>
        <AppFooter companyName={companyName} />
      </main>
      <FloatingHelp />
    </div>
  );
}
