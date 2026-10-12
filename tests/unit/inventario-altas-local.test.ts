import { beforeEach, expect, test, vi } from "vitest";
import { DEFAULT_ORG_ID as org } from "@/lib/constants";

const mocks = vi.hoisted(() => ({ disk: vi.fn(), auth: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn(() => { throw new Error('NEXT_REDIRECT'); }) }));
vi.mock("@/lib/auth", () => ({ requireAuthContext: mocks.auth }));
vi.mock("@/lib/runtime", () => ({ hasSupabaseEnv: () => false }));
vi.mock("@/lib/supabase/server", () => ({ getSupabaseServerClient: () => { throw new Error("La prueba local no usa Supabase"); } }));
vi.mock("@/lib/company-config", () => ({ getEmpresaConfig: vi.fn().mockResolvedValue({ margen_ganancia_default_pct: 0 }) }));
vi.mock("@/lib/numeracion", () => ({ nextCorrelativo: vi.fn().mockResolvedValue("LOCAL-001") }));
vi.mock("@/lib/store-persistence", () => ({ readStoreFromDisk: () => null, writeStoreToDisk: mocks.disk }));
let demo: typeof import("@/lib/demo-store");
let actions: typeof import("@/app/actions");
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
  vi.clearAllMocks();
});


const productoForm=()=>form({submission_id:crypto.randomUUID(),codigo:'AUD-LOCAL-81',nombre:'Mueble de verificación',categoria:'Muebles',unidad:'unidad',stock_minimo:0,stock_inicial:10,costo_unitario:25.555});
const movForm=(id:string)=>form({submission_id:crypto.randomUUID(),producto_id:id,fecha:'2026-10-11',tipo:'entrada_compra',cantidad:10,costo_unitario:25,referencia:'Ficticia'});
test('producto local, stock inicial y catálogo reconocen un reintento sin duplicarse',async()=>{
 const f=productoForm(),antesCaja=demo.demoCajaRows();await actions.createInventarioProducto(f);await actions.createInventarioProducto(f);
 const id=String(f.get('submission_id'));expect(demo.demoInventarioProductosRows().filter(p=>p.id===id)).toHaveLength(1);
 expect(demo.demoInventarioProductosRows().find(p=>p.id===id)).toMatchObject({stock_actual:10,costo_unitario:25.555});
 expect(demo.demoMueblesCatalogoRows().find(p=>p.id===id)?.stock_disponible).toBe(10);
 expect(demo.demoInventarioMovimientosRows().filter(m=>m.producto_id===id)).toHaveLength(1);expect(demo.demoCajaRows()).toEqual(antesCaja);
});
test('fallo de disco revierte producto, Kardex, catálogo y marcador',async()=>{
 const f=productoForm(),antes=demo.demoExportStore();falloDisco();
 await expect(actions.createInventarioProducto(f)).rejects.toThrow();expect(demo.demoExportStore()).toEqual(antes);
 await actions.createInventarioProducto(f);expect(demo.demoInventarioProductosRows().find(p=>p.id===f.get('submission_id'))?.stock_actual).toBe(10);
});
test('movimiento manual local reconoce reintento y revierte existencias si falla disco',async()=>{
 const p=productoForm();await actions.createInventarioProducto(p);const id=String(p.get('submission_id')),f=movForm(id),antes=demo.demoExportStore();falloDisco();
 await expect(actions.createInventarioMovimiento(f)).rejects.toThrow();expect(demo.demoExportStore()).toEqual(antes);
 await actions.createInventarioMovimiento(f);await actions.createInventarioMovimiento(f);
 expect(demo.demoInventarioProductosRows().find(p=>p.id===id)?.stock_actual).toBe(20);
 expect(demo.demoInventarioMovimientosRows().filter(m=>m.producto_id===id)).toHaveLength(2);
 f.set('cantidad','11');await expect(actions.createInventarioMovimiento(f)).rejects.toThrow();
});
test('edición del catálogo conserva el costo y revierte ambos documentos si falla disco',async()=>{
 const f=productoForm();await actions.createInventarioProducto(f);const id=String(f.get('submission_id'));
 const datos=form({id,precio_lista:500,descripcion:'Ficticia',foto_url:'foto.jpg'}),antes=demo.demoExportStore();falloDisco();
 await expect(actions.updateMuebleCatalogo(datos)).rejects.toThrow();expect(demo.demoExportStore()).toEqual(antes);
 await actions.updateMuebleCatalogo(datos);expect(demo.demoInventarioProductosRows().find(p=>p.id===id)).toMatchObject({foto_url:'foto.jpg',costo_unitario:25.555,stock_actual:10});
});
test('formularios antiguos sin clave no crean entradas ni productos',async()=>{
 const p=productoForm();p.delete('submission_id');const antes=demo.demoExportStore();
 await expect(actions.createInventarioProducto(p)).rejects.toThrow('Actualiza');expect(demo.demoExportStore()).toEqual(antes);
});
test('el formulario confirma el producto e ID sin convertir un guardado correcto en error de navegación',async()=>{
 const p=productoForm();p.set('return_to','/inventario');p.set('next_quick','movimiento');
 const r=await actions.submitCreateInventarioProductoForm({success:false,error:null,message:null},p);
 expect(r).toMatchObject({success:true,error:null,id:p.get('submission_id')});
 expect(demo.demoInventarioProductosRows().find(x=>x.id===r.id)?.stock_actual).toBe(10);
});
test('la sugerencia asigna secuencias disponibles, conserva códigos manuales y reconoce reintentos',async()=>{
 const manual=productoForm();manual.set('codigo','MUE-GEN-2610-999');await actions.createInventarioProducto(manual);
 const first=productoForm();first.set('codigo','MUE-GEN-2610-###');first.set('codigo_automatico','1');
 await actions.createInventarioProducto(first);await actions.createInventarioProducto(first);
 const second=productoForm();second.set('codigo','MUE-GEN-2610-###');second.set('codigo_automatico','1');await actions.createInventarioProducto(second);
 expect(demo.demoInventarioProductosRows().find(p=>p.id===first.get('submission_id'))?.codigo).toBe('MUE-GEN-2610-1000');
 expect(demo.demoInventarioProductosRows().find(p=>p.id===second.get('submission_id'))?.codigo).toBe('MUE-GEN-2610-1001');
 expect(demo.demoInventarioMovimientosRows().filter(m=>m.producto_id===first.get('submission_id'))).toHaveLength(1);
 expect(demo.demoInventarioProductosRows().find(p=>p.id===manual.get('submission_id'))?.codigo).toBe('MUE-GEN-2610-999');
});
test('una plantilla automática alterada se rechaza sin producto, stock o recibo parcial',async()=>{
 const f=productoForm(),before=demo.demoExportStore();f.set('codigo_automatico','1');
 await expect(actions.createInventarioProducto(f)).rejects.toThrow('Código sugerido');expect(demo.demoExportStore()).toEqual(before);
});
