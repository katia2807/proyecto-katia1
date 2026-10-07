import { fechaHoyPeru, roundMoney } from "@/lib/utils";
import { cajaCategoriaLabel } from "@/lib/caja-presentacion";
import { getInventarioResumenValores } from "@/lib/inventario-resumen";
import type { GerencialSources } from "@/lib/gerencial-data";

export function calendarDate(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(`${value}T12:00:00Z`)) && new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) === value;
}
export function addCalendarDays(date: string, days: number) {
  if (!calendarDate(date)) throw new Error("Fecha inválida.");
  const d = new Date(`${date}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + days); return d.toISOString().slice(0, 10);
}
export function gerencialPeriods(now = new Date()) {
  const today = fechaHoyPeru(now);
  const start = `${today.slice(0, 7)}-01`;
  const prevEnd = addCalendarDays(start, -1);
  const previousStart = `${prevEnd.slice(0, 7)}-01`;
  const previousEnd = `${prevEnd.slice(0, 8)}${String(Math.min(Number(today.slice(8)), Number(prevEnd.slice(8)))).padStart(2, "0")}`;
  return { today, start, previousStart, previousEnd, recentStart: addCalendarDays(today, -29), nextEnd: addCalendarDays(today, 7) };
}
export function gerencialChange(current: number | null, previous: number | null) {
  if (current === null || previous === null) return "Comparación no disponible";
  if (previous === 0) return current === 0 ? "Sin movimiento en ambos períodos" : "Sin base en el período anterior";
  const pct = (current - previous) / previous * 100;
  return `${pct >= 0 ? "+" : ""}${pct.toFixed(1)}% respecto al período anterior`;
}
export function gerencialAmount(value: unknown): number | null {
  if (value === null || value === undefined || value === "" || (typeof value !== "number" && typeof value !== "string")) return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 && Number.isSafeInteger(Math.round(n * 100)) ? roundMoney(n) : null;
}
const between = (date: string, start: string, end: string) => calendarDate(date) && date >= start && date <= end;
const detail = (type: string, id: string) => `/ventas/detalle/${type}/${encodeURIComponent(id)}`;
export type GerencialItem = { id: string; title: string; subject: string; reason: string; date: string | null; amount: number | null; amountLabel: string; href: string; action: string; priority: "alta" | "media" | "baja" };

export function buildGerencialModel(input: GerencialSources, now = new Date()) {
  const periods = gerencialPeriods(now);
  // Invalid financial rows invalidate their whole source, rather than reduce a total silently.
  const sources = { ...input };
  if (sources.movimientos_caja?.some(r => !calendarDate(r.fecha) || gerencialAmount(r.monto) === null || !["ingreso", "egreso", "transferencia"].includes(r.tipo))) sources.movimientos_caja = null;
  for (const table of ["ventas_madera", "ventas_madera_cortada", "ventas_mueble_terminado", "cotizaciones_unificadas"] as const) {
    if (sources[table]?.some(r => !calendarDate(r.fecha) || gerencialAmount(r.total) === null)) sources[table] = null;
  }
  if (sources.inventario_productos?.some(p => !Number.isFinite(Number(p.stock_actual)) || !Number.isFinite(Number(p.stock_minimo)) || Number(p.stock_minimo) < 0)) sources.inventario_productos = null;
  if (sources.inventario_movimientos?.some(m => !calendarDate(m.fecha) || !Number.isFinite(Number(m.cantidad)) || (m.tipo !== "ajuste" && Number(m.cantidad) < 0) || (m.costo_unitario !== null && gerencialAmount(m.costo_unitario) === null))) sources.inventario_movimientos = null;
  const caja = sources.movimientos_caja?.filter(r => !r.es_personal) ?? null;
  const moneySum = (values: number[]) => roundMoney(values.reduce((sum, n) => sum + n, 0));
  const cashSum = (tipo: string, start: string, end: string) => caja === null ? null : moneySum(caja.filter(r => r.tipo === tipo && between(r.fecha, start, end)).map(r => Number(r.monto)));
  const cash = {
    income: cashSum("ingreso", periods.start, periods.today), expense: cashSum("egreso", periods.start, periods.today),
    previousIncome: cashSum("ingreso", periods.previousStart, periods.previousEnd), previousExpense: cashSum("egreso", periods.previousStart, periods.previousEnd),
    todayIncome: cashSum("ingreso", periods.today, periods.today),
    balance: caja === null ? null : moneySum(caja.filter(r => r.fecha <= periods.today).map(r => r.tipo === "ingreso" ? Number(r.monto) : r.tipo === "egreso" ? -Number(r.monto) : 0)),
    result: caja === null ? null : roundMoney(cashSum("ingreso", periods.start, periods.today)! - cashSum("egreso", periods.start, periods.today)!),
  };
  const names = new Map(sources.clientes?.map(c => [c.id, c.nombre]));
  const client = (id: string | null) => id ? names.get(id) ?? "Cliente sin nombre disponible" : "Sin cliente asociado";
  const stockHistory = sources.inventario_movimientos;
  const products = sources.inventario_productos?.filter(p => p.activo !== false) ?? null;
  const recentSales = new Map<string, number>();
  const costs = new Map<string, { quantity: number; total: number }>();
  if (stockHistory) for (const m of stockHistory) {
    if (!calendarDate(m.fecha) || m.fecha > periods.today || !Number.isFinite(Number(m.cantidad))) continue;
    if (m.tipo === "salida_venta" && between(m.fecha, periods.recentStart, periods.today)) recentSales.set(m.producto_id, (recentSales.get(m.producto_id) ?? 0) + Number(m.cantidad));
    if (m.tipo === "entrada_compra" && Number(m.cantidad) > 0 && gerencialAmount(m.costo_unitario) !== null && Number(m.costo_unitario) > 0) {
      const cost = costs.get(m.producto_id) ?? { quantity: 0, total: 0 }; cost.quantity += Number(m.cantidad); cost.total += Number(m.cantidad) * Number(m.costo_unitario); costs.set(m.producto_id, cost);
    }
  }
  const inventory = products?.map(p => {
    const c = costs.get(p.id); const average = c ? c.total / c.quantity : 0;
    return { ...p, recent: stockHistory === null ? null : recentSales.get(p.id) ?? 0, costo_unitario_promedio: average, valor_stock: roundMoney(Number(p.stock_actual) * average) };
  }) ?? null;
  const stockLow = inventory?.filter(p => Number(p.stock_actual) <= Number(p.stock_minimo)).sort((a, b) => Number(a.stock_actual > 0) - Number(b.stock_actual > 0) || Number((b.recent ?? 0) > 0) - Number((a.recent ?? 0) > 0) || a.nombre.localeCompare(b.nombre)) ?? null;
  const stockValues = inventory && stockHistory ? getInventarioResumenValores(inventory, stockHistory, now) : null;
  const actions: GerencialItem[] = [];
  const upcoming: GerencialItem[] = [];
  const undated: GerencialItem[] = [];
  const payments = new Map<string, number>();
  const aliases: Record<string, string> = { ventas_madera: "venta-madera", ventas_pdf: "venta-madera", ventas_madera_cortada: "madera", ventas_muebles_terminados: "mueble", ventas_alquiler: "alquiler", alquiler: "alquiler", cotizacion_unificada: "cotizacion" };
  if (caja) for (const m of caja) {
    const type = m.modulo_origen ? aliases[m.modulo_origen] : null;
    if (m.tipo === "ingreso" && type && m.referencia_id && m.fecha <= periods.today && m.categoria !== "penalidad_alquiler") {
      const key = `${type}:${m.referencia_id}`; payments.set(key, roundMoney((payments.get(key) ?? 0) + Number(m.monto)));
    }
  }
  function credit(r: { id: string; cliente_id: string; fecha_pago_credito?: string | null; modalidad_pago?: string | null }, type: string, label: string, amount: unknown) {
    if (r.modalidad_pago !== "credito") return;
    const total = gerencialAmount(amount);
    const remaining = total !== null && caja !== null ? roundMoney(Math.max(0, total - (payments.get(`${type}:${r.id}`) ?? 0))) : null;
    if (remaining === 0) return;
    const date = calendarDate(r.fecha_pago_credito) ? r.fecha_pago_credito : null;
    const item: GerencialItem = { id: `credito:${type}:${r.id}`, title: date && date < periods.today ? "Revisar crédito vencido" : "Revisar crédito", subject: `${label} · ${client(r.cliente_id)}`, reason: remaining === null ? "Falta un importe o no se pudo consultar Caja para comprobar el saldo." : "Descontados los ingresos vinculados en Caja. Comprueba pagos sin referencia o fuera de Caja.", date, amount: remaining, amountLabel: "Saldo según Caja vinculada", href: detail(type, r.id), action: "Revisar operación", priority: date && date <= periods.today ? "alta" : "media" };
    if (date === null) undated.push(item);
    else if (date <= periods.today) actions.push(item);
    else if (date <= periods.nextEnd) upcoming.push(item);
  }
  const madera = [...(sources.ventas_madera?.map(v => ({ ...v, tipo: "venta-madera" })) ?? []), ...(sources.ventas_madera_cortada?.map(v => ({ ...v, tipo: "madera" })) ?? [])];
  for (const v of madera) {
    if (v.estado === "borrador") actions.push({ id: `borrador:${v.tipo}:${v.id}`, title: "Revisar venta en borrador", subject: client(v.cliente_id), reason: "La venta todavía no está confirmada y no cuenta en los resultados.", date: calendarDate(v.fecha) ? v.fecha : null, amount: gerencialAmount(v.total), amountLabel: "Importe de la propuesta", href: "/ventas?estado=borrador", action: "Ver borradores", priority: "media" });
    else if (v.estado === "confirmada") credit(v, v.tipo, "Venta de madera", v.total);
  }
  for (const v of sources.ventas_mueble_terminado ?? []) credit(v, "mueble", "Mueble terminado", v.total);
  for (const a of sources.alquileres ?? []) {
    credit(a, "alquiler", a.codigo ?? a.activo, a.monto_total);
    if (a.estado !== "abierto") continue;
    const date = calendarDate(a.fecha_termino) ? a.fecha_termino : null;
    const item: GerencialItem = { id: `alquiler:${a.id}`, title: date && date < periods.today ? "Revisar término de alquiler" : "Término de alquiler", subject: `${a.activo} · ${client(a.cliente_id)}`, reason: date ? "El contrato sigue abierto. Comprueba devolución o continuidad con la fecha pactada." : "Contrato abierto sin fecha de término pactada registrada.", date, amount: gerencialAmount(a.monto_total), amountLabel: "Importe del contrato", href: detail("alquiler", a.id), action: "Revisar contrato", priority: date && date <= periods.today ? "alta" : "media" };
    if (!date) undated.push(item); else if (date <= periods.today) actions.push(item); else if (date <= periods.nextEnd) upcoming.push(item);
  }
  for (const p of stockLow ?? []) actions.push({ id: `stock:${p.id}`, title: Number(p.stock_actual) <= 0 ? "Revisar producto sin stock" : "Revisar reposición", subject: p.nombre, reason: `Stock ${p.stock_actual} / mínimo ${p.stock_minimo} ${p.unidad}. ${p.recent === null ? "Movimiento reciente no disponible." : `${p.recent} ${p.unidad} en salidas por venta de los últimos 30 días.`}`, date: null, amount: null, amountLabel: "", href: `/inventario?tab=alertas&buscar=${encodeURIComponent(p.nombre)}#alertas-stock`, action: "Revisar stock", priority: Number(p.stock_actual) <= 0 ? "alta" : "media" });
  for (const o of sources.ordenes_produccion ?? []) if (o.estado !== "entregado") {
    const href = o.cotizacion_unificada_id ? `/cotizacion?editar=${encodeURIComponent(o.cotizacion_unificada_id)}#cotizacion-wizard` : o.cotizacion_id ? `/ventas/muebles-personalizados/${encodeURIComponent(o.cotizacion_id)}/pdf` : "/ventas/muebles-personalizados";
    const item: GerencialItem = { id: `orden:${o.id}`, title: o.estado === "terminado" ? "Coordinar entrega de pedido terminado" : "Revisar pedido en producción", subject: `${o.correlativo ?? "Pedido"} · ${client(o.cliente_id)}`, reason: "No hay una fecha de entrega pactada disponible. Comprueba el avance con el cliente.", date: null, amount: null, amountLabel: "", href, action: "Revisar pedido", priority: o.estado === "terminado" ? "media" : "baja" };
    undated.push(item); actions.push(item);
  }
  const opportunities = (sources.cotizaciones_unificadas ?? []).filter(c => c.estado_flujo !== "cobrada" && String(c.estado_flujo) !== "inactivo").map(c => ({ id: c.id, subject: client(c.cliente_id), date: c.fecha, amount: gerencialAmount(c.total), state: String(c.estado_flujo), href: `/cotizacion?editar=${encodeURIComponent(c.id)}#cotizacion-wizard` }));
  for (const c of opportunities.filter(c => c.state === "deudor")) actions.push({ id: `mora:${c.id}`, title: "Revisar cotización marcada en mora", subject: c.subject, reason: "El estado registrado es Deudor (Mora); comprueba la situación antes de considerar un cobro.", date: null, amount: c.amount, amountLabel: "Importe de la cotización", href: c.href, action: "Revisar cotización", priority: "alta" });
  const orderItems = (items: GerencialItem[]) => items.sort((a, b) => ({ alta: 0, media: 1, baja: 2 }[a.priority] - { alta: 0, media: 1, baja: 2 }[b.priority]) || (a.date ?? "9999").localeCompare(b.date ?? "9999"));
  orderItems(actions); upcoming.sort((a, b) => a.date!.localeCompare(b.date!) || a.id.localeCompare(b.id)); orderItems(undated);
  const operations = [
    ...madera.filter(v => v.estado === "confirmada").map(v => ({ id: `${v.tipo}:${v.id}`, date: v.fecha, clientId: v.cliente_id, amount: gerencialAmount(v.total) })),
    ...(sources.ventas_mueble_terminado ?? []).map(v => ({ id: `mueble:${v.id}`, date: v.fecha, clientId: v.cliente_id, amount: gerencialAmount(v.total) })),
    ...(sources.cotizaciones_unificadas ?? []).filter(v => v.estado_flujo === "cobrada").map(v => ({ id: `cotizacion:${v.id}`, date: v.fecha, clientId: v.cliente_id, amount: gerencialAmount(v.total) })),
    ...(sources.alquileres ?? []).filter(v => v.estado === "cerrado").map(v => ({ id: `alquiler:${v.id}`, date: v.fecha_inicio, clientId: v.cliente_id, amount: gerencialAmount(v.monto_total) })),
    ...(sources.servicios_aserradero ?? []).map(v => ({ id: `aserradero:${v.id}`, date: v.fecha, clientId: v.cliente_id, amount: gerencialAmount(v.precio_cobrado) })),
  ];
  const operationsReady = [sources.ventas_madera, sources.ventas_madera_cortada, sources.ventas_mueble_terminado, sources.cotizaciones_unificadas, sources.alquileres, sources.servicios_aserradero].every(s => s !== null);
  const currentOperations = operations.filter(o => between(o.date, periods.start, periods.today));
  const previousOperations = operations.filter(o => between(o.date, periods.previousStart, periods.previousEnd));
  const operationsAmount = operationsReady ? moneySum(currentOperations.filter(o => o.amount !== null).map(o => o.amount!)) : null;
  const unknownOperations = currentOperations.filter(o => o.amount === null).length;
  const topMap = new Map<string, { id: string; name: string; amount: number; count: number }>();
  if (operationsReady) for (const o of currentOperations) if (o.clientId && o.amount !== null) {
    const c = topMap.get(o.clientId) ?? { id: o.clientId, name: client(o.clientId), amount: 0, count: 0 }; c.amount = roundMoney(c.amount + o.amount); c.count++; topMap.set(o.clientId, c);
  }
  const categories = new Map<string, { category: string; current: number; previous: number }>();
  if (caja) for (const m of caja.filter(r => r.tipo === "egreso")) {
    const current = between(m.fecha, periods.start, periods.today); const previous = between(m.fecha, periods.previousStart, periods.previousEnd);
    if (!current && !previous) continue;
    const row = categories.get(m.categoria) ?? { category: m.categoria, current: 0, previous: 0 }; if (current) row.current = roundMoney(row.current + Number(m.monto)); else row.previous = roundMoney(row.previous + Number(m.monto)); categories.set(m.categoria, row);
  }
  const expenseCategories = [...categories.values()].sort((a, b) => b.current - a.current || a.category.localeCompare(b.category)).map(c => ({ ...c, label: cajaCategoriaLabel(c.category) }));
  const unitGroups = new Map<string, NonNullable<typeof inventory>>();
  if (inventory && stockHistory) for (const p of inventory.filter(p => (p.recent ?? 0) > 0)) {
    const unit = p.unidad?.trim().toLowerCase() || "Sin unidad"; unitGroups.set(unit, [...(unitGroups.get(unit) ?? []), p]);
  }
  const productGroups = [...unitGroups].sort(([a], [b]) => a.localeCompare(b)).map(([unit, rows]) => ({ unit, rows: rows.sort((a, b) => (b.recent ?? 0) - (a.recent ?? 0)).slice(0, 3) }));
  const cashPoints = caja === null ? [] : Array.from({ length: 30 }, (_, i) => {
    const date = addCalendarDays(periods.recentStart, i);
    return { fecha: date.slice(5), saldo: moneySum(caja.filter(r => r.fecha <= date).map(r => r.tipo === "ingreso" ? Number(r.monto) : r.tipo === "egreso" ? -Number(r.monto) : 0)) };
  });
  return { periods, sources, cash, stockLow, stockValues, inventory, actions, upcoming, undated, opportunities, operationsReady, operationsAmount, unknownOperations, operationsCount: currentOperations.length, previousOperationsAmount: operationsReady ? moneySum(previousOperations.filter(o => o.amount !== null).map(o => o.amount!)) : null, topClients: [...topMap.values()].sort((a, b) => b.amount - a.amount || a.id.localeCompare(b.id)).slice(0, 5), expenseCategories, productGroups, cashPoints };
}
export type GerencialModel = ReturnType<typeof buildGerencialModel>;
