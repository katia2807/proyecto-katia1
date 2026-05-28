import { CotizacionUnificadaWizard } from "@/components/cotizacion-unificada-wizard";
import { CotizacionMasterDetail } from "@/components/cotizacion-master-detail";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { DEFAULT_EMPRESA_CONFIG, getEmpresaConfig } from "@/lib/company-config";
import {
  getClientesRows,
  getCotizacionesUnificadasRows,
  getInventarioProductosRows,
  getMueblesCatalogoRows,
} from "@/lib/data";
import { getDashboardSession } from "@/lib/current-user-role";
import { previewCorrelativo } from "@/lib/numeracion";
import { canMutateVentas } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export default async function CotizacionPage() {
  const session = await getDashboardSession();
  const role = session?.role ?? null;
  const uiRole = session?.uiRole ?? null;
  const canSave = canMutateVentas(role, uiRole);
  const comboMock =
    process.env.NEXT_PUBLIC_COMBOBOX_MOCK === "1" || process.env.NEXT_PUBLIC_COMBOBOX_MOCK === "true";
  const [productos, mueblesCatalogo, clientes, cotizacionesGuardadas, empresa] = await Promise.all([
    getInventarioProductosRows().catch((error) => {
      console.error("[cotizacion/page] getInventarioProductosRows failed:", error);
      return [];
    }),
    getMueblesCatalogoRows().catch((error) => {
      console.error("[cotizacion/page] getMueblesCatalogoRows failed:", error);
      return [];
    }),
    getClientesRows().catch((error) => {
      console.error("[cotizacion/page] getClientesRows failed:", error);
      return [];
    }),
    getCotizacionesUnificadasRows().catch((error) => {
      console.error("[cotizacion/page] getCotizacionesUnificadasRows failed:", error);
      return [];
    }),
    getEmpresaConfig().catch((error) => {
      console.error("[cotizacion/page] getEmpresaConfig failed:", error);
      return DEFAULT_EMPRESA_CONFIG;
    }),
  ]);
  const correlativoPreview = await previewCorrelativo("cotizacion").catch((error) => {
    console.error("[cotizacion/page] previewCorrelativo failed:", error);
    return "N 0001";
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-[var(--katia-text-primary)]">Cotizaciones</h2>
        <p className="mt-1 text-sm text-[var(--katia-text-secondary)]">
          {cotizacionesGuardadas.length} cotización{cotizacionesGuardadas.length !== 1 ? "es" : ""} registrada{cotizacionesGuardadas.length !== 1 ? "s" : ""}.
          Los documentos generados son internos y privados — sin referencias fiscales.
        </p>
      </div>

      <Card>
        <CardTitle>Cotizaciones guardadas</CardTitle>
        <CardDescription>Haz clic en una fila para abrir detalle, items, cliente, fechas, estado e historial.</CardDescription>
        <div className="mt-3">
          <CotizacionMasterDetail
            canMutate={canSave}
            cotizaciones={cotizacionesGuardadas.map((row) => ({
              id: row.id,
              cliente: clientes.find((cliente) => cliente.id === row.cliente_id)?.nombre ?? "Cliente",
              fecha: row.fecha,
              correlativo: row.correlativo,
              total: Number(row.total),
              estado_flujo: row.estado_flujo,
              tipo_cliente: row.tipo_cliente,
              detalle: row.detalle,
              created_at: row.created_at,
            }))}
          />
        </div>
      </Card>

      <CotizacionUnificadaWizard
        canSave={canSave}
        correlativoPreview={correlativoPreview}
        productos={productos}
        mueblesCatalogo={mueblesCatalogo}
        clientes={clientes}
        cotizacionesGuardadas={cotizacionesGuardadas}
        empresa={empresa}
        mockData={comboMock}
      />
    </div>
  );
}
