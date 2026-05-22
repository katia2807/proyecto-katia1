import Link from "next/link";
import { eliminarDatosSistema, restaurarRespaldoJSON } from "@/app/actions";
import { ImportExcelPanel } from "@/components/admin/import-excel-panel";
import { RespaldoPeligroCategoriaForms } from "@/components/admin/respaldo-peligro-categoria-forms";
import { RespaldoProduccionResumen } from "@/components/admin/respaldo-produccion-resumen";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { fetchRespaldoSupabaseResumen } from "@/lib/respaldo-supabase-resumen";
import { hasSupabaseEnv } from "@/lib/runtime";
import { getAuthContext } from "@/lib/auth";
import { ResetDatabasePanel } from "@/components/admin/reset-database-panel";

export const dynamic = "force-dynamic";

export default async function RespaldoPage() {
  const prodDb = hasSupabaseEnv();
  const mockData =
    process.env.NEXT_PUBLIC_COMBOBOX_MOCK === "1" || process.env.NEXT_PUBLIC_COMBOBOX_MOCK === "true";

  const context = await getAuthContext();
  const isOwnerAdmin = context?.role === "owner_admin" || context?.uiRole === "owner_admin";

  if (prodDb) {
    const resumen = await fetchRespaldoSupabaseResumen();

    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
          <h2 className="text-2xl font-semibold tracking-tight text-[var(--katia-text-primary)]">Respaldo del sistema</h2>
          <p className="mt-1 text-sm text-[var(--katia-text-secondary)]">
            En producción los datos están en Postgres (Supabase). El resumen es de solo lectura;
            configura backups automáticos desde el panel de Supabase.
          </p>
          </div>
          <Link href="/" className="text-sm font-semibold underline">
            ← Volver al inicio
          </Link>
        </div>

        <RespaldoProduccionResumen resumen={resumen} />

        {/* ── Import desde Excel ── */}
        <ImportExcelPanel />

        {/* ── Export masivo Excel ── */}
        <Card>
          <CardTitle>Exportar datos a Excel</CardTitle>
          <CardDescription className="leading-relaxed">
            Descarga un archivo <strong>.xlsx</strong> con todas las tablas principales en hojas separadas y bien
            ordenadas: Compradores, Choferes, Proveedores, Inventario, Ventas de madera, Ventas de muebles y Personal.
            Cada hoja tiene encabezados claros, filas alternas y totales donde aplica.
          </CardDescription>
          <div className="mt-4 flex flex-wrap gap-3">
            <a
              href="/admin/respaldo/export"
              className="inline-flex items-center gap-2 rounded-[var(--katia-radius-md)] bg-[var(--katia-primary)] px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
              download
            >
              ↓ Descargar respaldo completo (.xlsx)
            </a>
            <a
              href="/inventario/export?type=full"
              className="inline-flex items-center gap-2 rounded-[var(--katia-radius-md)] border border-[var(--katia-border-subtle)] bg-[var(--katia-surface-raised)] px-4 py-2 text-sm font-semibold text-[var(--katia-text-primary)] transition-colors hover:bg-[var(--katia-bg-elevated)]"
              download
            >
              ↓ Solo Inventario + Kardex (.xlsx)
            </a>
          </div>
          <div className="mt-4 rounded-[var(--katia-radius-md)] border border-[var(--katia-border-subtle)] bg-[var(--katia-surface-raised)] px-4 py-3 text-xs text-[var(--katia-text-secondary)]">
            <strong className="text-[var(--katia-text-primary)]">Estructura del archivo:</strong>
            <ul className="mt-2 grid gap-1 sm:grid-cols-2">
              {[
                ["📋 Índice", "Mapa de hojas y conteos"],
                ["👥 Compradores", "Clientes con tipo, estado y contacto"],
                ["🚛 Choferes", "Transportistas con placa y estado"],
                ["🏭 Proveedores", "Razón social, documento, teléfono"],
                ["📦 Inventario", "Stock, costo, valor y alertas"],
                ["💰 Ventas madera", "Correlativo, fecha, total, modalidad"],
                ["🛋️ Ventas muebles", "Correlativo, fecha, total, modalidad"],
                ["👷 Personal", "Colaboradores con cargo e ingreso"],
              ].map(([h, d]) => (
                <li key={h} className="flex gap-1">
                  <span className="font-semibold text-[var(--katia-text-primary)]">{h}:</span> {d}
                </li>
              ))}
            </ul>
          </div>
        </Card>

        <Card>
          <CardTitle>Panel de Supabase</CardTitle>
          <CardDescription className="leading-relaxed">
            Abre{" "}
            <a
              href="https://supabase.com/dashboard"
              className="font-semibold text-[var(--color-accent)] underline"
              target="_blank"
              rel="noreferrer"
            >
              Supabase Dashboard
            </a>
            , elige el proyecto de este host y entra a <strong>Database</strong> → <strong>Backups</strong> para
            retención y copias automáticas según tu plan.
          </CardDescription>
          <p className="mt-3 text-sm text-[var(--color-text-secondary)]">
            La descarga JSON y la restauración desde esta app solo aplican al almacén demo local cuando no hay las tres
            credenciales (URL, anon y service role).
          </p>
        </Card>

        {isOwnerAdmin && <ResetDatabasePanel />}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-[var(--katia-text-primary)]">Respaldo del sistema</h2>
          <p className="mt-1 text-sm text-[var(--katia-text-secondary)]">
            Descarga el estado completo en un único archivo JSON o restaura un respaldo previo.
          </p>
        </div>
        <Link href="/" className="text-sm font-semibold underline">
          ← Volver al inicio
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardTitle>Descargar respaldo</CardTitle>
          <CardDescription>
            Genera un JSON con todas las tablas del store local: caja, clientes, proveedores, cotizaciones, ventas,
            alquileres, órdenes, sueldos y más. Guárdalo en un disco externo o en Drive.
          </CardDescription>
          <div className="mt-3">
            <a href="/api/respaldo/export">
              <Button>Descargar katia-respaldo.json</Button>
            </a>
          </div>
        </Card>

        <Card className="border-[var(--color-danger)]">
          <CardTitle className="text-[var(--color-danger)]">Restaurar respaldo</CardTitle>
          <CardDescription>
            ⚠ Reemplaza <strong>todas las tablas actuales</strong> con el contenido del archivo. Solo owner_admin y
            gerencia. Escribe <code>RESTAURAR</code> para confirmar.
          </CardDescription>
          <form action={restaurarRespaldoJSON} className="mt-3 space-y-3">
            <label className="space-y-1">
              <span className="text-xs font-medium text-[var(--color-text-secondary)]">Archivo JSON</span>
              <input
                type="file"
                name="archivo"
                accept="application/json,.json"
                required
                className="block w-full text-sm text-[var(--color-text-primary)] file:mr-3 file:rounded-lg file:border-0 file:bg-[var(--color-accent)] file:px-3 file:py-2 file:text-xs file:font-semibold file:text-[var(--color-on-accent)]"
              />
            </label>
            <Field
              name="confirmacion"
              label='Confirmación (escribe: RESTAURAR)'
              placeholder="RESTAURAR"
              required
            />
            <Button>Restaurar respaldo</Button>
          </form>
        </Card>
      </div>

      <Card className="border-[var(--color-danger)]">
        <CardTitle className="text-[var(--color-danger)]">Zona peligrosa: eliminar datos</CardTitle>
        <CardDescription>
          ⚠ Esta acción elimina los datos operativos y reinicia el sistema local al estado base. Solo owner_admin y
          gerencia. Para evitar errores, escribe <code>ELIMINAR TODO</code> y luego confirma.
        </CardDescription>
        <form action={eliminarDatosSistema} className="mt-3 space-y-3">
          <Field
            name="confirmacion"
            label='Confirmación (escribe: ELIMINAR TODO)'
            placeholder="ELIMINAR TODO"
            required
          />
          <Field
            name="confirmacion_final"
            label='Confirmación final (vuelve a escribir: ELIMINAR TODO)'
            placeholder="ELIMINAR TODO"
            required
          />
          <Button variant="danger">Eliminar datos del sistema</Button>
        </form>
      </Card>

      <RespaldoPeligroCategoriaForms mockData={mockData} />
    </div>
  );
}
