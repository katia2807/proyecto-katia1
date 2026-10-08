import { AppShell } from "@/components/app-shell";
import { DatabaseModeBanner } from "@/components/database-mode-banner";
import { requireAuthContext } from "@/lib/auth";
import { readCompleteTable } from "@/lib/complete-data";
import { getGerencialSources } from "@/lib/gerencial-data";
import { buildGerencialModel } from "@/lib/gerencial-model";
import { canAccessPath, buildNavHrefAllowlist } from "@/lib/permissions";
import { getEmpresaConfig } from "@/lib/company-config";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const context = await requireAuthContext();
  const displayName = context.fullName?.trim() || "Usuario";
  const navAllowlist = buildNavHrefAllowlist(context.role, context.uiRole);
  const [clientes, cotizaciones, productos, mandoSources, empresa] = await Promise.all([
    canAccessPath(context.role,context.uiRole,"/ventas/clientes") ? readCompleteTable("clientes",context.organizationId).catch(() => []) : Promise.resolve([]),
    canAccessPath(context.role,context.uiRole,"/cotizacion") ? readCompleteTable("cotizaciones_unificadas",context.organizationId).catch(() => []) : Promise.resolve([]),
    canAccessPath(context.role,context.uiRole,"/inventario") ? readCompleteTable("inventario_productos",context.organizationId).catch(() => []) : Promise.resolve([]),
    canAccessPath(context.role,context.uiRole,"/gerencial") ? getGerencialSources("hoy",context.organizationId) : Promise.resolve(null),
    getEmpresaConfig(context.organizationId).catch(() => null),
  ]);
  const mando = mandoSources ? buildGerencialModel(mandoSources) : null;
  const recent = <T extends {created_at:string}>(rows:T[]) => [...rows].sort((a,b)=>b.created_at.localeCompare(a.created_at)).slice(0,200);
  const globalSearchItems = [
    ...recent(clientes).map((cliente) => ({
      label: cliente.nombre,
      detail: [cliente.documento, cliente.telefono].filter(Boolean).join(" · ") || "Cliente",
      href: `/ventas/clientes/${cliente.id}`,
      type: "Cliente" as const,
    })),
    ...recent(productos.filter(p=>p.activo)).map((producto) => ({
      label: producto.nombre,
      detail: `${producto.codigo} · ${producto.categoria}`,
      href: `/inventario?tab=productos&buscar=${encodeURIComponent(producto.nombre)}`,
      type: "Producto" as const,
    })),
    ...recent(cotizaciones).map((cotizacion) => ({
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
        showUpdatePresentation
        navAllowlist={navAllowlist}
        uiRole={context.uiRole}
        userRole={context.role}
        userName={displayName}
        globalSearchItems={globalSearchItems}
        companyName={empresa?.nombre ?? null}
        navBadges={{
          // Centro de Mando muestra el total de alertas críticas del negocio
          "/gerencial": mando?.actions.length ?? 0,
          // Inventario solo muestra badge si hay stock bajo que atender
          "/inventario": productos.filter(p=>p.activo && Number(p.stock_actual)<=Number(p.stock_minimo)).length,
        }}
      >
        {children}
      </AppShell>
    </>
  );
}
// Las pantallas privadas se autorizan con la sesión de cada petición, incluso
// cuando no hay credenciales disponibles durante la compilación local.
export const dynamic = "force-dynamic";
