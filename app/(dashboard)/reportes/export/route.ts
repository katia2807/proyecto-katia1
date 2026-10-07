import { NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/api-auth";
import { getReportesData } from "@/lib/reportes-data";
export const dynamic="force-dynamic";
export async function GET(){
  const auth=await requireApiAuth(["owner_admin","gerencia"]);if(auth.response)return auth.response;
  try {
    const {utilidad:rows}=await getReportesData(auth.context.organizationId);
    const header="periodo,ingresos_empresa,egresos_empresa,nomina_registrada_informativa,resultado_caja";
    const body=rows.map(r=>[`${String(r.mes).padStart(2,"0")}/${r.anio}`,r.ingresos,r.egresos,r.sueldos,r.utilidad_neta].join(",")).join("\n");
    return new NextResponse(header+"\n"+body,{headers:{"Content-Type":"text/csv; charset=utf-8","Content-Disposition":'attachment; filename="resultado-caja-mensual.csv"'}});
  } catch {return NextResponse.json({error:"No se pudo consultar todo el historial. No se generó una exportación parcial."},{status:503});}
}
