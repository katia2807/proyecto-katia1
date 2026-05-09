import { toggleSecurityControl } from "@/app/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { MODULO_PROXIMA_ACTUALIZACION_MSG } from "@/lib/constants";
import { getSecurityControlRows } from "@/lib/data";
import { hasSupabaseEnv } from "@/lib/runtime";
import { privacyPolicy } from "@/lib/security";

export default async function SeguridadPage() {
  const controls = await getSecurityControlRows();
  const completed = controls.filter((x) => x.completed).length;
  const supabase = hasSupabaseEnv();
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold">Privacidad y seguridad</h2>
        <p className="text-sm text-[var(--color-text-secondary)]">
          Controles obligatorios para datos sensibles y operación transparente.
        </p>
        <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
          Controles cumplidos: {completed}/{controls.length}
        </p>
      </div>

      <Card>
        <CardTitle>Clasificación de datos</CardTitle>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm">
          {privacyPolicy.dataClassification.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </Card>

      <Card>
        <CardTitle>Controles activos (funcional)</CardTitle>
        <CardDescription>Aplicados en BD, aplicación y operación.</CardDescription>
        {supabase ? (
          <div className="mt-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-2)] p-4">
            <p className="text-sm text-[var(--color-text-primary)]">{MODULO_PROXIMA_ACTUALIZACION_MSG}</p>
          </div>
        ) : (
          <>
            {controls.length === 0 ? (
              <div className="mt-4 rounded-2xl border border-[var(--color-warning-border)] bg-[var(--color-warning-soft)] p-4">
                <p className="text-sm font-semibold text-[var(--color-warning-strong)]">
                  Controles sin ítems en el entorno local.
                </p>
                <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                  Antes de producción confirma: RLS activo, roles reales asignados, auth local desactivado, backups
                  probados, claves rotadas y acceso al servidor restringido por HTTPS.
                </p>
              </div>
            ) : null}
            <div className="mt-3 space-y-3">
              {controls.map((item) => (
                <div
                  key={item.id}
                  className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-medium">{item.title}</p>
                    <Badge variant={item.completed ? "success" : "warning"}>
                      {item.completed ? "Activo" : "Pendiente"}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-[var(--color-text-secondary)]">Responsable: {item.owner}</p>
                  <form action={toggleSecurityControl} className="mt-2">
                    <input type="hidden" name="id" value={item.id} />
                    <Button type="submit" variant={item.completed ? "danger" : "primary"}>
                      {item.completed ? "Marcar pendiente" : "Marcar activo"}
                    </Button>
                  </form>
                </div>
              ))}
            </div>
          </>
        )}
      </Card>

      <Card>
        <CardTitle>Política de backup</CardTitle>
        <p className="mt-2 text-sm">
          Frecuencia: <strong>{privacyPolicy.backupPolicy.frequency}</strong>
        </p>
        <p className="text-sm">
          Retención: <strong>{privacyPolicy.backupPolicy.retention}</strong>
        </p>
        <p className="text-sm">
          Prueba de restauración: <strong>{privacyPolicy.backupPolicy.restoreDrill}</strong>
        </p>
      </Card>
    </div>
  );
}

