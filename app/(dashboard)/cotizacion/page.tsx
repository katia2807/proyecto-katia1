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
        <h2 className="text-2xl font-semibold tracking-tight text-[var(--katia-text-primary)]">Nueva venta guiada</h2>
        <p className="mt-1 text-sm text-[var(--katia-text-secondary)]">
          Crea una cotización, imprime el documento y conviértela a venta cuando el cliente acepte.
        </p>
      </div>

      <Card className="border-2 border-[var(--katia-primary)] bg-[var(--katia-primary)]/5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-3xl">
            <div className="inline-flex items-center rounded-full bg-[var(--katia-primary)] px-2.5 py-1 text-xs font-bold text-white">
              Recomendado para encargados
            </div>
            <CardTitle className="mt-3 text-xl">Modo rápido para encargados</CardTitle>
            <CardDescription className="mt-2 text-sm leading-6">
              Usa este flujo si solo necesitas registrar una venta o cotización con los datos básicos. Las opciones avanzadas siguen disponibles en el mismo formulario.
            </CardDescription>
          </div>
          <a
            href="#cotizacion-wizard"
            className="inline-flex h-11 items-center rounded-xl bg-[var(--color-accent)] px-5 text-sm font-bold text-[var(--color-on-accent)] transition hover:brightness-110"
          >
            Empezar rápido
          </a>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-4">
          {[
            "Cliente",
            "Producto o servicio",
            "Total",
            "Guardar / convertir a venta",
          ].map((step, index) => (
            <div key={step} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2">
              <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--color-text-secondary)]">Paso {index + 1}</p>
              <p className="text-sm font-semibold text-[var(--color-text-primary)]">{step}</p>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-[var(--katia-text-secondary)]">
          Modo completo: usa los pasos y secciones avanzadas del formulario cuando necesites medidas, rubros, margen, aserradero o alquiler.
        </p>
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

      <Card>
        <CardTitle>Historial de cotizaciones</CardTitle>
        <CardDescription>
          {cotizacionesGuardadas.length} cotización{cotizacionesGuardadas.length !== 1 ? "es" : ""} registrada{cotizacionesGuardadas.length !== 1 ? "s" : ""}.
          Abre una fila para revisar detalle, estado o convertirla a venta.
        </CardDescription>
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
    </div>
  );
}
