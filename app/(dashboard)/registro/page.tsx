import Link from "next/link";
import { RegistroNuevoContextPanel } from "@/components/registro/registro-nuevo-context-panel";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Table, TD, TH, THead, TRow } from "@/components/ui/table";
import { getRegistrosGeneralesRows } from "@/lib/data";
import { formatDate, formatPen } from "@/lib/utils";
import { requirePageAccess } from "@/lib/auth";
import { canMutateRegistro } from "@/lib/permissions";
import { readCompleteTable } from "@/lib/complete-data";

type RegistroPageProps = {
  searchParams?: Promise<{ quick?: string | string[]; categoria?: string | string[] }>;
};

function firstParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

export default async function RegistroPage({ searchParams }: RegistroPageProps) {
  const context = await requirePageAccess("/registro");
  const comboMock =
    process.env.NEXT_PUBLIC_COMBOBOX_MOCK === "1" || process.env.NEXT_PUBLIC_COMBOBOX_MOCK === "true";
  const params = await searchParams;
  const quick = firstParam(params?.quick);
  const categoriaId = firstParam(params?.categoria);

  const categorias = (await readCompleteTable("registro_categorias", context.organizationId)).filter(c => c.activo);
  const categoriasById = new Map(categorias.map((categoria) => [categoria.id, categoria]));
  const registros = await getRegistrosGeneralesRows(categoriaId || undefined, context.organizationId);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold">Bitacora</h2>
        <p className="text-sm text-[var(--color-text-secondary)]">
          Anota eventos, gastos, notas e incidencias del dia.
        </p>
      </div>

      <Card className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <CardTitle>Agregar registro</CardTitle>
          <CardDescription>Se guarda en el historial de esta misma pantalla.</CardDescription>
        </div>
        {canMutateRegistro(context.role, context.uiRole) ? <RegistroNuevoContextPanel
          key={categoriaId || "all"}
          categorias={categorias.map((c) => ({ id: c.id, nombre: c.nombre }))}
          defaultCategoriaId={categoriaId || ""}
          openByDefault={quick === "nuevo-registro"}
          mockData={comboMock}
        /> : <p className="text-sm text-[var(--color-text-secondary)]">Tu acceso a este apartado es de lectura.</p>}
      </Card>

      <Card>
        <CardTitle>Enfoque por categoría</CardTitle>
        <CardDescription>Selecciona un foco sin abrir menús largos.</CardDescription>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link href="/registro">
            <Button type="button" variant={!categoriaId ? "primary" : "secondary"}>
              Todo
            </Button>
          </Link>
          {categorias.map((categoria) => (
            <Link key={categoria.id} href={`/registro?categoria=${categoria.id}`}>
              <Button type="button" variant={categoria.id === categoriaId ? "primary" : "secondary"}>
                {categoria.nombre}
              </Button>
            </Link>
          ))}
        </div>
      </Card>

      <Card>
        <CardTitle>Historial registrado</CardTitle>
        <CardDescription>
          {categoriaId
            ? `Mostrando categoría: ${categoriasById.get(categoriaId)?.nombre ?? "Seleccionada"}`
            : "Mostrando todas las categorías"}
        </CardDescription>
        <div role="region" aria-label="Historial desplazable" tabIndex={0} className="mt-4 overflow-x-auto rounded-xl border border-[var(--color-border)]">
          <Table>
            <THead>
              <TRow>
                <TH>Fecha</TH>
                <TH>Categoría</TH>
                <TH>Registro</TH>
                <TH>Detalle</TH>
                <TH className="text-right">Monto</TH>
              </TRow>
            </THead>
            <tbody>
              {registros.length === 0 ? <TRow><TD colSpan={5} className="py-6 text-center">No hay registros para esta categoría.</TD></TRow> : null}
              {registros.map((registro) => (
                <TRow key={registro.id}>
                  <TD>{formatDate(registro.fecha)}</TD>
                  <TD>{categoriasById.get(registro.categoria_id)?.nombre ?? "Categoría"}</TD>
                  <TD className="font-semibold">{registro.titulo}</TD>
                  <TD>{registro.detalle ?? "-"}</TD>
                  <TD className="text-right">
                    {registro.monto !== null && registro.monto !== undefined ? formatPen(Number(registro.monto)) : "-"}
                  </TD>
                </TRow>
              ))}
            </tbody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
