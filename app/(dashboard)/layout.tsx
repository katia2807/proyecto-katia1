import { AppShell } from "@/components/app-shell";
import { DatabaseModeBanner } from "@/components/database-mode-banner";
import { requireAuthContext } from "@/lib/auth";
import { getClientesRows, getCobrosVencidos, getCotizacionesUnificadasRows, getInventarioResumen } from "@/lib/data";
import { buildNavHrefAllowlist } from "@/lib/permissions";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const context = await requireAuthContext();
  const displayName = context.fullName?.trim() || "Usuario";
  const navAllowlist = buildNavHrefAllowlist(context.role, context.uiRole);
  const [clientes, cotizaciones, inventario, cobros] = await Promise.all([
    getClientesRows().catch(() => []),
    getCotizacionesUnificadasRows().catch(() => []),
    getInventarioResumen().catch(() => ({ productos: [], stockBajo: [] })),
    getCobrosVencidos().catch(() => []),
  ]);
  const globalSearchItems = [
    ...clientes.slice(0, 200).map((cliente) => ({
      label: cliente.nombre,
      detail: [cliente.documento, cliente.telefono].filter(Boolean).join(" · ") || "Cliente",
      href: `/ventas/clientes?cliente=${cliente.id}`,
      type: "Cliente" as const,
    })),
    ...inventario.productos.slice(0, 200).map((producto) => ({
      label: producto.nombre,
      detail: `${producto.codigo} · ${producto.categoria}`,
      href: `/inventario?tab=productos#producto-${producto.id}`,
      type: "Producto" as const,
    })),
    ...cotizaciones.slice(0, 200).map((cotizacion) => ({
      label: cotizacion.correlativo ?? cotizacion.id.slice(0, 8),
      detail: `${cotizacion.fecha} · ${cotizacion.estado_flujo}`,
      href: `/cotizacion?cotizacion=${cotizacion.id}`,
      type: "Cotizacion" as const,
    })),
  ];

  return (
    <>
      <DatabaseModeBanner />
      <AppShell
        navAllowlist={navAllowlist}
        uiRole={context.uiRole}
        userRole={context.role}
        userName={displayName}
        globalSearchItems={globalSearchItems}
        navBadges={{
          "/inventario": inventario.stockBajo.length,
          "/cotizacion": cobros.length,
        }}
      >
        {children}
      </AppShell>
    </>
  );
}
