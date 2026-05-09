import { saveGoLiveEvidence, toggleGoLiveItem } from "@/app/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { MODULO_PROXIMA_ACTUALIZACION_MSG } from "@/lib/constants";
import { getGoLiveChecklistRows } from "@/lib/data";
import { hasSupabaseEnv } from "@/lib/runtime";

export default async function ChecklistPage() {
  const checklist = await getGoLiveChecklistRows();
  const completed = checklist.filter((x) => x.completed).length;
  const progress = checklist.length === 0 ? 0 : Math.round((completed / checklist.length) * 100);
  const supabase = hasSupabaseEnv();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold">Checklist de salida comercial</h2>
        <p className="text-sm text-[var(--color-text-secondary)]">
          Preparación final para vender y operar el ERP en condiciones reales.
        </p>
        <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
          Avance actual: {completed}/{checklist.length} ({progress}%)
        </p>
      </div>

      <Card>
        <CardTitle>Go-live comercial</CardTitle>
        <CardDescription>
          Este checklist reduce retrabajo y asegura calidad técnica, visual y de operación.
        </CardDescription>
        {supabase ? (
          <div className="mt-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-2)] p-4">
            <p className="text-sm text-[var(--color-text-primary)]">{MODULO_PROXIMA_ACTUALIZACION_MSG}</p>
          </div>
        ) : (
          <>
            {checklist.length === 0 ? (
              <div className="mt-4 rounded-2xl border border-[var(--color-warning-border)] bg-[var(--color-warning-soft)] p-4">
                <p className="text-sm font-semibold text-[var(--color-warning-strong)]">
                  Checklist sin ítems en el entorno local.
                </p>
                <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                  Para una entrega 24/7, valida manualmente: variables productivas, migraciones aplicadas, usuario inicial,
                  backups diarios, restauración de prueba, smoke test staging y canal de soporte.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <a href="/admin/respaldo">
                    <Button type="button" variant="secondary">
                      Ver respaldo
                    </Button>
                  </a>
                  <a href="/seguridad">
                    <Button type="button">Ver seguridad</Button>
                  </a>
                </div>
              </div>
            ) : null}
            <div className="mt-4 space-y-3">
              {checklist.map((item) => (
                <div
                  key={item.id}
                  className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-medium text-[var(--color-text-primary)]">{item.title}</p>
                    <Badge variant={item.completed ? "success" : "warning"}>
                      {item.completed ? "Cumplido" : "Pendiente"}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-[var(--color-text-secondary)]">Responsable: {item.owner}</p>
                  <form action={saveGoLiveEvidence} className="mt-3 flex flex-wrap items-center gap-2">
                    <input type="hidden" name="id" value={item.id} />
                    <input
                      name="evidence"
                      defaultValue={item.evidence}
                      placeholder="Agregar evidencia o nota..."
                      className="h-10 min-w-[260px] flex-1 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 text-sm text-[var(--color-text-primary)] outline-none placeholder:text-[var(--color-text-secondary)]/70 focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
                    />
                    <Button type="submit" variant="secondary">
                      Guardar nota
                    </Button>
                  </form>
                  <form action={toggleGoLiveItem} className="mt-2">
                    <input type="hidden" name="id" value={item.id} />
                    <Button type="submit" variant={item.completed ? "danger" : "primary"}>
                      {item.completed ? "Marcar pendiente" : "Marcar cumplido"}
                    </Button>
                  </form>
                </div>
              ))}
            </div>
          </>
        )}
      </Card>
    </div>
  );
}

