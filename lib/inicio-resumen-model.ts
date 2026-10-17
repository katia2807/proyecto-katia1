import { canAccessPath } from "@/lib/permissions";
import { calendarDate, type GerencialItem, type GerencialModel } from "@/lib/gerencial-model";
import { sumMoney } from "@/lib/money";
import type { AuthContext } from "@/lib/auth";
import { GERENCIAL_TABLES, type GerencialTable } from "@/lib/gerencial-tables";

export function inicioAccess(context: Pick<AuthContext, "role" | "uiRole">) {
  const can = (path: string) => canAccessPath(context.role, context.uiRole, path);
  return { analysis: can("/gerencial"), cash: can("/caja"), inventory: can("/inventario"), sales: can("/ventas"), quotes: can("/cotizacion"), rentals: can("/ventas/alquiler-mixer"), personal: can("/personal") };
}
export type InicioAccess = ReturnType<typeof inicioAccess>;
export type InicioExtra = { advances: number | null; alerts: GerencialItem[] | null; cashBalance: number | null };
export type InicioTopic = { id:string; title:string; tag:string; tone:"danger"|"warning"; items:GerencialItem[]; href:string; action:string; amount:number|null };
const creditTables: GerencialTable[] = ["movimientos_caja","ventas_madera","ventas_madera_cortada","ventas_mueble_terminado","alquileres","servicios_aserradero"];
export function inicioRequiredTables(access: InicioAccess): GerencialTable[] {
  if (access.analysis) return [...GERENCIAL_TABLES];
  const tables = new Set<GerencialTable>();
  if(access.cash) tables.add("movimientos_caja");
  if(access.inventory) { tables.add("inventario_productos"); tables.add("inventario_movimientos"); }
  if(access.sales) { tables.add("ventas_madera"); tables.add("ventas_madera_cortada"); }
  if(access.rentals) tables.add("alquileres");
  if(access.quotes) { tables.add("cotizaciones_unificadas"); tables.add("ordenes_produccion"); }
  if(access.sales || access.rentals || access.quotes) tables.add("clientes");
  return [...tables];
}
/** Solo proyecta criterios existentes; no modifica operaciones. */
export function buildInicioResumen(model: GerencialModel, access: InicioAccess, extra: InicioExtra, requested=inicioRequiredTables(access)) {
  const today=model.periods.today;
  const unavailable=requested.filter(table=>model.sources[table]===null);
  const extraUnavailable=[...(access.personal && extra.advances===null?["Adelantos"]:[]),...(access.analysis && extra.alerts===null?["Alertas registradas"]:[])];
  const canItem=(item:GerencialItem)=>{
    if(item.id.startsWith("credito:")||item.id.startsWith("mora:")) return access.analysis;
    if(item.id.startsWith("stock:")) return access.inventory;
    if(item.id.startsWith("alquiler:")) return access.rentals;
    if(item.id.startsWith("borrador:")) return access.sales;
    if(item.id.startsWith("orden:")) return access.quotes;
    return access.analysis;
  };
  const items=[...new Map([...model.actions,...model.upcoming,...model.undated,...(access.analysis?model.credits:[]),...(access.analysis?extra.alerts??[]:[])].filter(canItem).map(item=>[item.id,item])).values()];
  const primary:InicioTopic[]=[];
  const add=(id:string,title:string,tag:string,rows:GerencialItem[],href:string,action:string)=>{
    if(rows.length) primary.push({id,title,tag,tone:rows.some(row=>row.date && row.date<today)?"danger":"warning",items:rows,href,action,amount:id==="cobros" && rows.every(row=>row.amount!==null)?sumMoney(rows.map(row=>row.amount!)):null});
  };
  const due=(prefix:string)=>items.filter(item=>item.id.startsWith(prefix) && item.date!==null && item.date<=today);
  add("cobros","Cobros que requieren atención","Cobros",due("credito:"),"/gerencial?tab=hoy","Revisar cobros");
  add("alquileres","Alquileres por revisar","Alquileres",due("alquiler:"),"/ventas/alquiler-mixer","Revisar alquileres");
  add("stock","Productos por reponer","Existencias",items.filter(item=>item.id.startsWith("stock:")),"/inventario?tab=alertas#alertas-stock","Revisar existencias");
  add("alertas","Alertas registradas","Prioridad alta",items.filter(item=>item.id.startsWith("alerta:")),"/gerencial?tab=hoy","Revisar alertas");
  add("mora","Cotizaciones marcadas en mora por comprobar","Por comprobar",items.filter(item=>item.id.startsWith("mora:")),"/cotizacion","Revisar cotizaciones");
  const urgency=(topic:InicioTopic)=>topic.items.some(item=>item.date && item.date<today)?0:topic.items.some(item=>item.date===today)?1:topic.items.some(item=>item.priority==="alta")?2:3;
  primary.sort((a,b)=>urgency(a)-urgency(b)||(a.items.find(item=>item.date)?.date??"9999").localeCompare(b.items.find(item=>item.date)?.date??"9999"));
  const featuredTopics=primary.slice(0,3);
  const featured=new Set(featuredTopics.flatMap(topic=>topic.items.map(item=>item.id)));
  const remaining=items.filter(item=>!featured.has(item.id));
  const other:InicioTopic[]=[];
  const group=(id:string,title:string,rows:GerencialItem[],href:string,action="Revisar")=>{
    if(rows.length) other.push({id,title,tag:"",tone:"warning",items:rows,href,action,amount:null});
  };
  group("creditos","Créditos en plazo o sin fecha por confirmar",remaining.filter(item=>item.id.startsWith("credito:")),"/gerencial?tab=hoy");
  group("contratos","Próximos alquileres y fechas por confirmar",remaining.filter(item=>item.id.startsWith("alquiler:")),"/ventas/alquiler-mixer");
  group("borradores","Ventas sin confirmar",remaining.filter(item=>item.id.startsWith("borrador:")),"/ventas?estado=borrador");
  group("produccion","Pedidos en producción o por entregar",remaining.filter(item=>item.id.startsWith("orden:")),"/ventas/muebles-personalizados");
  group("mora","Cotizaciones marcadas en mora por comprobar",remaining.filter(item=>item.id.startsWith("mora:")),"/cotizacion");
  if(access.rentals && model.sources.alquileres) group("penalidades","Penalidades activas",model.sources.alquileres.filter(row=>row.estado!=="cerrado" && Number(row.penalidad)>0).map(row=>({
    id:"penalidad:"+row.id,title:"Revisar penalidad",subject:row.codigo??row.activo,reason:"Penalidad registrada; comprueba su situación en el contrato.",date:null,amount:null,amountLabel:"",href:"/ventas/detalle/alquiler/"+encodeURIComponent(row.id),action:"Revisar contrato",priority:"media" as const,
  })),"/ventas/alquiler-mixer?penalidades=activas#contratos-registrados");
  group("stock","Productos por reponer",remaining.filter(item=>item.id.startsWith("stock:")),"/inventario?tab=alertas#alertas-stock");
  group("alertas","Alertas registradas",remaining.filter(item=>item.id.startsWith("alerta:")),"/gerencial?tab=hoy");
  // "Activo" conserva el estado abierto del módulo de contratos, incluso si ya venció.
  const openRentals=access.rentals?model.sources.alquileres?.filter(row=>row.estado==="abierto"):undefined;
  const rentals=openRentals?{
    active:openRentals.length,
    endingSoon:openRentals.filter(row=>calendarDate(row.fecha_termino) && row.fecha_termino>today && row.fecha_termino<=model.periods.nextEnd).length,
    undated:openRentals.filter(row=>!calendarDate(row.fecha_termino)).length,
  }:null;
  const cashBalance=access.cash?extra.cashBalance:null;
  const creditsReady=access.analysis && creditTables.every(table=>model.sources[table]!==null) && model.credits.every(item=>item.amount!==null);
  if(access.analysis && !creditsReady && unavailable.length===0) extraUnavailable.push("Saldos de crédito");
  const total=(select:(item:GerencialItem)=>boolean)=>creditsReady?sumMoney(model.credits.filter(select).map(item=>item.amount!)):null;
  const complete=unavailable.length===0 && extraUnavailable.length===0 && (!access.cash || cashBalance!==null);
  const hasPriorityAccess=access.analysis||access.inventory||access.sales||access.rentals||access.quotes||access.personal;
  return {today,monthStart:model.periods.start,access,primary:featuredTopics,other,advances:access.personal?extra.advances:null,unavailable,extraUnavailable,complete,hasPriorityAccess,cashBalance,rentals,
    cashIncome:access.cash?model.cash.income:null,cashExpense:access.cash?model.cash.expense:null,cashResult:access.cash?model.cash.result:null,
    creditTotal:total(()=>true),overdue:total(item=>item.date!==null && item.date<today),inTime:total(item=>item.date!==null && item.date>=today),undated:total(item=>item.date===null),
    unverifiedQuotes:access.analysis?model.opportunities.filter(item=>item.state==="deudor").length:0,
    otherUrgent:other.reduce((total,topic)=>total+topic.items.filter(item=>item.priority==="alta").length,0),
    emptyVerified:hasPriorityAccess && complete && primary.length===0 && other.length===0 && (!access.personal || extra.advances===0)};
}
export type InicioResumen=ReturnType<typeof buildInicioResumen>;
