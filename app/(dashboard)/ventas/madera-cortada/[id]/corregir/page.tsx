import { notFound, redirect } from "next/navigation";
import { CorreccionHistoricaClientWrapper } from "./client-wrapper";
import { getDashboardSession } from "@/lib/current-user-role";
import { getClientesRows, getMaderaCortadaCorrectionContext } from "@/lib/data";
import { canCorrectHistoricalMadera } from "@/lib/permissions";

type Props = { params: Promise<{ id: string }> };

export default async function CorregirMaderaCortadaHistoricaPage({ params }: Props) {
  const session = await getDashboardSession();
  if (!canCorrectHistoricalMadera(session?.role, session?.uiRole)) {
    redirect("/ventas/madera-cortada");
  }

  const { id } = await params;
  const [context, clientes] = await Promise.all([
    getMaderaCortadaCorrectionContext(id),
    getClientesRows(),
  ]);
  if (!context) notFound();

  const venta = context.venta;
  const clienteNombre = clientes.find((cliente) => cliente.id === venta.cliente_id)?.nombre ?? "Cliente no encontrado";

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold">Corrección controlada de boleta</h2>
        <p className="text-sm text-[var(--color-text-secondary)]">
          No es una corrección masiva: cada venta se revisa, compara y confirma por separado.
        </p>
      </div>
      <CorreccionHistoricaClientWrapper
        venta={{
          id: venta.id,
          cliente_id: venta.cliente_id,
          fecha: venta.fecha,
          estado: venta.estado,
          tipo_corte: venta.tipo_corte ?? null,
          total_pt: Number(venta.total_pt ?? 0),
          precio_por_pt: Number(venta.precio_por_pt ?? 0),
          cantidad_piezas: venta.cantidad_piezas == null ? null : Number(venta.cantidad_piezas),
          precio_unitario_comercial:
            venta.precio_unitario_comercial == null ? null : Number(venta.precio_unitario_comercial),
          lineas_comprobante: venta.lineas_comprobante ?? [],
          tipo_comprobante: venta.tipo_comprobante ?? "ninguno",
          total: Number(venta.total),
          modalidad_pago: venta.modalidad_pago ?? null,
        }}
        clienteNombre={clienteNombre}
        activeCashMovements={context.activeCashMovements}
        inventoryMovements={context.inventoryMovements}
      />
    </div>
  );
}
