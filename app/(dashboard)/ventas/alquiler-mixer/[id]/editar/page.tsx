import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getAlquilerById, getClientesRows, getInventarioProductosRows } from "@/lib/data";
import { requireAuthContext } from "@/lib/auth";
import { canMutateVentas } from "@/lib/permissions";
import { safeHistorialHref, withHistorialReturn } from "@/lib/ventas-historial-navigation";
import { EditarContratoClientWrapper } from "./client-wrapper";

type EditarContratoPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ desde?: string; volver?: string | string[] }>;
};

export default async function EditarContratoPage({ params, searchParams }: EditarContratoPageProps) {
  const { id } = await params;
  const context = await requireAuthContext();
  const query = await searchParams;
  const completarDatos = query.desde === "detalle";
  const detalleHref = withHistorialReturn(`/ventas/detalle/alquiler/${id}`, safeHistorialHref(query.volver));
  const canMutate = canMutateVentas(context.role, context.uiRole);

  if (!canMutate) {
    redirect(completarDatos ? detalleHref : "/ventas/alquiler-mixer");
  }

  const [contrato, clientes, inventarioProductos] = await Promise.all([
    getAlquilerById(id, context.organizationId),
    getClientesRows(),
    getInventarioProductosRows(true),
  ]);

  if (!contrato || contrato.organization_id !== context.organizationId) {
    notFound();
  }
  if (contrato.estado === "cerrado") redirect(detalleHref);

  const comboMock =
    process.env.NEXT_PUBLIC_COMBOBOX_MOCK === "1" || process.env.NEXT_PUBLIC_COMBOBOX_MOCK === "true";

  const maquinasFiltradas = inventarioProductos
    .filter((p) => p.activo && p.categoria && p.categoria.toLowerCase().replace("á", "a").includes("maquina"))
    .map((p) => ({
      id: p.id,
      nombre: p.nombre,
      categoria: p.categoria,
    }));

  const maquinas = maquinasFiltradas.length > 0 ? maquinasFiltradas : [
    { id: "bomba-mixer-default", nombre: "Bomba Mixer Standard", categoria: "Maquina" },
  ];

  return (
    <div className="space-y-6">
      {completarDatos ? (
        <Link href={detalleHref} className="inline-flex items-center gap-2 text-sm font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-primary)]">
          <ArrowLeft className="size-4" aria-hidden="true" /> Volver al detalle
        </Link>
      ) : null}
      <div>
        <h2 className="text-xl font-bold">{completarDatos ? "Completar datos del alquiler" : "Editar Contrato de Alquiler"}</h2>
        <p className="text-sm text-[var(--color-text-secondary)]">
          {completarDatos ? "Completa la tarifa y la cantidad. Revisa el total antes de guardar." : "Modifica los parámetros del contrato seleccionado."}
        </p>
      </div>

      <EditarContratoClientWrapper
        contrato={contrato}
        clientes={clientes}
        maquinas={maquinas}
        mockData={comboMock}
        completarDatos={completarDatos}
        detalleHref={detalleHref}
      />
    </div>
  );
}
