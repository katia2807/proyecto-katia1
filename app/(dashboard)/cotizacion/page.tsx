import { CotizacionUnificadaWizard } from "@/components/cotizacion-unificada-wizard";
import { CotizacionMasterDetail } from "@/components/cotizacion-master-detail";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { DEFAULT_EMPRESA_CONFIG, getEmpresaConfig } from "@/lib/company-config";
import {
  getClientesRows,
  getCotizacionesUnificadasHistorial,
  getCotizacionUnificadaById,
  COTIZACIONES_HISTORIAL_LIMITE,
  getInventarioProductosRows,
  getMueblesCatalogoRows,
} from "@/lib/data";
import { getDashboardSession } from "@/lib/current-user-role";
import { previewCorrelativo } from "@/lib/numeracion";
import { canMutateVentas } from "@/lib/permissions";
import { z } from "zod";

export const dynamic = "force-dynamic";

type CotizacionPageProps = {
  searchParams?: Promise<{ modo?: string | string[]; editar?: string | string[]; cotizacion?: string | string[] }>;
};

function normalizeModoParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

export default async function CotizacionPage({ searchParams }: CotizacionPageProps) {
  const params = await searchParams;
  const modo = normalizeModoParam(params?.modo);
  const seleccionId = normalizeModoParam(params?.editar) || normalizeModoParam(params?.cotizacion);
  const modoGuiado = modo === "guiado";
  const session = await getDashboardSession();
  const role = session?.role ?? null;
  const uiRole = session?.uiRole ?? null;
  const canSave = canMutateVentas(role, uiRole);
  const comboMock =
    process.env.NEXT_PUBLIC_COMBOBOX_MOCK === "1" || process.env.NEXT_PUBLIC_COMBOBOX_MOCK === "true";
  const [productos, mueblesCatalogo, clientes, historial, empresa] = await Promise.all([
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
    getCotizacionesUnificadasHistorial(),
    getEmpresaConfig().catch((error) => {
      console.error("[cotizacion/page] getEmpresaConfig failed:", error);
      return DEFAULT_EMPRESA_CONFIG;
    }),
  ]);
  const cotizacionesGuardadas = [...historial.rows];
  let seleccionError: string | null = null;
  if (seleccionId && !cotizacionesGuardadas.some((row) => row.id === seleccionId)) {
    if (!z.string().uuid().safeParse(seleccionId).success) {
      seleccionError = "El enlace de la cotización no es válido. Vuelve al historial y selecciona una cotización.";
    } else {
      try {
        const seleccionada = await getCotizacionUnificadaById(seleccionId, { throwOnError: true });
        if (seleccionada) cotizacionesGuardadas.unshift(seleccionada);
        else seleccionError = "No se encontró la cotización solicitada. Puede haber sido eliminada o no estar disponible.";
      } catch {
        seleccionError = "No se pudo cargar la cotización solicitada. Recarga la página antes de intentar editarla.";
      }
    }
  }
  const correlativoPreview = await previewCorrelativo("cotizacion").catch((error) => {
    console.error("[cotizacion/page] previewCorrelativo failed:", error);
    return "N 0001";
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-[var(--katia-text-primary)]">{modoGuiado ? "Cotización guiada" : "Nueva cotización"}</h2>
        <p className="mt-1 text-sm text-[var(--katia-text-secondary)]">
          {modoGuiado
            ? "Prepara la cotización paso a paso. Después de la aceptación del cliente, podrás convertirla en venta y registrar el cobro."
            : "Crea una cotización, imprímela y conviértela en venta con registro del cobro cuando el cliente la acepte."}
        </p>
      </div>

      <Card className="border-2 border-[var(--katia-primary)] bg-[var(--katia-primary)]/5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-3xl">
            <div className="inline-flex items-center rounded-full bg-[var(--katia-primary)] px-2.5 py-1 text-xs font-bold text-white">
              Recomendado para encargados
            </div>
            <CardTitle className="mt-3 text-xl">Cotiza en cuatro pasos</CardTitle>
            <CardDescription className="mt-2 text-sm leading-6">
              {modoGuiado
                ? "Elige el cliente y lo que necesita, revisa el total y guarda la cotización para presentársela."
                : "Prepara una cotización con los datos básicos. Puedes añadir medidas y condiciones en las opciones avanzadas."}
            </CardDescription>
          </div>
          <a
            href="#cotizacion-cliente"
            className="inline-flex h-11 items-center rounded-xl bg-[var(--color-accent)] px-5 text-sm font-bold text-[var(--color-on-accent)] transition hover:brightness-110"
          >
            Empezar cotización
          </a>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-4">
          {[
            "Cliente",
            "Producto o servicio",
            "Total",
            "Revisar y guardar",
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

      {seleccionError ? (
        <div role="alert" className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
          <p>{seleccionError}</p>
          <a href="/cotizacion#historial-cotizaciones" className="mt-2 inline-block font-semibold text-[var(--color-accent)]">Volver al historial</a>
        </div>
      ) : <CotizacionUnificadaWizard
        canSave={canSave}
        correlativoPreview={correlativoPreview}
        productos={productos}
        mueblesCatalogo={mueblesCatalogo}
        clientes={clientes}
        cotizacionesGuardadas={cotizacionesGuardadas}
        empresa={empresa}
        mockData={comboMock}
        historialLoadWarning={historial.loadWarning}
      />}

      <Card id="historial-cotizaciones">
        <CardTitle>Historial de cotizaciones</CardTitle>
        <CardDescription>
          {historial.loadWarning ? "Historial temporalmente no disponible."
            : historial.totalCount === null ? `Se muestran ${cotizacionesGuardadas.length} cotizaciones; el historial carga hasta ${COTIZACIONES_HISTORIAL_LIMITE} recientes.`
              : historial.totalCount > cotizacionesGuardadas.length ? `Mostrando ${cotizacionesGuardadas.length} de ${historial.totalCount} cotizaciones. El historial carga las ${COTIZACIONES_HISTORIAL_LIMITE} más recientes; la abierta por enlace también se incluye.`
                : `${cotizacionesGuardadas.length} ${cotizacionesGuardadas.length === 1 ? "cotización registrada" : "cotizaciones registradas"}.`}
          {!historial.loadWarning && " Abre una fila para revisar detalle, estado o convertirla a venta."}
        </CardDescription>
        {historial.loadWarning && <p role="alert" className="mt-3 text-sm text-[var(--color-text-secondary)]">{historial.loadWarning}</p>}
        <div className="mt-3">
          {(!historial.loadWarning || cotizacionesGuardadas.length > 0) && <CotizacionMasterDetail
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
          />}
        </div>
      </Card>
    </div>
  );
}
