import { NextResponse } from "next/server";
import { requireAuthContext } from "@/lib/auth";
import { getInventarioRobustoData } from "@/lib/data";

function csvEscape(value: string | number | null | undefined) {
  if (value === null || value === undefined) return "";
  const text = String(value);
  if (text.includes(",") || text.includes('"') || text.includes("\n")) {
    return `"${text.replaceAll('"', '""')}"`;
  }
  return text;
}

export async function GET(request: Request) {
  await requireAuthContext({ redirectTo: null });
  const url = new URL(request.url);
  const type = url.searchParams.get("type") ?? "kardex";
  const data = await getInventarioRobustoData();

  if (type === "stock") {
    const header = [
      "codigo",
      "nombre",
      "categoria",
      "activo",
      "stock_actual",
      "stock_minimo",
      "costo_unitario_promedio",
      "valor_stock",
      "dias_sin_movimiento",
      "vendido",
      "ajustes",
    ].join(",");
    const body = data.productos
      .map((p) =>
        [
          p.codigo,
          p.nombre,
          p.categoria,
          p.activo ? "si" : "no",
          p.stock_actual,
          p.stock_minimo,
          p.costo_unitario_promedio,
          p.valor_stock,
          p.dias_sin_movimiento ?? "",
          p.vendido,
          p.ajustes,
        ]
          .map(csvEscape)
          .join(","),
      )
      .join("\n");
    return new NextResponse(`${header}\n${body}`, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="inventario-stock.csv"',
      },
    });
  }

  const header = [
    "fecha",
    "producto_codigo",
    "producto_nombre",
    "categoria",
    "tipo",
    "cantidad",
    "impacto",
    "costo_unitario",
    "referencia",
  ].join(",");
  const body = data.kardex
    .map((row) =>
      [
        row.fecha,
        row.producto_codigo,
        row.producto_nombre,
        row.categoria,
        row.tipo,
        row.cantidad,
        row.impacto,
        row.costo_unitario ?? "",
        row.referencia ?? "",
      ]
        .map(csvEscape)
        .join(","),
    )
    .join("\n");
  return new NextResponse(`${header}\n${body}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="inventario-kardex.csv"',
    },
  });
}
