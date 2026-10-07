import { getGerencialSources } from "@/lib/gerencial-data";
import { buildGerencialModel } from "@/lib/gerencial-model";
import { readCompleteTable } from "@/lib/complete-data";
import { monthlyCashRows } from "@/lib/reportes-model";

export async function getReportesData(organizationId: string, now = new Date()) {
  const [sources, sueldos, cierres] = await Promise.all([getGerencialSources("hoy", organizationId), readCompleteTable("sueldos", organizationId), readCompleteTable("cierres_mensuales", organizationId)]);
  const model = buildGerencialModel(sources, now);
  if ([model.sources.movimientos_caja, model.sources.clientes, model.sources.ventas_madera, model.sources.ventas_madera_cortada, model.sources.ventas_mueble_terminado, model.sources.alquileres].some(rows => rows === null)) throw new Error("No se pudo consultar toda la información de Caja y créditos. Intenta actualizar el reporte.");
  const caja = model.sources.movimientos_caja!;
  const clientes = model.sources.clientes!;
  const credits = model.actions.filter(item => item.id.startsWith("credito:") && item.date && item.date < model.periods.today);
  const cobros = credits.map(item => {
    const [, type, id] = item.id.split(":");
    const records = type === "madera" ? sources.ventas_madera_cortada : type === "venta-madera" ? sources.ventas_madera : type === "mueble" ? sources.ventas_mueble_terminado : sources.alquileres;
    const record = records?.find(r => r.id === id);
    const emitted = record && ("fecha" in record ? record.fecha : record.fecha_inicio);
    return { id, origen: type, cliente_id: record?.cliente_id ?? "", fecha_emision: emitted ?? "", fecha_vencimiento: item.date!, monto: item.amount, referencia: id.slice(0, 8), href: item.href, descripcion: item.reason };
  });
  return { caja: [...caja].sort((a, b) => b.fecha.localeCompare(a.fecha)), clientes, utilidad: monthlyCashRows(caja, sueldos), cierres: cierres.sort((a, b) => b.anio - a.anio || b.mes - a.mes), cobros, model };
}
