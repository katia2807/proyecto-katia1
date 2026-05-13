import { CotizacionUnificadaWizard } from "@/components/cotizacion-unificada-wizard";
import { getEmpresaConfig } from "@/lib/company-config";
import {
  getClientesRows,
  getCotizacionesUnificadasRows,
  getInventarioProductosRows,
  getMueblesCatalogoRows,
} from "@/lib/data";
import { getCurrentUserRole } from "@/lib/current-user-role";
import { previewCorrelativo } from "@/lib/numeracion";
import { canMutateVentas } from "@/lib/permissions";

export default async function CotizacionPage() {
  const role = await getCurrentUserRole();
  const canSave = canMutateVentas(role);
  const comboMock =
    process.env.NEXT_PUBLIC_COMBOBOX_MOCK === "1" || process.env.NEXT_PUBLIC_COMBOBOX_MOCK === "true";
  const [productos, mueblesCatalogo, clientes, cotizacionesGuardadas, empresa] = await Promise.all([
    getInventarioProductosRows(),
    getMueblesCatalogoRows(),
    getClientesRows(),
    getCotizacionesUnificadasRows(),
    getEmpresaConfig(),
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
        mueblesCatalogo={mueblesCatalogo}
        clientes={clientes}
        cotizacionesGuardadas={cotizacionesGuardadas}
        empresa={empresa}
        mockData={comboMock}
      />
    </div>
  );
}
