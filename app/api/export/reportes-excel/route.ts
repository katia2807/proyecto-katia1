import ExcelJS from "exceljs";
import { NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/api-auth";
import {
  getAlquilerRows,
  getCajaRows,
  getClientesRows,
  getCobrosVencidos,
  getComprasMaderaRows,
  getPersonalRows,
  getServiciosAserraderoRows,
  getVentasMuebleTerminadoRows,
  getVentasRows,
} from "@/lib/data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Devuelve un archivo .xlsx multi-hoja con todos los reportes operativos del taller:
 * Caja, Ventas (mueble terminado / madera cortada), Compras de madera, Alquileres,
 * Servicios de aserradero, Sueldos y Cobros vencidos. Una hoja por dataset.
 */
export async function GET() {
  const auth = await requireApiAuth(["owner_admin", "gerencia"]);
  if (auth.response) {
    return auth.response;
  }

  const [
    caja,
    ventasMuebles,
    ventasMadera,
    compras,
    alquileres,
    servicios,
    personal,
    cobros,
    clientes,
  ] = await Promise.all([
    getCajaRows(),
    getVentasMuebleTerminadoRows(),
    getVentasRows(),
    getComprasMaderaRows(),
    getAlquilerRows(),
    getServiciosAserraderoRows(),
    getPersonalRows(),
    getCobrosVencidos(),
    getClientesRows(),
  ]);

  const clienteNombre = (id: string) => clientes.find((c) => c.id === id)?.nombre ?? "—";
  const wb = new ExcelJS.Workbook();
  wb.creator = "Katia ERP";
  wb.created = new Date();

  function addSheet(name: string, columns: { header: string; key: string; width?: number }[], rows: Record<string, unknown>[]) {
    const sheet = wb.addWorksheet(name);
    sheet.columns = columns;
    sheet.addRows(rows);
    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFEFEFEF" },
    };
  }

  addSheet(
    "Caja",
    [
      { header: "Fecha", key: "fecha", width: 12 },
      { header: "Tipo", key: "tipo", width: 12 },
      { header: "Medio", key: "medio", width: 12 },
      { header: "Categoría", key: "categoria", width: 28 },
      { header: "Descripción", key: "descripcion", width: 36 },
      { header: "Personal?", key: "es_personal", width: 10 },
      { header: "Monto", key: "monto", width: 12 },
    ],
    caja.map((r) => ({
      ...r,
      es_personal: r.es_personal ? "Sí" : "No",
      monto: Number(r.monto),
    })),
  );

  addSheet(
    "Ventas muebles",
    [
      { header: "Fecha", key: "fecha", width: 12 },
      { header: "Cliente", key: "cliente", width: 32 },
      { header: "Cantidad", key: "cantidad", width: 10 },
      { header: "Total", key: "total", width: 12 },
      { header: "Modalidad", key: "modalidad_pago", width: 12 },
      { header: "Entrega", key: "estado_entrega", width: 14 },
      { header: "Correlativo", key: "correlativo", width: 14 },
    ],
    ventasMuebles.map((v) => ({
      fecha: v.fecha,
      cliente: clienteNombre(v.cliente_id),
      cantidad: v.cantidad,
      total: Number(v.total),
      modalidad_pago: v.modalidad_pago,
      estado_entrega: v.estado_entrega,
      correlativo: v.correlativo ?? "",
    })),
  );

  addSheet(
    "Ventas madera",
    [
      { header: "Fecha", key: "fecha", width: 12 },
      { header: "Cliente", key: "cliente", width: 32 },
      { header: "Estado", key: "estado", width: 14 },
      { header: "Total", key: "total", width: 12 },
    ],
    ventasMadera.map((v) => ({
      fecha: v.fecha,
      cliente: clienteNombre(v.cliente_id),
      estado: v.estado,
      total: Number(v.total),
    })),
  );

  addSheet(
    "Compras madera",
    [
      { header: "Fecha", key: "fecha", width: 12 },
      { header: "Especie", key: "especie", width: 24 },
      { header: "Cantidad", key: "cantidad", width: 10 },
      { header: "Unidad", key: "unidad", width: 10 },
      { header: "Precio unit.", key: "precio", width: 12 },
      { header: "Total", key: "total", width: 14 },
      { header: "Modalidad", key: "modalidad_pago", width: 12 },
      { header: "Saldo", key: "saldo", width: 12 },
    ],
    compras.map((c) => ({
      fecha: c.fecha,
      especie: c.especie_madera,
      cantidad: Number(c.cantidad),
      unidad: c.unidad,
      precio: Number(c.precio_unitario),
      total: Number(c.total),
      modalidad_pago: c.modalidad_pago,
      saldo: Number(c.saldo_pendiente),
    })),
  );

  addSheet(
    "Alquileres",
    [
      { header: "Código", key: "codigo", width: 16 },
      { header: "Cliente", key: "cliente", width: 32 },
      { header: "Inicio", key: "fecha_inicio", width: 12 },
      { header: "Fin", key: "fecha_fin", width: 12 },
      { header: "Estado", key: "estado", width: 12 },
      { header: "Tarifa", key: "tarifa", width: 12 },
      { header: "Monto total", key: "monto_total", width: 14 },
      { header: "Penalidad", key: "penalidad", width: 12 },
    ],
    alquileres.map((a) => ({
      codigo: a.codigo ?? "",
      cliente: clienteNombre(a.cliente_id),
      fecha_inicio: a.fecha_inicio,
      fecha_fin: a.fecha_fin ?? "",
      estado: a.estado,
      tarifa: Number(a.tarifa),
      monto_total: Number(a.monto_total ?? a.tarifa),
      penalidad: Number(a.penalidad ?? 0),
    })),
  );

  addSheet(
    "Servicios aserradero",
    [
      { header: "Fecha", key: "fecha", width: 12 },
      { header: "Cliente", key: "cliente", width: 32 },
      { header: "Pies cúbicos", key: "pies_cubicos", width: 14 },
      { header: "Costo cubicaje", key: "costo_cubicaje", width: 14 },
      { header: "Cobrado", key: "precio_cobrado", width: 12 },
      { header: "Utilidad", key: "utilidad", width: 12 },
    ],
    servicios.map((s) => ({
      fecha: s.fecha,
      cliente: clienteNombre(s.cliente_id),
      pies_cubicos: Number(s.pies_cubicos),
      costo_cubicaje: Number(s.costo_cubicaje),
      precio_cobrado: Number(s.precio_cobrado),
      utilidad: Number(s.utilidad),
    })),
  );

  addSheet(
    "Sueldos",
    [
      { header: "Periodo", key: "periodo", width: 12 },
      { header: "Empleado", key: "empleado", width: 32 },
      { header: "Bruto", key: "bruto", width: 12 },
      { header: "Adelantos", key: "adelantos", width: 12 },
      { header: "Descuentos", key: "descuentos", width: 12 },
      { header: "Neto", key: "neto", width: 12 },
    ],
    personal.sueldos.map((s) => {
      const emp = personal.empleados.find((e) => e.id === s.empleado_id);
      return {
        periodo: s.periodo,
        empleado: emp?.nombre ?? "—",
        bruto: Number(s.monto_bruto),
        adelantos: Number(s.adelantos_aplicados),
        descuentos: Number(s.descuentos),
        neto: Number(s.monto_neto),
      };
    }),
  );

  addSheet(
    "Cobros vencidos",
    [
      { header: "Origen", key: "origen", width: 22 },
      { header: "Referencia", key: "referencia", width: 16 },
      { header: "Cliente", key: "cliente", width: 32 },
      { header: "Emisión", key: "fecha_emision", width: 12 },
      { header: "Vencimiento", key: "fecha_vencimiento", width: 12 },
      { header: "Monto", key: "monto", width: 12 },
    ],
    cobros.map((c) => ({
      origen: c.origen,
      referencia: c.referencia,
      cliente: clienteNombre(c.cliente_id),
      fecha_emision: c.fecha_emision,
      fecha_vencimiento: c.fecha_vencimiento,
      monto: c.monto,
    })),
  );

  const buffer = await wb.xlsx.writeBuffer();
  const filename = `katia-reportes-${new Date().toISOString().slice(0, 10)}.xlsx`;
  return new NextResponse(buffer as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
