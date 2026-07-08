import Link from "next/link";
import { AserraderoContextPanels } from "@/components/ventas/aserradero-context-panels";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { AserraderoServiciosTable } from "@/components/sales/aserradero-servicios-table";
import { getCurrentUserRole } from "@/lib/current-user-role";
import {
  getClientesRows,
  getServiciosAserraderoRows,
  getServiciosEspecialesTarifaRows,
} from "@/lib/data";
import { canMutateVentas } from "@/lib/permissions";
import { formatPen } from "@/lib/utils";
import { getEmpresaConfig } from "@/lib/company-config";

export default async function AserraderoServiciosPage() {
  const comboMock =
    process.env.NEXT_PUBLIC_COMBOBOX_MOCK === "1" || process.env.NEXT_PUBLIC_COMBOBOX_MOCK === "true";
  const [clientes, servicios, tarifas, empresa] = await Promise.all([
    getClientesRows(),
    getServiciosAserraderoRows(),
    getServiciosEspecialesTarifaRows(),
    getEmpresaConfig(),
  ]);
  const role = await getCurrentUserRole();
  const canMutate = canMutateVentas(role);

  const totalIngresos = servicios.reduce((acc, s) => acc + Number(s.precio_cobrado), 0);
  const totalUtilidad = servicios.reduce((acc, s) => acc + Number(s.utilidad), 0);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold">Servicio aserradero</h2>
        <p className="text-sm text-[var(--color-text-secondary)]">
          Cubicaje rápido y servicios especiales para madera.
        </p>
      </div>

      <Card className="flex flex-wrap items-center justify-between gap-4 border-[var(--color-primary)]/20 bg-[var(--color-primary)]/5">
        <div className="space-y-2">
          <CardTitle>Registrar servicio de aserradero</CardTitle>
          <CardDescription>
            Registra un servicio usando los datos de cubicaje y tarifas ya configuradas.
          </CardDescription>
          <div className="flex flex-wrap gap-2 text-xs text-[var(--color-text-secondary)]">
            <Badge variant="neutral">{servicios.length} servicios registrados</Badge>
          </div>
        </div>
        {canMutate ? (
          <AserraderoContextPanels
            clientes={clientes}
            serviciosEspeciales={tarifas}
            margenGananciaDefaultPct={empresa.margen_ganancia_default_pct}
            mockData={comboMock}
          />
        ) : (
          <p className="rounded-xl border border-amber-500/20 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-500/30 dark:bg-amber-950/20 dark:text-amber-300">
            Tu rol es de solo lectura.
          </p>
        )}
      </Card>

      <Card>
        <CardTitle>Servicios registrados</CardTitle>
        <CardDescription>Historial de servicios de aserradero registrados.</CardDescription>
        <div className="mt-3">
          <AserraderoServiciosTable
            servicios={servicios}
            clientesById={Object.fromEntries(clientes.map((c) => [c.id, c.nombre]))}
            clientesMap={Object.fromEntries(clientes.map((c) => [c.id, c]))}
            canMutate={canMutate}
          />
        </div>
      </Card>

      <Card>
        <CardTitle>Resumen de apoyo</CardTitle>
        <CardDescription>Consulta estos datos como referencia del módulo.</CardDescription>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <div className="rounded-xl border border-[var(--color-border)] p-3">
            <p className="text-xs uppercase text-[var(--color-text-secondary)]">Servicios totales</p>
            <p className="text-2xl font-bold">{servicios.length}</p>
          </div>
          <div className="rounded-xl border border-[var(--color-border)] p-3">
            <p className="text-xs uppercase text-[var(--color-text-secondary)]">Ingresos acumulados</p>
            <p className="text-2xl font-bold">{formatPen(totalIngresos)}</p>
          </div>
          <div className="rounded-xl border border-[var(--color-border)] p-3">
            <p className="text-xs uppercase text-[var(--color-text-secondary)]">Utilidad acumulada</p>
            <p className="text-2xl font-bold">{formatPen(totalUtilidad)}</p>
          </div>
        </div>
      </Card>

      <div className="text-center py-4">
        <p className="text-xs text-[var(--color-text-secondary)]">
          Las tarifas de servicios especiales se configuran en{" "}
          <Link href="/configuracion?tab=tarifas" className="font-semibold text-[var(--color-accent)] underline hover:brightness-110">
            Configuración &gt; Tarifas
          </Link>
        </p>
      </div>
    </div>
  );
}
