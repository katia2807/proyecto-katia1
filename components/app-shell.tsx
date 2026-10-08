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
  const menuTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pointerInMenuRef = useRef(false);
  const pointerPressedRef = useRef(false);
  const keyboardMenuFocusRef = useRef(false);
  const mobileMenuRef = useRef<HTMLDialogElement>(null);

  function clearMenuTimer() {
    if (menuTimerRef.current !== null) clearTimeout(menuTimerRef.current);
    menuTimerRef.current = null;
  }

  function closeDesktopMenu() {
    clearMenuTimer();
    keyboardMenuFocusRef.current = false;
    setIsMenuOpen(false);
  }

  function scheduleMenuClose() {
    clearMenuTimer();
    menuTimerRef.current = setTimeout(() => {
      menuTimerRef.current = null;
      if (pointerInMenuRef.current
        || (keyboardMenuFocusRef.current && desktopMenuRef.current?.contains(document.activeElement))) return;
      setIsMenuOpen(false);
    }, 320);
  }

  useEffect(() => () => {
    if (menuTimerRef.current !== null) clearTimeout(menuTimerRef.current);
  }, []);

  useEffect(() => {
    if (!isMenuOpen) return;
    function closeWhenWorking(event: MouseEvent) {
      const target = event.target;
      if (!(target instanceof Node) || desktopMenuRef.current?.contains(target)) return;
      if (menuTimerRef.current !== null) clearTimeout(menuTimerRef.current);
      menuTimerRef.current = null;
      keyboardMenuFocusRef.current = false;
      setIsMenuOpen(false);
    }
    function closeWithEscape(event: KeyboardEvent) {
      if (event.key !== "Escape" || mobileMenuRef.current?.open) return;
      if (menuTimerRef.current !== null) clearTimeout(menuTimerRef.current);
      menuTimerRef.current = null;
      keyboardMenuFocusRef.current = false;
      // El enlace enfocado conserva su icono visible al recogerse el panel.
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

  function profileMarkup(inHeader = false, iconOnly = false, automatic = false) {
    const className = cn(
      "profile-chip flex min-w-0 items-center gap-2 rounded-[var(--katia-radius-md)]",
      inHeader ? "p-1" : automatic ? "menu-auto-profile p-1.5" : iconOnly ? "justify-center p-0.5" : "p-1.5",
      canOpenAccount && "transition-colors hover:bg-[var(--katia-primary-soft)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--katia-primary)]",
    );
    const identity = (
      <>
        <span aria-hidden="true" className="profile-avatar flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold">{userInitial}</span>
        <span className={cn("min-w-0", automatic ? "menu-auto-label w-32 shrink-0" : iconOnly && "sr-only", inHeader && "hidden max-w-40 sm:block")}>
          <span className={cn("block text-sm font-medium text-[var(--katia-text-primary)]", inHeader ? "truncate" : "break-words")}>{userName}</span>
          <span className="block text-xs text-[var(--katia-text-secondary)]">{userRoleLabel}</span>
        </span>
      </>
    );
    return canOpenAccount ? (
      <Link href="/cuenta" data-update-tour={inHeader ? "profile" : undefined} className={className} title={`Mi cuenta · ${userName}`} aria-label={`Mi cuenta de ${userName}, ${userRoleLabel}`} onClick={() => { setIsMobileMenuOpen(false); closeDesktopMenu(); }}>
        {identity}
      </Link>
    ) : (
      <div data-update-tour={inHeader ? "profile" : undefined} className={className} title={`${userName} · ${userRoleLabel}`} aria-label={`${userName}, ${userRoleLabel}`}>{identity}</div>
    );
  }

  const sessionMarkup = (iconOnly = false, automatic = false) => (
    <div className="mt-4 space-y-2 border-t border-[var(--katia-border-subtle)] pt-3">
      {profileMarkup(false, iconOnly, automatic)}
      <form action={logout}>
        <button type="submit" title="Cerrar sesión" aria-label="Cerrar sesión" className={cn("flex min-h-10 w-full items-center rounded-[var(--katia-radius-md)] border border-[var(--katia-border-default)] py-2 text-xs font-semibold text-[var(--katia-text-secondary)] transition-colors duration-150 hover:bg-[var(--katia-bg-overlay)] hover:text-[var(--katia-text-primary)]", automatic ? "gap-3 px-3" : "justify-center px-3")}>
          {automatic ? <><IconLogout aria-hidden="true" className="size-5 shrink-0" /><span className="menu-auto-label whitespace-nowrap">Cerrar sesión</span></> : iconOnly ? <IconLogout aria-hidden="true" className="size-4" /> : "Cerrar sesión"}
        </button>
      </form>
    </div>
  );

  const navMarkup = (iconOnly = false, automatic = false) => (
    <nav className="space-y-4">
      {navSections.map((section) => {
        const items = section.items
          .map((href) => navItems.find((it) => it.href === href))
          .filter((item): item is (typeof navItems)[number] => Boolean(item))
          .filter((item) => navAllowlist.has(item.href));
        if (items.length === 0) return null;
        return (
          <div key={section.label} className="space-y-1.5">
            <p className={cn("text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--katia-text-tertiary)]", automatic ? "menu-auto-label h-4 whitespace-nowrap px-2" : iconOnly ? "sr-only" : "px-2")}>
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
                  onClick={() => { setIsMobileMenuOpen(false); closeDesktopMenu(); }}
                  className={cn(
                    "relative flex min-h-10 items-center rounded-[var(--katia-radius-md)] border-l-[3px] py-2 transition-colors duration-150",
                    automatic ? "gap-3 px-2" : iconOnly ? "justify-center px-1" : "gap-2 px-3",
                    active
                      ? "border-l-[var(--katia-primary)] bg-[var(--katia-primary-soft)] text-[var(--katia-text-primary)] font-medium"
                      : "border-l-transparent text-[var(--katia-text-secondary)] hover:bg-[var(--katia-primary-soft)]/60 hover:text-[var(--katia-text-primary)]",
                  )}
                >
                  <Icon aria-hidden="true" className={cn("shrink-0", automatic || iconOnly ? "size-5" : "size-4")} />
                  <span className={automatic ? "menu-auto-label w-36 shrink-0 text-sm leading-5" : iconOnly ? "sr-only" : "min-w-0 flex-1 text-sm leading-5"}>{item.label}</span>
                  {count > 0 ? (
                      <span
                        aria-hidden="true"
                        className={`${automatic ? "absolute left-6 top-0 px-1" : iconOnly ? "absolute -right-1 -top-1 px-1" : "ml-auto px-1.5"} rounded-full py-0.5 text-[10px] font-bold leading-3 text-white ${
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
      <div className="sticky top-[var(--app-shell-top,0px)] z-30 hidden h-[calc(100dvh-var(--app-shell-top,0px))] w-16 shrink-0 self-start xl:block">
      <aside
        ref={desktopMenuRef}
        id="desktop-menu"
        aria-label="Menú principal"
        data-collapsed={!isMenuOpen}
        onPointerEnter={(event) => {
          if (event.pointerType !== "mouse" && event.pointerType !== "pen") return;
          pointerInMenuRef.current = true;
          clearMenuTimer();
          menuTimerRef.current = setTimeout(() => {
            menuTimerRef.current = null;
            if (pointerInMenuRef.current) setIsMenuOpen(true);
          }, 140);
        }}
        onPointerLeave={() => { pointerInMenuRef.current = false; pointerPressedRef.current = false; scheduleMenuClose(); }}
        onPointerDown={() => { pointerPressedRef.current = true; keyboardMenuFocusRef.current = false; }}
        onPointerUp={() => { pointerPressedRef.current = false; }}
        onFocusCapture={() => {
          clearMenuTimer();
          keyboardMenuFocusRef.current = !pointerPressedRef.current;
          setIsMenuOpen(true);
        }}
        onBlurCapture={(event) => {
          if (event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget)) return;
          keyboardMenuFocusRef.current = false;
          if (!pointerInMenuRef.current) scheduleMenuClose();
        }}
        className="menu-auto-panel absolute inset-y-0 left-0 flex flex-col overflow-hidden border-r border-[var(--katia-border-subtle)] bg-[var(--bg-sidebar)] p-2"
      >
        <div className="mb-4 flex min-h-10 shrink-0 items-center">
          <button type="button" data-update-tour="menu" aria-label="Mostrar nombres del menú" aria-controls="desktop-menu" aria-expanded={isMenuOpen} onClick={() => { clearMenuTimer(); setIsMenuOpen(true); }} className="flex w-full items-center gap-3 rounded-[var(--katia-radius-md)] px-1.5 text-left focus-visible:outline-2 focus-visible:outline-[var(--katia-primary)]">
            <BrandMark />
            <span className="menu-auto-label whitespace-nowrap text-sm font-semibold tracking-wide text-[var(--katia-text-primary)]">Katia Suite</span>
          </button>
        </div>
        <div className={cn("min-h-0 flex-1 overflow-x-hidden overflow-y-auto", !isMenuOpen && "menu-icon-scroll")}>{navMarkup(!isMenuOpen, true)}</div>
        {sessionMarkup(!isMenuOpen, true)}
      </aside>
      </div>
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
