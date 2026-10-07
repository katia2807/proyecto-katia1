import { roundMoney } from "@/lib/utils";

type Cash = { organization_id: string; fecha: string; tipo: string; monto: number; es_personal?: boolean; deleted_at?: string | null; voided_at?: string | null };
type Wage = { organization_id: string; periodo: string; monto_neto: number };
export function monthlyCashRows(caja: Cash[], sueldos: Wage[]) {
  const grouped = new Map<string, { organization_id: string; anio: number; mes: number; ingresos: number; egresos: number; sueldos: number; utilidad_neta: number }>();
  function row(org: string, period: string) {
    const key = `${org}:${period}`;
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) throw new Error("Hay un período inválido en el historial. Revisa el registro antes de calcular el reporte.");
    if (!grouped.has(key)) grouped.set(key, { organization_id: org, anio: Number(period.slice(0, 4)), mes: Number(period.slice(5)), ingresos: 0, egresos: 0, sueldos: 0, utilidad_neta: 0 });
    return grouped.get(key)!;
  }
  for (const cash of caja) {
    if (cash.es_personal || cash.deleted_at || cash.voided_at || cash.tipo === "transferencia") continue;
    if (!Number.isFinite(Number(cash.monto)) || Number(cash.monto) < 0) throw new Error("Hay un monto inválido en Caja. No se puede calcular el reporte.");
    const current = row(cash.organization_id, cash.fecha.slice(0, 7));
    if (cash.tipo === "ingreso") current.ingresos = roundMoney(current.ingresos + Number(cash.monto));
    if (cash.tipo === "egreso") current.egresos = roundMoney(current.egresos + Number(cash.monto));
  }
  for (const wage of sueldos) {
    if (!Number.isFinite(Number(wage.monto_neto))) throw new Error("Hay un sueldo inválido en el historial.");
    const current = row(wage.organization_id, wage.periodo);
    current.sueldos = roundMoney(current.sueldos + Number(wage.monto_neto));
  }
  // Nómina informativa: los egresos de Caja ya incluyen los pagos registrados.
  return [...grouped.values()].map(r => ({ ...r, utilidad_neta: roundMoney(r.ingresos - r.egresos) })).sort((a, b) => b.anio - a.anio || b.mes - a.mes);
}
