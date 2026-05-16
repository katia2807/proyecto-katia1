import Link from "next/link";
import { eliminarDatosSistema, restaurarRespaldoJSON } from "@/app/actions";
import { RespaldoPeligroCategoriaForms } from "@/components/admin/respaldo-peligro-categoria-forms";
import { RespaldoProduccionResumen } from "@/components/admin/respaldo-produccion-resumen";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { fetchRespaldoSupabaseResumen } from "@/lib/respaldo-supabase-resumen";
import { hasSupabaseEnv } from "@/lib/runtime";

export const dynamic = "force-dynamic";

export default async function RespaldoPage() {
  const prodDb = hasSupabaseEnv();
  const mockData =
    process.env.NEXT_PUBLIC_COMBOBOX_MOCK === "1" || process.env.NEXT_PUBLIC_COMBOBOX_MOCK === "true";

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

        <Card className="border-[var(--katia-danger)]/50">
          <CardTitle className="text-[var(--katia-danger)]">Resetear datos para entrega limpia</CardTitle>
          <CardDescription className="leading-relaxed">
            Borra todos los datos operativos (ventas, caja, inventario, clientes, cotizaciones) de esta organización
            y deja el sistema limpio para entregarlo al cliente. <strong>No borra</strong> usuarios, configuración de empresa
            ni estructura de base de datos.
          </CardDescription>
          <details className="mt-4">
            <summary className="cursor-pointer text-sm font-semibold text-[var(--katia-danger)]">
              Abrir opciones de reset (solo owner_admin)
            </summary>
            <div className="mt-4 space-y-4">
              <div className="rounded-[var(--katia-radius-md)] border border-[var(--katia-danger)]/30 bg-[var(--katia-danger)]/5 px-4 py-3 text-sm text-[var(--katia-danger)]">
                ⚠ Esta acción es irreversible. Asegúrate de tener un respaldo antes de continuar.
              </div>
              <p className="text-xs text-[var(--katia-text-secondary)]">
                Usa las RPC <code>reset_datos_operativos</code> y <code>seed_datos_bienvenida</code> desde el panel de
                Supabase o desde la API de administración de tu proyecto para ejecutar el reset controlado.
                La migración <code>20260520_001_reset_entrega_limpia.sql</code> ya las tiene definidas.
              </p>
            </div>
          </details>
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
