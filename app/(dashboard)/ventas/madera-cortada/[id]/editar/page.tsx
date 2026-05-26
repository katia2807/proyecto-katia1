import { notFound, redirect } from "next/navigation";
import { getVentaMaderaCortadaById, getClientesRows } from "@/lib/data";
import { getCurrentUserRole } from "@/lib/current-user-role";
import { canMutateVentas } from "@/lib/permissions";
import { EditarVentaMaderaCortadaClientWrapper } from "./client-wrapper";

type EditarVentaMaderaCortadaPageProps = {
  params: Promise<{ id: string }>;
};

export default async function EditarVentaMaderaCortadaPage({
  params,
}: EditarVentaMaderaCortadaPageProps) {
  const { id } = await params;
  const role = await getCurrentUserRole();
  const canMutate = canMutateVentas(role);

  if (!canMutate) {
    redirect("/ventas/madera-cortada");
  }

  const [venta, clientes] = await Promise.all([
    getVentaMaderaCortadaById(id),
    getClientesRows(),
  ]);

  if (!venta) {
    notFound();
  }

  const comboMock =
    process.env.NEXT_PUBLIC_COMBOBOX_MOCK === "1" ||
    process.env.NEXT_PUBLIC_COMBOBOX_MOCK === "true";

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold">Editar Venta de Madera Cortada</h2>
        <p className="text-sm text-[var(--color-text-secondary)]">
          Modifica los parámetros principales de la venta seleccionada.
        </p>
      </div>

      <EditarVentaMaderaCortadaClientWrapper
        venta={venta}
        clientes={clientes}
        mockData={comboMock}
      />
    </div>
  );
}
