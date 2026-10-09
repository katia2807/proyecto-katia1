import ExcelJS from "exceljs";
import { NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/api-auth";
import { getReportesData } from "@/lib/reportes-data";
import { buildReportesResumen, normalizeReportesResumen, reportesResumenAlcance, reportesResumenCsv, reportesResumenError } from "@/lib/reportes-resumen";
import { cajaCategoriaLabel, cajaTipoLabel, cajaMedioLabel, cajaOrigenLabel } from "@/lib/caja-presentacion";
import { fechaHoyPeru } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireApiAuth(["owner_admin", "gerencia"]);
  if (auth.response) return auth.response;
  const params = new URL(request.url).searchParams;
  const formato = params.get("formato") ?? "excel";
  if (!["excel", "csv"].includes(formato)) return NextResponse.json({error:"Formato no válido."},{status:400});
  const filtros = normalizeReportesResumen(Object.fromEntries(params));
  const error = reportesResumenError(filtros);
  if (error) return NextResponse.json({error},{status:400});
  try {
    const data = await getReportesData(auth.context.organizationId);
    const resumen = buildReportesResumen(data.caja, filtros);
    const headers = { "Content-Disposition": `attachment; filename="katia-caja-seleccion-${fechaHoyPeru()}.${formato === "csv" ? "csv" : "xlsx"}"`, "Cache-Control": "no-store" };
    if (formato === "csv") return new NextResponse(reportesResumenCsv(resumen),{headers:{...headers,"Content-Type":"text/csv; charset=utf-8"}});
    const wb = new ExcelJS.Workbook();
    wb.creator = "Katia Suite";
    const summary = wb.addWorksheet("Resumen por categoría");
    summary.addRow(["Resumen de movimientos de Caja"]);
    summary.addRow([reportesResumenAlcance(filtros)]);
    summary.addRow(["Ingresos",resumen.ingresos,"Gastos",resumen.gastos,"Resultado",resumen.resultado]);
    summary.addRow(["Ingresos menos gastos. Transferencias excluidas; no representa utilidad contable."]);
    summary.addRow(["Categoría","Ámbito","Movimientos","Ingresos","Gastos","Resultado"]);
    resumen.categorias.forEach(r=>summary.addRow([cajaCategoriaLabel(r.categoria),r.esPersonal?"Personal":"Empresa",r.movimientos,r.ingresos,r.gastos,r.resultado]));
    const detail = wb.addWorksheet("Movimientos seleccionados");
    detail.addRow(["Fecha","Tipo","Categoría","Ámbito","Medio","Monto","Origen","Descripción"]);
    resumen.movimientos.forEach(r=>detail.addRow([r.fecha,cajaTipoLabel(r.tipo),cajaCategoriaLabel(r.categoria),r.es_personal?"Personal":"Empresa",cajaMedioLabel(r.medio),Number(r.monto),cajaOrigenLabel(r.modulo_origen),r.descripcion??""]));
    for (const [sheet,headerRow] of [[summary,5],[detail,1]] as const) {
      sheet.views = [{state:"frozen",ySplit:headerRow}];
      sheet.autoFilter = {from:{row:headerRow,column:1},to:{row:headerRow,column:sheet.columnCount}};
      sheet.columns.forEach((column,index)=>{column.width=index===0||index===2||index===7?36:20;});
      sheet.getRow(headerRow).eachCell(cell=>{cell.font={bold:true,color:{argb:"FFFFFFFF"}};cell.fill={type:"pattern",pattern:"solid",fgColor:{argb:"FF202124"}};});
    }
    for (let row=6;row<=summary.rowCount;row++) for (const col of [4,5,6]) summary.getRow(row).getCell(col).numFmt='"S/ "#,##0.00';
    for (let row=2;row<=detail.rowCount;row++) detail.getRow(row).getCell(6).numFmt='"S/ "#,##0.00';
    const buffer = await wb.xlsx.writeBuffer();
    return new NextResponse(buffer as unknown as BodyInit,{headers:{...headers,"Content-Type":"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"}});
  } catch {
    return NextResponse.json({error:"No se pudo generar la selección completa. Reintenta; no se entregó un archivo parcial."},{status:503});
  }
}
