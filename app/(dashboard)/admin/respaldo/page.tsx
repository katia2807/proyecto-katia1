import Link from "next/link";
import { eliminarDatosSistema, restaurarRespaldoJSON } from "@/app/actions";
import { RespaldoPeligroCategoriaForms } from "@/components/admin/respaldo-peligro-categoria-forms";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Field } from "@/components/ui/field";

export default function RespaldoPage() {
  const comboMock =
    process.env.NEXT_PUBLIC_COMBOBOX_MOCK === "1" || process.env.NEXT_PUBLIC_COMBOBOX_MOCK === "true";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">Respaldo del sistema</h2>
          <p className="text-sm text-[var(--color-text-secondary)]">
            Descarga el estado completo del taller en un único archivo JSON o restaura un respaldo
            previo.
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
            Genera un JSON con todas las tablas del store local: caja, clientes, proveedores,
            cotizaciones, ventas, alquileres, órdenes, sueldos y más. Guárdalo en un disco externo o
            en Drive.
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
            ⚠ Reemplaza <strong>todas las tablas actuales</strong> con el contenido del archivo. Solo
            owner_admin y gerencia. Escribe <code>RESTAURAR</code> para confirmar.
          </CardDescription>
          <form action={restaurarRespaldoJSON} className="mt-3 space-y-3">
            <label className="space-y-1">
              <span className="text-xs font-medium text-[var(--color-text-secondary)]">
                Archivo JSON
              </span>
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
          ⚠ Esta acción elimina los datos operativos y reinicia el sistema local al estado base. Solo
          owner_admin y gerencia. Para evitar errores, escribe <code>ELIMINAR TODO</code> y luego confirma.
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

      <RespaldoPeligroCategoriaForms comboMock={comboMock} />
    </div>
  );
}
