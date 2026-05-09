import { CotizacionUnificadaWizard } from "@/components/cotizacion-unificada-wizard";
import { getClientesRows, getCotizacionesUnificadasRows, getInventarioProductosRows } from "@/lib/data";
import { getCurrentUserRole } from "@/lib/current-user-role";
import { previewCorrelativo } from "@/lib/numeracion";
import { canMutateVentas } from "@/lib/permissions";

export default async function CotizacionPage() {
  const role = await getCurrentUserRole();
  const canSave = canMutateVentas(role);
  const [productos, clientes, cotizacionesGuardadas] = await Promise.all([
    getInventarioProductosRows(),
    getClientesRows(),
    getCotizacionesUnificadasRows(),
  ]);
  const correlativoPreview = await previewCorrelativo("cotizacion");

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold">Cotización</h2>
        <p className="text-sm text-[var(--color-text-secondary)]">
          Asistente por pasos: tipo de cliente, datos, rubros (muebles, aserradero, alquiler), resumen y guardado en
          base de datos. Podés volver atrás en cualquier momento.
        </p>
      </div>
      <CotizacionUnificadaWizard
        canSave={canSave}
        correlativoPreview={correlativoPreview}
        productos={productos}
        clientes={clientes}
        cotizacionesGuardadas={cotizacionesGuardadas}
      />
    </div>
  );
}
