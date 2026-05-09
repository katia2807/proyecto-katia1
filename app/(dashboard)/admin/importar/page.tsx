import Link from "next/link";
import { importarArchivo } from "@/app/actions";
import { voidFormAction } from "@/lib/void-form-action";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { SelectField } from "@/components/ui/field";

export default function ImportarPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">Importar desde Excel / CSV</h2>
          <p className="text-sm text-[var(--color-text-secondary)]">
            Carga masiva de gastos, clientes o proveedores desde archivos del taller.
          </p>
        </div>
        <Link href="/" className="text-sm font-semibold underline">
          ← Volver al inicio
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardTitle>Gastos (caja)</CardTitle>
          <CardDescription>Columnas esperadas:</CardDescription>
          <pre className="mt-2 overflow-x-auto rounded-lg bg-[var(--color-primary-soft)]/30 p-3 text-xs">
{`fecha,categoria,monto,medio,descripcion,es_personal
2026-04-05,servicios_basicos,335,efectivo,Pago de luz,false`}
          </pre>
        </Card>
        <Card>
          <CardTitle>Clientes</CardTitle>
          <CardDescription>Columnas esperadas:</CardDescription>
          <pre className="mt-2 overflow-x-auto rounded-lg bg-[var(--color-primary-soft)]/30 p-3 text-xs">
{`nombre,documento,telefono,ruc,direccion,tipo_persona
Lenin Quispe,12345678,987654321,,Lima Norte,natural`}
          </pre>
        </Card>
        <Card>
          <CardTitle>Proveedores</CardTitle>
          <CardDescription>Columnas esperadas:</CardDescription>
          <pre className="mt-2 overflow-x-auto rounded-lg bg-[var(--color-primary-soft)]/30 p-3 text-xs">
{`nombre,ruc,telefono
BOSCO Madera SAC,20111111111,955555555`}
          </pre>
        </Card>
      </div>

      <Card>
        <CardTitle>Subir archivo</CardTitle>
        <CardDescription>
          Acepta .xlsx (primer hoja) y .csv. Las columnas deben respetar el formato sugerido. Las
          filas duplicadas se procesan tal cual; deduplica primero si es necesario.
        </CardDescription>
        <form action={voidFormAction(importarArchivo)} className="mt-3 grid gap-3 md:grid-cols-2">
          <SelectField name="tipo" label="Tipo de carga" required defaultValue="gastos">
            <option value="gastos">Gastos (caja)</option>
            <option value="clientes">Clientes</option>
            <option value="proveedores">Proveedores</option>
          </SelectField>
          <label className="space-y-1">
            <span className="text-xs font-medium text-[var(--color-text-secondary)]">
              Archivo (.xlsx o .csv)
            </span>
            <input
              type="file"
              name="archivo"
              accept=".xlsx,.csv"
              required
              className="block w-full text-sm text-[var(--color-text-primary)] file:mr-3 file:rounded-lg file:border-0 file:bg-[var(--color-accent)] file:px-3 file:py-2 file:text-xs file:font-semibold file:text-[var(--color-on-accent)]"
            />
          </label>
          <div className="md:col-span-2">
            <Button>Procesar e importar</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
