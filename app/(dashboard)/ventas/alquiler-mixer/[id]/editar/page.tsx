import { notFound, redirect } from "next/navigation";
import { getAlquilerById, getClientesRows, getInventarioProductosRows } from "@/lib/data";
import { getCurrentUserRole } from "@/lib/current-user-role";
import { canMutateVentas } from "@/lib/permissions";
import { EditarContratoClientWrapper } from "./client-wrapper";

type EditarContratoPageProps = {
  params: Promise<{ id: string }>;
};

export default async function EditarContratoPage({ params }: EditarContratoPageProps) {
  const { id } = await params;
  const role = await getCurrentUserRole();
  const canMutate = canMutateVentas(role);

  if (!canMutate) {
    redirect("/ventas/alquiler-mixer");
  }

  const [contrato, clientes, inventarioProductos] = await Promise.all([
    getAlquilerById(id),
    getClientesRows(),
    getInventarioProductosRows(true),
  ]);

  if (!contrato) {
    notFound();
  }

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
      <div>
        <h2 className="text-xl font-bold">Editar Contrato de Alquiler</h2>
        <p className="text-sm text-[var(--color-text-secondary)]">
          Modifica los parámetros del contrato seleccionado.
        </p>
      </div>

      <EditarContratoClientWrapper
        contrato={contrato}
        clientes={clientes}
        maquinas={maquinas}
        mockData={comboMock}
      />
    </div>
  );
}
