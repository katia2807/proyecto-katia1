import type { RespaldoSupabaseResumen } from "@/lib/respaldo-supabase-resumen";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";

function formatConsultaLima(iso: string) {
  try {
    return new Intl.DateTimeFormat("es-PE", {
      dateStyle: "short",
      timeStyle: "short",
      timeZone: "America/Lima",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function RespaldoProduccionResumen({ resumen }: { resumen: RespaldoSupabaseResumen }) {
  const orgLine =
    resumen.organizationNamesSample.length === 0
      ? null
      : resumen.organizationNamesSample.length === 1
        ? resumen.organizationNamesSample[0]
        : `${resumen.organizationNamesSample.slice(0, 3).join(", ")}${
            resumen.organizationNamesSample.length > 3 ? "…" : ""
          }`;

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <CardTitle>Base de datos en uso</CardTitle>
          <CardDescription>
            Vista de solo lectura para confirmar que la app apunta al proyecto correcto. Los respaldos los gestiona
            Supabase.
          </CardDescription>
        </div>
        <div
          className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold ${
            resumen.connectionOk
              ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-200"
              : "border-red-500/50 bg-red-500/10 text-red-200"
          }`}
        >
          {resumen.connectionOk ? "Lectura verificada" : "Sin lectura"}
        </div>
      </div>

      <p className="mt-2 text-xs text-[var(--color-text-secondary)]">
        Consultado: {formatConsultaLima(resumen.fetchedAtIso)} (Lima)
      </p>

      {!resumen.connectionOk && resumen.connectionError ? (
        <p className="mt-3 text-sm text-red-200/90">{resumen.connectionError}</p>
      ) : null}

      <div className="mt-4 space-y-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-elevated)]/60 p-3 text-sm">
        <div className="flex flex-wrap gap-x-6 gap-y-1">
          <span className="text-[var(--color-text-secondary)]">Proyecto</span>
          <code className="font-mono text-[var(--color-text-primary)]">{resumen.projectHost}</code>
        </div>
        {orgLine ? (
          <div className="flex flex-wrap gap-x-6 gap-y-1">
            <span className="text-[var(--color-text-secondary)]">Organización</span>
            <span className="text-[var(--color-text-primary)]">{orgLine}</span>
          </div>
        ) : null}
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {resumen.tables.map((row) => (
          <div
            key={row.table}
            className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-3 py-2"
          >
            <p className="text-xs text-[var(--color-text-secondary)]">{row.label}</p>
            {row.error ? (
              <p className="mt-0.5 text-sm text-red-200/85">{row.error}</p>
            ) : (
              <p className="text-lg font-semibold tabular-nums text-[var(--color-text-primary)]">{row.count}</p>
            )}
          </div>
        ))}
      </div>

      <div className="mt-5 border-l-4 border-[var(--color-accent)] bg-[var(--color-surface-elevated)]/40 px-3 py-2.5 text-sm text-[var(--color-text-secondary)]">
        <strong className="text-[var(--color-text-primary)]">Dónde cambiar respaldos reales:</strong> en el panel de
        Supabase, ruta <strong className="text-[var(--color-text-primary)]">Database → Backups</strong> (retención y
        programación según tu plan). Esta pantalla no modifica la base; solo muestra señales de conexión y volumen
        aproximado.
      </div>
    </Card>
  );
}
