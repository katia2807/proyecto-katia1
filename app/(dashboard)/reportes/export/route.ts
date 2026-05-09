import { NextResponse } from "next/server";
import { requireAuthContext } from "@/lib/auth";
import { getUtilidadRows } from "@/lib/data";

export async function GET() {
  await requireAuthContext({ redirectTo: null });
  const rows = await getUtilidadRows();
  const header = "periodo,ingresos,egresos,sueldos,utilidad_neta";
  const body = rows
    .map((row) =>
      [
        `${String(row.mes).padStart(2, "0")}/${row.anio}`,
        row.ingresos,
        row.egresos,
        row.sueldos,
        row.utilidad_neta,
      ].join(","),
    )
    .join("\n");

  return new NextResponse(`${header}\n${body}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="utilidad-mensual.csv"',
    },
  });
}
