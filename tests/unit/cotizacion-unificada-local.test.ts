import { beforeEach, expect, test, vi } from "vitest";
import { DEFAULT_ORG_ID as org } from "@/lib/constants";
import { defaultCotizacionDetalleV1 } from "@/lib/cotizacion-unificada-payload";

const mocks = vi.hoisted(() => ({ disk: vi.fn(), auth: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/auth", () => ({ requireAuthContext: mocks.auth }));
vi.mock("@/lib/runtime", () => ({ hasSupabaseEnv: () => false }));
vi.mock("@/lib/supabase/server", () => ({ getSupabaseServerClient: () => { throw new Error("La prueba local no usa Supabase"); } }));
vi.mock("@/lib/company-config", () => ({ getEmpresaConfig: vi.fn().mockResolvedValue({ margen_ganancia_default_pct: 0 }) }));
vi.mock("@/lib/numeracion", () => ({ nextCorrelativo: vi.fn().mockResolvedValue("LOCAL-001") }));
vi.mock("@/lib/store-persistence", () => ({ readStoreFromDisk: () => null, writeStoreToDisk: mocks.disk }));
let demo: typeof import("@/lib/demo-store");
let actions: typeof import("@/app/actions");
let cliente: string;
const form = (values: Record<string, unknown>) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, String(value));
  return data;
};
const falloDisco = () => mocks.disk.mockImplementationOnce(() => { throw new Error("Disco de prueba no disponible"); });
beforeEach(async () => {
  vi.resetModules();
  mocks.disk.mockReset();
  mocks.auth.mockResolvedValue({ userId: "10000000-0000-4000-8000-000000000001", organizationId: org, role: "owner_admin", uiRole: null });
  demo = await import("@/lib/demo-store");
  actions = await import("@/app/actions");
  demo.demoResetStore();
  cliente = demo.demoClientesRows().find(c => c.organization_id === org)!.id;
  vi.clearAllMocks();
});

const entrada=()=>{
 const detalle=defaultCotizacionDetalleV1();detalle.rubros.muebles=true;detalle.costoManoObra=1000;
 return {submissionId:crypto.randomUUID(),clienteId:cliente,tipoCliente:'natural' as const,fecha:'2026-10-11',estadoFlujo:'lista_produccion' as const,detalle,total:1000};
};
const cajaEmpresa=()=>demo.demoCajaRows().filter(m=>m.organization_id===org);
test('alta local reconoce el mismo envío, conserva importe y no crea cobro',async()=>{
 const datos=entrada(),antes=cajaEmpresa();const primera=await actions.saveCotizacionUnificada(datos);expect(primera.ok).toBe(true);
 expect(await actions.saveCotizacionUnificada(datos)).toEqual(primera);
 expect(demo.demoCotizacionesUnificadasRows().filter(c=>c.cliente_id===cliente&&c.fecha===datos.fecha&&c.total===1000)).toHaveLength(1);
 expect(cajaEmpresa()).toEqual(antes);
});
test('fallo de disco local revierte documento y recibo antes de permitir el reintento',async()=>{
 const datos=entrada(),antes=demo.demoExportStore();falloDisco();
 expect((await actions.saveCotizacionUnificada(datos)).ok).toBe(false);expect(demo.demoExportStore()).toEqual(antes);
 expect((await actions.saveCotizacionUnificada(datos)).ok).toBe(true);
});
test('cambiar los datos de una clave guardada se rechaza; una clave nueva permite otro presupuesto',async()=>{
 const datos=entrada();await actions.saveCotizacionUnificada(datos);const antes=demo.demoExportStore();
 expect((await actions.saveCotizacionUnificada({...datos,fecha:'2026-10-12'})).ok).toBe(false);expect(demo.demoExportStore()).toEqual(antes);
 expect((await actions.saveCotizacionUnificada({...datos,submissionId:crypto.randomUUID()})).ok).toBe(true);
});
test('el cliente de una orden local no cambia y el mismo cliente permite editar',async()=>{
 const datos=entrada(),r=await actions.saveCotizacionUnificada(datos);if(!r.ok)throw Error(r.error);
 await actions.aprobarCotizacionAOrden(form({cotizacion_id:r.id,adelanto:300,metodo_adelanto:'yape',notas:''}));
 const otro=demo.demoClientesRows().find(c=>c.organization_id===org&&c.id!==cliente)!.id,antes=demo.demoExportStore();
 expect((await actions.saveCotizacionUnificada({...datos,id:r.id,clienteId:otro})).ok).toBe(false);expect(demo.demoExportStore()).toEqual(antes);
 expect((await actions.saveCotizacionUnificada({...datos,id:r.id,fecha:'2026-10-12'})).ok).toBe(true);
});
test('local también rechaza cliente ajeno y alta cobrada sin escribir',async()=>{
 const datos=entrada(),antes=demo.demoExportStore();
 expect((await actions.saveCotizacionUnificada({...datos,clienteId:crypto.randomUUID()})).ok).toBe(false);
 expect((await actions.saveCotizacionUnificada({...datos,estadoFlujo:'cobrada'} as unknown as Parameters<typeof actions.saveCotizacionUnificada>[0])).ok).toBe(false);
 expect(demo.demoExportStore()).toEqual(antes);
});
test('adelanto local con clave estable se guarda una vez; el fallo de disco se revierte',async()=>{
 const emp=demo.demoExportStore().empleados.find(e=>e.organization_id===org)!.id;
 const datos={submission_id:crypto.randomUUID(),empleado_id:emp,fecha:'2026-10-11',monto:150},antes=demo.demoExportStore(),antesCaja=cajaEmpresa();falloDisco();
 await expect(actions.createAdelanto(form(datos))).rejects.toThrow();expect(demo.demoExportStore()).toEqual(antes);
 await actions.createAdelanto(form(datos));await actions.createAdelanto(form(datos));
 expect(demo.demoExportStore().adelantos.filter(a=>a.id===datos.submission_id)).toHaveLength(1);expect(cajaEmpresa()).toEqual(antesCaja);
 await expect(actions.createAdelanto(form({...datos,monto:151}))).rejects.toThrow(/no coincide/);
});
test('cotización local pagada crea solo la orden y conserva cobro y estado cobrada',async()=>{
 const datos=entrada(),r=await actions.saveCotizacionUnificada(datos);if(!r.ok)throw Error(r.error);
 expect((await actions.registrarCobroCotizacionUnificada(r.id,{medio:'yape',totalEsperado:1000,saldoEsperado:1000})).ok).toBe(true);
 const antes=cajaEmpresa();await actions.aprobarCotizacionAOrden(form({cotizacion_id:r.id,adelanto:0,metodo_adelanto:'yape',notas:''}));
 expect(cajaEmpresa()).toEqual(antes);expect(demo.demoGetCotizacionUnificada(r.id)?.estado_flujo).toBe('cobrada');
 expect(demo.demoOrdenesProduccionRows().filter(o=>o.cotizacion_unificada_id===r.id)).toHaveLength(1);
});
