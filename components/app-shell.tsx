"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, useState, useEffect, useRef } from "react";
import {
  IconBuildingWarehouse,
  IconChartBar,
  IconChartLine,
  IconFileDownload,
  IconFileText,
  IconHelp,
  IconLayoutDashboard,
  IconLogout,
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
import { AppVersionNotice } from "@/components/app-version-notice";
import { BrandMark } from "@/components/brand-mark";
import type { AppRole } from "@/lib/supabase/types";
import { resolveRole } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { AppShellAccessGuard } from "@/components/app-shell-access-guard";
import { AppFooter } from "@/components/app-footer";
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
  showUpdatePresentation?: boolean;
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
  const labels: Record<AppRole, string> = {
    owner_admin: "Dueña",
    gerencia: "Gerencia",
    vendedor: "Vendedor",
    almacen: "Almacén",
    caja: "Caja",
    ventas: "Ventas",
    operaciones_caja: "Caja",
    rrhh: "Equipo",
    partner_readonly: "Solo lectura",
  };
  return labels[resolveRole(role, uiRole)];
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
  showUpdatePresentation = false,
}: AppShellProps) {
  const pathname = usePathname();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const desktopMenuRef = useRef<HTMLElement>(null);
  const desktopMenuButtonRef = useRef<HTMLButtonElement>(null);
  const mobileMenuRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (!isMenuOpen) return;
    function closeWhenWorking(event: MouseEvent) {
      const target = event.target;
      if (!(target instanceof Node)
        || desktopMenuRef.current?.contains(target)
        || desktopMenuButtonRef.current?.contains(target)) return;
      setIsMenuOpen(false);
    }
    function closeWithEscape(event: KeyboardEvent) {
      if (event.key !== "Escape" || mobileMenuRef.current?.open) return;
      if (desktopMenuRef.current?.contains(document.activeElement)) desktopMenuButtonRef.current?.focus();
      setIsMenuOpen(false);
    }
    // Después del clic: el control pulsado conserva su acción y su foco.
    document.addEventListener("click", closeWhenWorking);
    document.addEventListener("keydown", closeWithEscape);
    return () => {
      document.removeEventListener("click", closeWhenWorking);
      document.removeEventListener("keydown", closeWithEscape);
    };
  }, [isMenuOpen]);

  useEffect(() => {
    if (!isMobileMenuOpen) return;
    const dialog = mobileMenuRef.current;
    if (!dialog) return;
    dialog.showModal();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      dialog.close();
      document.body.style.overflow = previousOverflow;
    };
  }, [isMobileMenuOpen]);

  useEffect(() => {
    const wideScreen = window.matchMedia("(min-width: 1280px)");
    const closeCompactMenu = () => {
      if (wideScreen.matches) setIsMobileMenuOpen(false);
    };
    wideScreen.addEventListener("change", closeCompactMenu);
    return () => wideScreen.removeEventListener("change", closeCompactMenu);
  }, []);
  // Tracks which badge routes the user has "seen" today (localStorage)
  const [seenRoutes, setSeenRoutes] = useState<Record<string, string>>({});

  // Load seen routes on mount
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

  // Returns effective badge display: 0+red if unseen, count+yellow if seen today
  function effectiveBadge(href: string): { count: number; seen: boolean } {
    const count = navBadges[href] ?? 0;
    if (count === 0) return { count: 0, seen: false };
    const today = getTodayStr();
    const seen = seenRoutes[href] === today;
    return { count, seen };
  }
  const activeHref =
    [...navItems]
      .filter((item) => item.href === "/" ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`))
      .sort((a, b) => b.href.length - a.href.length)[0]?.href ?? "/";

  const pageTitle = pageTitleFromPath(pathname);
  const userInitial = userName.trim().charAt(0).toUpperCase() || "U";
  const userRoleLabel = roleLabel(userRole, uiRole);
  const canOpenAccount = resolveRole(userRole, uiRole) === "owner_admin";

  function profileMarkup(inHeader = false, iconOnly = false) {
    const className = cn(
      "profile-chip flex min-w-0 items-center gap-2 rounded-[var(--katia-radius-md)]",
      inHeader ? "p-1" : iconOnly ? "justify-center p-0.5" : "p-1.5",
      canOpenAccount && "transition-colors hover:bg-[var(--katia-primary-soft)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--katia-primary)]",
    );
    const identity = (
      <>
        <span aria-hidden="true" className="profile-avatar flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold">{userInitial}</span>
        <span className={cn("min-w-0", iconOnly && "sr-only", inHeader && "hidden max-w-40 sm:block")}>
          <span className={cn("block text-sm font-medium text-[var(--katia-text-primary)]", inHeader ? "truncate" : "break-words")}>{userName}</span>
          <span className="block text-xs text-[var(--katia-text-secondary)]">{userRoleLabel}</span>
        </span>
      </>
    );
    return canOpenAccount ? (
      <Link href="/cuenta" data-update-tour={inHeader ? "profile" : undefined} className={className} title={`Mi cuenta · ${userName}`} aria-label={`Mi cuenta de ${userName}, ${userRoleLabel}`} onClick={() => { setIsMobileMenuOpen(false); setIsMenuOpen(false); }}>
        {identity}
      </Link>
    ) : (
      <div data-update-tour={inHeader ? "profile" : undefined} className={className} title={`${userName} · ${userRoleLabel}`} aria-label={`${userName}, ${userRoleLabel}`}>{identity}</div>
    );
  }

  const sessionMarkup = (iconOnly = false) => (
    <div className="mt-4 space-y-2 border-t border-[var(--katia-border-subtle)] pt-3">
      {profileMarkup(false, iconOnly)}
      <form action={logout}>
        <button type="submit" title="Cerrar sesión" aria-label="Cerrar sesión" className={cn("flex min-h-10 w-full items-center justify-center rounded-[var(--katia-radius-md)] border border-[var(--katia-border-default)] py-2 text-xs font-semibold text-[var(--katia-text-secondary)] transition-colors duration-150 hover:bg-[var(--katia-bg-overlay)] hover:text-[var(--katia-text-primary)]", iconOnly ? "px-2" : "px-3")}>
          {iconOnly ? <IconLogout aria-hidden="true" className="size-4" /> : "Cerrar sesión"}
        </button>
      </form>
    </div>
  );

  const navMarkup = (iconOnly = false) => (
    <nav className="space-y-4">
      {navSections.map((section) => {
        const items = section.items
          .map((href) => navItems.find((it) => it.href === href))
          .filter((item): item is (typeof navItems)[number] => Boolean(item))
          .filter((item) => navAllowlist.has(item.href));
        if (items.length === 0) return null;
        return (
          <div key={section.label} className="space-y-1.5">
            <p className={cn("text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--katia-text-tertiary)]", iconOnly ? "sr-only" : "px-2")}>
              {section.label}
            </p>
            {items.map((item) => {
              const Icon = icons[item.href] ?? IconLayoutDashboard;
              const active = activeHref === item.href;
              const { count, seen } = effectiveBadge(item.href);
              const label = count > 0 ? `${item.label} · ${count} avisos` : item.label;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  title={label}
                  aria-label={label}
                  aria-current={active ? "page" : undefined}
                  onClick={() => { setIsMobileMenuOpen(false); setIsMenuOpen(false); }}
                  className={cn(
                    "relative flex min-h-10 items-center rounded-[var(--katia-radius-md)] border-l-[3px] py-2 transition-colors duration-150",
                    iconOnly ? "justify-center px-1" : "gap-2 px-3",
                    active
                      ? "border-l-[var(--katia-primary)] bg-[var(--katia-primary-soft)] text-[var(--katia-text-primary)] font-medium"
                      : "border-l-transparent text-[var(--katia-text-secondary)] hover:bg-[var(--katia-primary-soft)]/60 hover:text-[var(--katia-text-primary)]",
                  )}
                >
                  <Icon aria-hidden="true" className={cn("shrink-0", iconOnly ? "size-5" : "size-4")} />
                  <span className={iconOnly ? "sr-only" : "min-w-0 flex-1 text-sm leading-5"}>{item.label}</span>
                  {count > 0 ? (
                      <span
                        aria-hidden="true"
                        className={`${iconOnly ? "absolute -right-1 -top-1 px-1" : "ml-auto px-1.5"} rounded-full py-0.5 text-[10px] font-bold leading-3 text-white ${
                          seen
                            ? "bg-[var(--katia-warning)]"
                            : "bg-[var(--katia-danger)]"
                        }`}
                      >
                        {count}
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
    <div className="flex min-h-screen bg-[var(--katia-bg-base)]">
      <Suspense fallback={null}>
        <AppShellAccessGuard pathname={pathname} uiRole={uiRole} userRole={userRole} />
      </Suspense>
      <aside
        ref={desktopMenuRef}
        id="desktop-menu"
        aria-label="Menú principal"
        data-collapsed={!isMenuOpen}
        className={cn("sticky top-[var(--app-shell-top,0px)] hidden h-[calc(100dvh-var(--app-shell-top,0px))] shrink-0 flex-col self-start border-r border-[var(--katia-border-subtle)] bg-[var(--bg-sidebar)] xl:flex", isMenuOpen ? "w-[220px] p-3" : "w-16 p-2")}
      >
        <div className="mb-4 flex min-h-9 items-center">
          <div className={cn("flex w-full items-center", isMenuOpen ? "gap-2" : "justify-center")}>
            <BrandMark />
            <p className={isMenuOpen ? "text-sm font-semibold tracking-wide text-[var(--katia-text-primary)]" : "sr-only"}>Katia Suite</p>
          </div>
        </div>
        <div className={cn("min-h-0 flex-1 overflow-y-auto pr-1", !isMenuOpen && "menu-icon-scroll")}>{navMarkup(!isMenuOpen)}</div>
        {sessionMarkup(!isMenuOpen)}
      </aside>
      <dialog
        ref={mobileMenuRef}
        id="compact-menu"
        aria-label="Menú principal"
        onClose={() => setIsMobileMenuOpen(false)}
        onCancel={() => setIsMobileMenuOpen(false)}
        onClick={(event) => {
          if (event.target !== event.currentTarget) return;
          const bounds = event.currentTarget.getBoundingClientRect();
          if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) setIsMobileMenuOpen(false);
        }}
        className="fixed inset-y-0 left-0 m-0 h-dvh max-h-dvh w-[220px] max-w-[85vw] border-0 border-r border-[var(--katia-border-subtle)] bg-[var(--bg-sidebar)] p-3 text-[var(--katia-text-primary)] backdrop:bg-black/40 open:flex open:flex-col"
      >
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2"><BrandMark /><p className="text-sm font-semibold tracking-wide text-[var(--katia-text-primary)]">Katia Suite</p></div>
          <button
            type="button"
            className="rounded-[var(--katia-radius-md)] border border-[var(--katia-border-default)] px-3 py-1 text-xs text-[var(--katia-text-secondary)]"
            onClick={() => setIsMobileMenuOpen(false)}
          >
            Cerrar
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto pr-1">{navMarkup()}</div>
        {sessionMarkup()}
      </dialog>
      <main className="flex min-w-0 flex-1 flex-col">
        <header className="header-chrome flex h-14 items-center justify-between gap-3 border-b border-[var(--katia-border-subtle)] bg-[var(--katia-bg-base)] px-4 md:px-6">
          <div className="flex min-w-0 items-center gap-2">
            <button
              type="button"
              className="shrink-0 rounded-[var(--katia-radius-md)] border border-[var(--katia-border-default)] p-2 text-[var(--katia-text-secondary)] transition-colors hover:bg-[var(--katia-primary-soft)] xl:hidden"
              onClick={() => setIsMobileMenuOpen(true)}
              aria-label="Abrir menú"
              data-update-tour="menu"
              aria-controls="compact-menu"
              aria-expanded={isMobileMenuOpen}
            >
              <IconMenu2 className="size-4" />
            </button>
            <button
              ref={desktopMenuButtonRef}
              type="button"
              className="hidden shrink-0 rounded-[var(--katia-radius-md)] border border-[var(--katia-border-default)] p-2 text-[var(--katia-text-secondary)] transition-colors hover:bg-[var(--katia-primary-soft)] xl:block"
              onClick={() => setIsMenuOpen((prev) => !prev)}
              aria-label={isMenuOpen ? "Contraer menú" : "Expandir menú"}
              data-update-tour="menu"
              aria-controls="desktop-menu"
              aria-expanded={isMenuOpen}
            >
              <IconMenu2 className="size-4" />
            </button>
            <h1 className="truncate text-base font-semibold text-[var(--katia-text-primary)]">{pageTitle}</h1>
          </div>
          <GlobalSearch items={globalSearchItems} />
          <div className="flex shrink-0 items-center gap-2">
            <NotificationBell notifications={notifications} />
            <span data-update-tour="appearance" className="inline-flex"><ThemeToggle /></span>
            {profileMarkup(true)}
          </div>
        </header>
        <div className="dashboard-content p-4 md:p-6 lg:p-8">{children}</div>
        <AppFooter companyName={companyName} />
      </main>
      <AppVersionNotice presentationEnabled={showUpdatePresentation} canOpenHelp={navAllowlist.has("/ayuda")} />
    </div>
  );
}
