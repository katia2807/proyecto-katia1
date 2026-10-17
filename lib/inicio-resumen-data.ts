import { GERENCIAL_TABLES, getGerencialSources, readGerencialTable, type GerencialSources } from "@/lib/gerencial-data";
import { buildGerencialModel, type GerencialItem } from "@/lib/gerencial-model";
import { getAdelantosPendientesRows, getAlertasCriticasRows } from "@/lib/inicio-pendientes";
import { resumirCajaEmpresa } from "@/lib/caja-resumen-data";
import { buildInicioResumen, inicioAccess, inicioRequiredTables } from "@/lib/inicio-resumen-model";
import type { AuthContext } from "@/lib/auth";

export async function getInicioResumenData(context:AuthContext,now=new Date()) {
  const access=inicioAccess(context), requested=inicioRequiredTables(access);
  const loadSources=async():Promise<GerencialSources>=>{
    if(access.analysis) return getGerencialSources("hoy",context.organizationId);
    const sources=Object.fromEntries(GERENCIAL_TABLES.map(table=>[table,null])) as GerencialSources;
    await Promise.all(requested.map(async table=>{
      try {Object.assign(sources,{[table]:await readGerencialTable(table,context.organizationId)});}
      catch { /* Fuente no disponible. */ }
    }));
    return sources;
  };
  const [sources,advances,alerts]=await Promise.all([
    loadSources(),
    access.personal?getAdelantosPendientesRows(context.organizationId).then(rows=>rows.length).catch(()=>null):Promise.resolve(0),
    access.analysis?getAlertasCriticasRows(context.organizationId).then(rows=>rows.map((row):GerencialItem=>({
      id:"alerta:"+row.id,title:"Alerta registrada",subject:row.descripcion,reason:"Revisa esta alerta registrada; no se marca como resuelta al abrir Inicio.",date:null,amount:null,amountLabel:"",href:"/gerencial?tab=hoy",action:"Ver Centro de Mando",priority:"alta",
    }))).catch(()=>null):Promise.resolve([]),
  ]);
  const model=buildGerencialModel(sources,now);
  let cashBalance:number|null=null;
  if(access.cash && model.sources.movimientos_caja!==null) {
    try {cashBalance=resumirCajaEmpresa(model.sources.movimientos_caja).saldo;} catch { /* No inventar un saldo. */ }
  }
  return buildInicioResumen(model,access,{advances,alerts,cashBalance},requested);
}
