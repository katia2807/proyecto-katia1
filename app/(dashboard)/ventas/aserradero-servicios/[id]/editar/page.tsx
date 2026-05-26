import { notFound, redirect } from "next/navigation";
import { getServicioAserraderoById, getClientesRows } from "@/lib/data";
import { getCurrentUserRole } from "@/lib/current-user-role";
import { canMutateVentas } from "@/lib/permissions";
import { EditarServicioClientWrapper } from "./client-wrapper";

type EditarServicioPageProps = {
  params: Promise<{ id: string }>;
};

export default async function EditarServicioPage({ params }: EditarServicioPageProps) {
  const { id } = await params;
  const role = await getCurrentUserRole();
  const canMutate = canMutateVentas(role);

  if (!canMutate) {
    redirect("/ventas/aserradero-servicios");
  }

  const [servicio, clientes] = await Promise.all([
    getServicioAserraderoById(id),
    getClientesRows(),
  ]);

  if (!servicio) {
    notFound();
  }

  const comboMock =
    process.env.NEXT_PUBLIC_COMBOBOX_MOCK === "1" || process.env.NEXT_PUBLIC_COMBOBOX_MOCK === "true";

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold">Editar Servicio de Aserradero</h2>
        <p className="text-sm text-[var(--color-text-secondary)]">
          Modifica los parámetros principales del servicio seleccionado.
        </p>
      </div>

      <EditarServicioClientWrapper
        servicio={servicio}
        clientes={clientes}
        mockData={comboMock}
      />
    </div>
  );
}
