import { beforeEach, describe, expect, test, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
const mocks=vi.hoisted(()=>({sources:vi.fn(),read:vi.fn(),advances:vi.fn(),alerts:vi.fn(),auth:vi.fn()}));
vi.mock("@/lib/gerencial-data",async()=>{
 const {GERENCIAL_TABLES,GERENCIAL_LABELS}=await import("@/lib/gerencial-tables");
 return {GERENCIAL_TABLES,GERENCIAL_LABELS,getGerencialSources:mocks.sources,readGerencialTable:mocks.read};
});
vi.mock("@/lib/inicio-pendientes",()=>({getAdelantosPendientesRows:mocks.advances,getAlertasCriticasRows:mocks.alerts}));
vi.mock("@/lib/auth",()=>({requireAuthContext:mocks.auth}));
vi.mock("@/lib/supabase/server",()=>({getSupabaseServerClient:vi.fn(()=>{throw Error("Red no permitida");})}));
vi.mock("@/lib/runtime",()=>({hasSupabaseEnv:()=>false}));
vi.mock("@/lib/store-persistence",()=>({readStoreFromDisk:()=>null,writeStoreToDisk:vi.fn()}));
vi.mock("next/navigation",()=>({useRouter:()=>({refresh:vi.fn()})}));
import { GERENCIAL_TABLES } from "@/lib/gerencial-tables";
import type { GerencialSources } from "@/lib/gerencial-data";
import type { AuthContext } from "@/lib/auth";
import { buildGerencialModel } from "@/lib/gerencial-model";
import { inicioAccess,inicioRequiredTables,buildInicioResumen } from "@/lib/inicio-resumen-model";
import { getInicioResumenData } from "@/lib/inicio-resumen-data";
import { resumirCajaEmpresa } from "@/lib/caja-resumen-data";
import { InicioResumenView } from "@/components/inicio/inicio-resumen";
import DashboardPage from "@/app/(dashboard)/page";
const now=new Date("2026-10-16T16:00:00Z");
const owner:AuthContext={userId:"persona",organizationId:"org-local",role:"owner_admin",uiRole:"owner_admin",fullName:"Prueba",email:null};
const base=(id:string,extra:Record<string,unknown>={})=>({id,organization_id:owner.organizationId,cliente_id:"cliente",nombre:"Cliente",fecha:"2026-10-15",total:100,...extra});
const move=(id:string,extra:Record<string,unknown>={})=>base(id,{tipo:"ingreso",monto:100,es_personal:false,modulo_origen:null,referencia_id:null,...extra});
function empty(extra:Record<string,unknown>={}) {return {...Object.fromEntries(GERENCIAL_TABLES.map(t=>[t,[]])),...extra} as GerencialSources;}
let source:GerencialSources;
beforeEach(()=>{
 vi.clearAllMocks();source=empty({clientes:[base("cliente")]});
 mocks.sources.mockImplementation(async()=>structuredClone(source));
 mocks.read.mockImplementation(async(table:keyof GerencialSources)=>{if(source[table]===null)throw Error("Fuente fallida");return structuredClone(source[table]);});
 mocks.advances.mockResolvedValue([]);mocks.alerts.mockResolvedValue([]);mocks.auth.mockResolvedValue(owner);
});
function build(data=source,context=owner) {
 const model=buildGerencialModel(data,now),access=inicioAccess(context);
 const balance=model.sources.movimientos_caja===null?null:resumirCajaEmpresa(model.sources.movimientos_caja).saldo;
 return buildInicioResumen(model,access,{advances:0,alerts:[],cashBalance:balance});
}
const html=(data:ReturnType<typeof build>)=>renderToStaticMarkup(createElement(InicioResumenView,{data}));
describe("Inicio conectado: cifras y prioridades",()=>{
 test("conserva el saldo de Caja y sustituye solo la tarjeta mensual por alquileres",()=>{
   source.movimientos_caja=[move("antiguo",{fecha:"2020-01-01"}),move("actual",{monto:30}),move("salida",{tipo:"egreso",monto:10}),move("futuro",{fecha:"2026-10-20",monto:5}),move("personal",{es_personal:true,monto:900})] as never;
   const d=build();expect(d.cashBalance).toBe(125);expect(d.cashResult).toBe(20);expect(d.cashIncome).toBe(30);expect(d.cashExpense).toBe(10);
   expect(html(d)).toContain("Historial completo");expect(html(d)).toContain("Resumen del negocio");expect(html(d)).toContain("Ver contratos");expect(html(d)).not.toContain("Diferencia del mes");
 });
 test("contratos abiertos y próximos siete días son contadores distintos sin duplicar cerrados",()=>{
   source.alquileres=[
     base("vencido",{estado:"abierto",fecha_termino:"2026-10-15"}),
     base("hoy",{estado:"abierto",fecha_termino:"2026-10-16"}),
     base("manana",{estado:"abierto",fecha_termino:"2026-10-17"}),
     base("limite",{estado:"abierto",fecha_termino:"2026-10-23"}),
     base("lejano",{estado:"abierto",fecha_termino:"2026-10-24"}),
     base("cerrado",{estado:"cerrado",fecha_termino:"2026-10-20"}),
   ] as never;
   const d=build();
   expect(d.rentals).toEqual({active:5,endingSoon:2,undated:0});
   expect(d.primary.find(topic=>topic.id==="alquileres")?.items.map(item=>item.id)).toEqual(["alquiler:vencido","alquiler:hoy"]);
   expect(html(d)).toContain("Vencen en los próximos 7 días");
   expect(html(d)).not.toContain("sin fecha de término");
 });
 test("fechas ausentes o inválidas se muestran por confirmar y nunca como próximos vencimientos",()=>{
   source.alquileres=[base("sin-fecha",{estado:"abierto",fecha_termino:null}),base("invalido",{estado:"abierto",fecha_termino:"2026-02-31"})] as never;
   const d=build();
   expect(d.rentals).toEqual({active:2,endingSoon:0,undated:2});
   expect(html(d)).toContain("2 sin fecha de término");
   expect(d.primary.some(topic=>topic.id==="alquileres")).toBe(false);
 });
 test("alquileres distingue cero comprobado de una fuente que no pudo consultarse",()=>{
   expect(build().rentals).toEqual({active:0,endingSoon:0,undated:0});
   source.alquileres=null;
   const d=build();
   expect(d.rentals).toBeNull();expect(d.complete).toBe(false);
   const card=html(d).match(/<article[^>]*aria-labelledby="alquileres-inicio"[^>]*>([\s\S]*?)<\/article>/)?.[1]??"";
   expect(card).toContain("No disponible");expect(card).not.toContain("Vencen en los próximos 7 días");
 });
 test("por cobrar incluye fechas lejanas y sin fecha, descontando cobros vinculados",()=>{
   source.ventas_madera=[base("madera",{estado:"confirmada",modalidad_pago:"credito",fecha_pago_credito:"2026-10-14",total:100})] as never;
   source.ventas_mueble_terminado=[base("mueble",{modalidad_pago:"credito",fecha_pago_credito:"2026-10-16",total:20})] as never;
   source.alquileres=[base("alquiler",{estado:"abierto",activo:"Mixer",monto_total:50,modalidad_pago:"credito",fecha_pago_credito:"2026-12-20",fecha_termino:"2026-10-15"})] as never;
   source.servicios_aserradero=[base("servicio",{precio_cobrado:10,modalidad_pago:"credito",fecha_pago_credito:null})] as never;
   source.movimientos_caja=[move("pago",{modulo_origen:"ventas_madera",referencia_id:"madera",monto:30}),move("pago-aserradero",{modulo_origen:"ventas_aserradero",referencia_id:"servicio",monto:4})] as never;
   const d=build();expect(d.creditTotal).toBe(146);expect(d.overdue).toBe(70);expect(d.inTime).toBe(70);expect(d.undated).toBe(6);
   expect(d.primary[0].id).toBe("cobros");expect(d.primary[0].amount).toBe(90);expect(d.primary).toHaveLength(2);
 });
 test("un crédito pagado desaparece; pagos personales o de otra operación no lo cancelan",()=>{
   source.ventas_madera=[base("v",{estado:"confirmada",modalidad_pago:"credito",fecha_pago_credito:"2026-10-14"})] as never;
   source.movimientos_caja=[move("personal",{es_personal:true,modulo_origen:"ventas_madera",referencia_id:"v"}),move("otro",{modulo_origen:"ventas_madera",referencia_id:"ajeno"})] as never;
   expect(build().creditTotal).toBe(100);
   source.movimientos_caja=[...(source.movimientos_caja as NonNullable<GerencialSources["movimientos_caja"]>),move("real",{modulo_origen:"ventas_madera",referencia_id:"v"})] as never;
   expect(build().creditTotal).toBe(0);expect(build().primary).toHaveLength(0);
 });
 test("fecha ausente o inválida nunca significa vencido",()=>{
   source.alquileres=[base("a",{estado:"abierto",activo:"Mixer",monto_total:30,modalidad_pago:"credito",fecha_pago_credito:"2026-02-31",fecha_termino:null})] as never;
   const d=build();expect(d.primary).toEqual([]);expect(d.overdue).toBe(0);expect(d.undated).toBe(30);expect(d.other).toHaveLength(2);
 });
 test("stock desconocido no se presenta como ausencia de pendientes",()=>{
   source.inventario_productos=null;const d=build();expect(d.complete).toBe(false);expect(d.emptyVerified).toBe(false);
   expect(html(d)).toContain("Verificación incompleta");expect(html(d)).not.toContain("Sin pendientes urgentes");
 });
 test("un fallo de Caja conserva el stock y oculta todos los saldos no comprobables",()=>{
   source.movimientos_caja=null;source.inventario_productos=[base("p",{activo:true,stock_actual:0,stock_minimo:1,unidad:"pieza"})] as never;
   const d=build();expect(d.creditTotal).toBeNull();expect(d.cashBalance).toBeNull();expect(d.primary[0].id).toBe("stock");expect(html(d)).toContain("No disponible");
 });
 test("un importe de crédito desconocido invalida el total y el estado completo",()=>{
   source.alquileres=[base("a",{estado:"cerrado",activo:"Mixer",monto_total:null,modalidad_pago:"credito",fecha_pago_credito:null})] as never;
   const d=build();expect(d.creditTotal).toBeNull();expect(d.complete).toBe(false);expect(d.extraUnavailable).toContain("Saldos de crédito");
 });
 test("conserva borradores, producción, mora, penalidades y adelantos en otros pendientes",async()=>{
   source.ventas_madera=[base("b",{estado:"borrador"})] as never;
   source.ordenes_produccion=[base("o",{estado:"terminado",cotizacion_unificada_id:"q"})] as never;
   source.cotizaciones_unificadas=[base("q",{estado_flujo:"deudor"})] as never;
   source.alquileres=[base("a",{estado:"abierto",activo:"Mixer",monto_total:20,penalidad:3})] as never;
   mocks.advances.mockResolvedValue([{}]);mocks.alerts.mockResolvedValue([{id:"alerta",descripcion:"Revisar aviso registrado"}]);
   const d=await getInicioResumenData(owner,now),markup=html(d);
   for(const label of ["Ventas sin confirmar","Pedidos en producción","Cotizaciones marcadas en mora","Penalidades activas","Adelantos pendientes","Revisar aviso registrado"])expect(markup).toContain(label);
   expect(d.creditTotal).toBe(0);expect(d.unverifiedQuotes).toBe(1);expect(d.emptyVerified).toBe(false);
   const indicators=markup.match(/<nav[^>]*aria-label="Otros pendientes"[^>]*>([\s\S]*?)<\/nav>/)?.[1]??"";
   expect(indicators).not.toBe("");expect(indicators).not.toContain("<details");
   for(const href of ["/ventas?estado=borrador","/ventas/muebles-personalizados","/personal?adelantos=pendiente#adelantos-pendientes"])expect(indicators).toContain('href="'+href+'"');
 });
 test("limita a tres temas y conserva alertas prioritarias fuera del foco",()=>{
   source.ventas_madera=[base("v",{estado:"confirmada",modalidad_pago:"credito",fecha_pago_credito:"2026-10-14"})] as never;
   source.alquileres=[base("a",{estado:"abierto",activo:"Mixer",monto_total:20,fecha_termino:"2026-10-15"})] as never;
   source.inventario_productos=[base("p",{activo:true,stock_actual:0,stock_minimo:1,unidad:"pieza"})] as never;
   const model=buildGerencialModel(source,now);
   const alerts=[{id:"alerta:uno",title:"Revisar",subject:"Alerta de prueba",reason:"Revisar",date:null,amount:null,amountLabel:"",href:"/gerencial",action:"Revisar",priority:"alta" as const}];
   const d=buildInicioResumen(model,inicioAccess(owner),{advances:0,alerts,cashBalance:0});
   expect(d.primary).toHaveLength(3);expect(d.other.some(topic=>topic.id==="alertas")).toBe(true);expect(d.otherUrgent).toBe(1);expect(html(d)).toContain("casos prioritarios");
 });
 test("el cero comprobado sí puede mostrar ausencia de pendientes",()=>{
   const d=build();expect(d.emptyVerified).toBe(true);expect(d.creditTotal).toBe(0);expect(html(d)).toContain("Sin pendientes urgentes");
 });
 test("la pantalla solo consulta y enlaza; no contiene formularios de operación",()=>{
   const markup=html(build());expect(markup).not.toContain("<form");expect(markup).not.toContain("data-inicio-resumen-preview");expect(markup).not.toContain("Cliente de ejemplo");expect(markup).toContain("Ver Centro de Mando");
 });
 test("fecha y período siguen Perú cuando UTC ya cambió de mes",async()=>{
   const d=await getInicioResumenData(owner,new Date("2026-11-01T02:00:00Z"));expect(d.today).toBe("2026-10-31");expect(d.monthStart).toBe("2026-10-01");
 });
});
describe("Inicio: permisos, organización y recuperación",()=>{
 test.each(["owner_admin","gerencia","ventas","vendedor","almacen","caja","operaciones_caja","rrhh","partner_readonly"] as const)("solo solicita las fuentes permitidas para %s",async role=>{
   const actor={...owner,role,uiRole:null};const access=inicioAccess(actor);await getInicioResumenData(actor,now);
   if(access.analysis)expect(mocks.sources).toHaveBeenCalledWith("hoy",owner.organizationId);
   else {expect(mocks.sources).not.toHaveBeenCalled();expect(mocks.read.mock.calls.map(c=>c[0])).toEqual(inicioRequiredTables(access));}
   expect(mocks.advances.mock.calls.length>0).toBe(access.personal);expect(mocks.alerts.mock.calls.length>0).toBe(access.analysis);
 });
 test("almacén no recibe indicadores ni enlaces financieros aunque existan en el modelo",()=>{
   source.movimientos_caja=[move("privado",{monto:123456.78})] as never;
   const d=build(source,{...owner,role:"almacen",uiRole:null}),markup=html(d);
   expect(d.cashBalance).toBeNull();expect(d.creditTotal).toBeNull();expect(d.rentals).toBeNull();expect(markup).not.toContain("Resumen del negocio");expect(markup).not.toContain("Ver contratos");expect(markup).not.toContain("Ver Centro de Mando");expect(markup).not.toContain("123,456");
 });
 test("la organización se transmite a todas las lecturas extra",async()=>{
   await getInicioResumenData({...owner,organizationId:"segunda-org"},now);
   expect(mocks.sources).toHaveBeenCalledWith("hoy","segunda-org");expect(mocks.advances).toHaveBeenCalledWith("segunda-org");expect(mocks.alerts).toHaveBeenCalledWith("segunda-org");
 });
 test("el reintento recupera una fuente sin transformar el fallo en cero",async()=>{
   source.inventario_productos=null;expect((await getInicioResumenData(owner,now)).complete).toBe(false);
   source.inventario_productos=[];expect((await getInicioResumenData(owner,now)).complete).toBe(true);
 });
 test("la ruta real mantiene la explicación de acceso denegado",async()=>{
   const markup=renderToStaticMarkup(await DashboardPage({searchParams:Promise.resolve({mensaje:"no-acceso"})}));
   expect(markup).toContain("No tienes acceso a esta sección");expect(markup).toContain("data-inicio-resumen");
 });
});
