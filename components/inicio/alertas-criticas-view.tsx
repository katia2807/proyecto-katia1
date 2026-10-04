import { FiltroActivo } from "@/components/inicio/filtro-activo";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { getAlertasCriticasRows } from "@/lib/inicio-pendientes";

export async function AlertasCriticasView() {
  const alertas = await getAlertasCriticasRows();
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-semibold tracking-tight text-[var(--katia-text-primary)]">Centro de Mando</h2>
      <FiltroActivo label="Alertas críticas activas" total={alertas.length} clearHref="/gerencial" clearLabel="Ver todo el Centro de Mando" />
      <Card>
        <CardTitle>Alertas críticas activas</CardTitle>
        <CardDescription>Alertas de prioridad alta que todavía no se han resuelto.</CardDescription>
        <ul className="mt-4 space-y-3">
          {alertas.map((row) => (
            <li key={row.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--katia-border-subtle)] p-4">
              <p className="text-sm text-[var(--katia-text-primary)]">{row.descripcion}</p>
              <Badge variant="warning">{row.estado === "nueva" ? "Nueva" : "Revisada; pendiente de resolver"}</Badge>
            </li>
          ))}
        </ul>
        {alertas.length === 0 ? <p className="mt-4 text-sm text-[var(--katia-text-secondary)]">No hay alertas críticas activas.</p> : null}
      </Card>
    </div>
  );
}
