import { beforeEach, describe, expect, test, vi } from "vitest";
import { DEFAULT_ORG_ID as org } from "@/lib/constants";
import { defaultCotizacionDetalleV1 } from "@/lib/cotizacion-unificada-payload";

const mocks = vi.hoisted(() => ({ disk: vi.fn(), auth: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/auth", () => ({ requireAuthContext: mocks.auth }));
vi.mock("@/lib/runtime", () => ({ hasSupabaseEnv: () => false }));
vi.mock("@/lib/supabase/server", () => ({ getSupabaseServerClient: () => { throw new Error("La prueba local no usa Supabase"); } }));
vi.mock("@/lib/company-config", () => ({ getEmpresaConfig: vi.fn() }));
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
const totalCaja = () => demo.demoCajaRows().filter(m => m.organization_id === org).reduce((sum, m) => sum + m.monto, 0);
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

describe.each(["madera", "aserradero", "cortada"])("Cobros locales de %s", tipo => {
  test.each([["credito", 0], ["adelanto", 300]] as const)("%s registra el importe recibido y Yape", async (modalidad, esperado) => {
    const inicial = totalCaja();
    const base = { cliente_id: cliente, fecha: "2026-10-10", total: 1000, estado: "confirmada",
      metodo_pago: "yape", modalidad_pago: modalidad, adelanto: 300, tipo_comprobante: "ninguno", fecha_pago_credito: "2026-10-31" };
    if (tipo === "madera") await actions.createVentaMadera(form({ ...base,
      inventario_producto_id: demo.demoInventarioProductosRows().find(p => p.organization_id === org)!.id, cantidad_producto: 1 }));
    else if (tipo === "aserradero") await actions.createServicioAserradero(form({ submission_id: crypto.randomUUID(), ...base, pies_cubicos: 10, costo_cubicaje: 100, precio_cobrado: 1000, lineas_json: "[]" }));
    else await actions.createVentaMaderaCortada(form({ ...base, chofer_id: "", tipo_entrega: "entrega_local", direccion_entrega: "", estado_entrega: "pendiente",
      monto_credito: 0, tipo_corte: "tabla", total_pt: 20, precio_por_pt: 50, cantidad_piezas: 10, precio_unitario_comercial: 100, inventario_producto_id: "",
      lineas_cubicaje: JSON.stringify([{ cantidad: 10, espesor: 1, ancho: 6, largo: 4, descripcion: "Pieza ficticia" }]) }));
    expect(totalCaja() - inicial).toBe(esperado);
    if (esperado > 0) expect(demo.demoCajaRows()[0].medio).toBe("yape");
  });
});
const contrato = () => demo.demoCreateContratoAlquiler({ organization_id: org, cliente_id: cliente, activo: "mixer", fecha_inicio: "2026-10-10",
  tarifa: 1000, monto_total: 1000, deposito_30: 300, metodo_pago: "yape", confirmaIngreso: false });
const cerrar = (id: string) => actions.cerrarContratoAlquiler(form({ contrato_id: id, fecha_cierre: "2026-10-10", observaciones: "" }));
test("un cierre local repetido no duplica el saldo", async () => {
  const id = contrato().id, inicial = totalCaja();
  expect(await cerrar(id)).toEqual({ ok: true });
  expect(await cerrar(id)).toMatchObject({ ok: false });
  expect(totalCaja() - inicial).toBe(700);
});
test("un fallo al guardar el cierre local restaura todo y permite reintentar", async () => {
  const id = contrato().id, anterior = demo.demoExportStore();
  falloDisco();
  expect(await cerrar(id)).toMatchObject({ ok: false });
  expect(demo.demoExportStore()).toEqual(anterior);
  expect(await cerrar(id)).toEqual({ ok: true });
  expect(mocks.disk).toHaveBeenLastCalledWith(expect.anything(), { strict: true });
});
test("la compra antigua retirada no altera la copia local", async () => {
  const anterior = demo.demoExportStore();
  await expect(actions.createCompraMadera(form({}))).rejects.toThrow(/no está disponible/);
  expect(demo.demoExportStore()).toEqual(anterior);
});
const cotizacion = () => demo.demoCreateCotizacionUnificada({ organization_id: org, cliente_id: cliente, fecha: "2026-10-10",
  correlativo: "LOCAL-COT", tipo_cliente: "natural", total: 1000, estado_flujo: "lista_produccion", detalle: defaultCotizacionDetalleV1() });
const aprobar = (id: string) => actions.aprobarCotizacionAOrden(form({ cotizacion_id: id, notas: "", adelanto: 300, metodo_adelanto: "yape" }));

function productoManual() {
  const id=demo.demoCreateInventarioProducto({organization_id:org,codigo:'LOCAL-'+crypto.randomUUID(),nombre:'Producto ficticio',categoria:'Maderas',unidad:'unidad',stock_minimo:0,foto_url:null,costo_unitario:null});
  const entrada=demo.demoCreateInventarioMovimiento({organization_id:org,producto_id:id,fecha:'2026-10-11',tipo:'entrada_compra',cantidad:100,costo_unitario:null,referencia:'Entrada manual ficticia'});
  return {id,entrada};
}
test('un fallo de disco al borrar Kardex revierte la existencia y el movimiento',async()=>{
  const {entrada}=productoManual(),anterior=demo.demoExportStore();falloDisco();
  await expect(actions.deleteInventarioMovimiento(form({id:entrada.id}))).rejects.toThrow(/Disco/);
  expect(demo.demoExportStore()).toEqual(anterior);
});
test('un fallo del conteo local revierte el ajuste y permite reintentar sin duplicarlo',async()=>{
  const {id}=productoManual(),anterior=demo.demoExportStore();
  const data=form({producto_id:id,fecha:'2026-10-11',stock_contado:120,stock_esperado:100,referencia:'Conteo ficticio'});
  falloDisco();await expect(actions.registrarConteoInventario(data)).rejects.toThrow(/Disco/);expect(demo.demoExportStore()).toEqual(anterior);
  await actions.registrarConteoInventario(data);
  expect(demo.demoInventarioProductosRows().find(p=>p.id===id)?.stock_actual).toBe(120);
  await expect(actions.registrarConteoInventario(data)).rejects.toThrow(/stock cambió/);
  expect(demo.demoInventarioMovimientosRows().filter(m=>m.producto_id===id)).toHaveLength(2);
});
test('el editor local conserva el stock intervenido al guardar solo un nombre',async()=>{
  const {id}=productoManual();demo.demoCreateInventarioMovimiento({organization_id:org,producto_id:id,fecha:'2026-10-11',tipo:'salida_venta',cantidad:10,costo_unitario:null,referencia:'Manual ficticia'});
  await actions.updateInventarioProducto(form({id,codigo:'LOCAL-EDIT',nombre:'Nombre corregido',categoria:'Maderas',unidad:'unidad',stock_minimo:0,stock_actual:100,stock_esperado:100,foto_url:'',costo_unitario:''}));
  expect(demo.demoInventarioProductosRows().find(p=>p.id===id)).toMatchObject({stock_actual:90,nombre:'Nombre corregido'});
});
test('una cotización local con adelanto no pierde dinero al editar su total',async()=>{
  const id=cotizacion().id;await aprobar(id);const anterior=demo.demoExportStore();
  expect(()=>demo.demoUpdateCotizacionUnificada(id,{total:100})).toThrow(/cobros/);
  expect(demo.demoExportStore()).toEqual(anterior);
  falloDisco();expect(()=>demo.demoUpdateCotizacionUnificada(id,{total:1500})).toThrow(/Disco/);
  expect(demo.demoExportStore()).toEqual(anterior);
});
test('el cliente provisional, Aserradero y Caja locales se revierten juntos; el reintento conserva un solo ingreso',async()=>{
  const data=form({submission_id:crypto.randomUUID(),usarClienteProvisional:true,fecha:'2026-10-11',precio_cobrado:1000,pies_cubicos:10,costo_cubicaje:100,
    lineas_json:'[]',metodo_pago:'yape',modalidad_pago:'contado',adelanto:0,tipo_comprobante:'ninguno',url_comprobante:''});
  const anterior=demo.demoExportStore();falloDisco();await expect(actions.createServicioAserradero(data)).rejects.toThrow(/Disco/);expect(demo.demoExportStore()).toEqual(anterior);
  await actions.createServicioAserradero(data);await actions.createServicioAserradero(data);
  const actual=demo.demoExportStore();expect(actual.serviciosAserradero.length-anterior.serviciosAserradero.length).toBe(1);
  expect(actual.clientes.length-anterior.clientes.length).toBe(1);expect(totalCaja()-anterior.caja.reduce((s,m)=>s+m.monto,0)).toBe(1000);
});
test("el adelanto local se vincula a la orden y el cobro final suma solo el saldo", async () => {
  const id = cotizacion().id, inicial = totalCaja();
  await aprobar(id);
  expect(await actions.consultarCobroCotizacionUnificada(id)).toEqual({ ok: true, total: 1000, cobrado: 300, saldo: 700 });
  expect(await actions.registrarCobroCotizacionUnificada(id, { medio: "banco", totalEsperado: 1000, saldoEsperado: 700 })).toEqual({ ok: true });
  expect(totalCaja() - inicial).toBe(1000);
  expect(await actions.registrarCobroCotizacionUnificada(id, { medio: "banco", totalEsperado: 1000, saldoEsperado: 700 })).toMatchObject({ ok: false });
});
test("un fallo local al aprobar restaura la orden, el estado y Caja", async () => {
  const id = cotizacion().id, anterior = demo.demoExportStore();
  falloDisco();
  await expect(aprobar(id)).rejects.toThrow(/Disco/);
  expect(demo.demoExportStore()).toEqual(anterior);
  await aprobar(id);
  await expect(aprobar(id)).rejects.toThrow(/ya tiene una orden/);
});
test("un fallo del cobro local conserva el adelanto y el estado anterior", async () => {
  const id = cotizacion().id;
  await aprobar(id);
  const anterior = demo.demoExportStore();
  falloDisco();
  expect(await actions.registrarCobroCotizacionUnificada(id, { medio: "banco", totalEsperado: 1000, saldoEsperado: 700 })).toMatchObject({ ok: false });
  expect(demo.demoExportStore()).toEqual(anterior);
  expect(await actions.registrarCobroCotizacionUnificada(id, { medio: "banco", totalEsperado: 1000, saldoEsperado: 700 })).toEqual({ ok: true });
});

const nuevoProducto = (categoria = 'Madera') => {
  const id = demo.demoCreateInventarioProducto({ organization_id: org, codigo: 'LOCAL-'+crypto.randomUUID(), nombre: 'Producto ficticio',
    categoria, unidad: categoria === 'Muebles' ? 'unidad' : 'ft3', stock_minimo: 0, foto_url: null, costo_unitario: null });
  demo.demoUpdateInventarioProducto(id,{stock_actual:100}); return id;
};
const base = () => ({ cliente_id: cliente, fecha: '2026-10-10', metodo_pago: 'yape', modalidad_pago: 'contado', adelanto: 0,
  fecha_pago_credito: '', tipo_comprobante: 'ninguno', chofer_id: '', tipo_entrega: 'entrega_local', direccion_entrega: '',
  estado_entrega: 'pendiente', monto_credito: 0 });
const stock = (id: string) => demo.demoInventarioProductosRows().find(p => p.id === id)!.stock_actual;
const cortar = (id: string, nonce = crypto.randomUUID(), cantidad = 12) => actions.createVentaMaderaCortada(form({ ...base(),
  submission_id: nonce, tipo_corte: 'tabla', total_pt: cantidad*12, precio_por_pt: 50, total: cantidad*600,
  cantidad_piezas: cantidad, precio_unitario_comercial: 600, inventario_producto_id: '', lineas_cubicaje: JSON.stringify([
    { cantidad, espesor: 1, ancho: 12, largo: 12, descripcion: 'Pieza ficticia', inventario_producto_id: id }]) }));

test.each(['madera','cortada','mueble','compra'])('un fallo de disco revierte %s completo y el mismo envío se puede reintentar una sola vez', async tipo => {
  const id = nuevoProducto(tipo === 'mueble' ? 'Muebles' : 'Madera'), nonce = crypto.randomUUID();
  const guardar = () => tipo === 'madera' ? actions.createVentaMadera(form({ ...base(), submission_id: nonce, total: 1000, estado: 'confirmada', inventario_producto_id: id, cantidad_producto: 10 }))
    : tipo === 'cortada' ? cortar(id, nonce)
    : tipo === 'mueble' ? actions.createVentaMuebleTerminado(form({ ...base(), submission_id: nonce, mueble_catalogo_id: id, cantidad: 2, precio_unitario: 500 }))
    : actions.createInventarioCompraRapida(form({ submission_id: nonce, producto_id: id, cantidad: 10, costo_unitario: 10,
      proveedor: '', nota: '', fecha: '2026-10-10', tipo_comprobante: 'ninguno', url_comprobante: '' }));
  const anterior = demo.demoExportStore(); falloDisco(); await expect(guardar()).rejects.toThrow(/Disco/);
  expect(demo.demoExportStore()).toEqual(anterior);
  await guardar(); await guardar(); expect(stock(id)).toBe(tipo === 'compra' ? 110 : tipo === 'mueble' ? 98 : tipo === 'madera' ? 90 : 88);
  expect(totalCaja()-anterior.caja.filter(c=>!c.voided_at).reduce((s,c)=>s+c.monto,0)).toBe(tipo === 'compra' ? 100 : tipo === 'cortada' ? 7200 : 1000);
});
test('anular muebles local devuelve exactamente las unidades y conserva el cobro anulado', async () => {
  const id = nuevoProducto('Muebles'), inicial = totalCaja();
  await actions.createVentaMuebleTerminado(form({ ...base(), mueble_catalogo_id: id, cantidad: 2, precio_unitario: 500 }));
  const venta = demo.demoVentasMuebleTerminadoRows().find(v=>v.mueble_catalogo_id===id)!;
  await actions.cancelarVentaMueble(form({ id: venta.id })); await actions.cancelarVentaMueble(form({ id: venta.id }));
  expect(stock(id)).toBe(100); expect(demo.demoMueblesCatalogoRows().find(p=>p.id===id)!.stock_disponible).toBe(100);
  expect(totalCaja()).toBe(inicial); expect(demo.demoExportStore().caja.find(c=>c.referencia_id===venta.id)!.voided_at).toBeTruthy();
});
test('anular madera cortada mantiene salida y devolución y revierte todo si falla disco', async () => {
  const id = nuevoProducto(), venta = await cortar(id), anterior = demo.demoExportStore(); falloDisco();
  expect(await actions.deleteVentaMaderaCortada(venta)).toMatchObject({ ok: false }); expect(demo.demoExportStore()).toEqual(anterior);
  expect(await actions.deleteVentaMaderaCortada(venta)).toMatchObject({ ok: true }); expect(stock(id)).toBe(100);
  expect(demo.demoInventarioMovimientosRows().filter(m=>m.producto_id===id)).toHaveLength(2);
});
test('un mes cerrado rechaza nuevas entradas y anulación sin alterar datos', async () => {
  const id = nuevoProducto(), venta = await cortar(id); demo.demoCerrarMes(org,2026,10);
  const anterior = demo.demoExportStore(); await expect(cortar(id)).rejects.toThrow(/cerrado/);
  expect(await actions.deleteVentaMaderaCortada(venta)).toMatchObject({ ok: false }); expect(demo.demoExportStore()).toEqual(anterior);
  expect(() => demo.demoCreateCaja({ organization_id: org, fecha: '2026-10-15', tipo:'ingreso',medio:'yape',categoria:'Prueba',monto:50,descripcion:null,modulo_origen:null })).toThrow(/cerrado/);
  expect(demo.demoExportStore()).toEqual(anterior);
});
test('cerrar mes falla completo si no se guarda y protege solo la empresa elegida', () => {
  const otro = '00000000-0000-0000-0000-000000000002';
  demo.demoCreateCaja({ organization_id: otro, fecha:'2026-10-10',tipo:'ingreso',medio:'yape',categoria:'Prueba',monto:50,descripcion:null,modulo_origen:null });
  const anterior=demo.demoExportStore(); falloDisco(); expect(()=>demo.demoCerrarMes(org,2026,10)).toThrow(/Disco/);
  expect(demo.demoExportStore()).toEqual(anterior); demo.demoCerrarMes(org,2026,10);
  expect(demo.demoCajaRows().filter(c=>c.organization_id===otro).every(c=>!c.periodo_cerrado)).toBe(true);
  expect(()=>demo.demoCerrarMes(org,2026,10)).toThrow(/ya está cerrado/);
});
test('eliminar cliente incluye madera cortada y se revierte completo ante fallo de disco', async () => {
  const id=nuevoProducto(); await cortar(id); const anterior=demo.demoExportStore(); falloDisco();
  await actions.forzarEliminarClienteCompleto(form({id:cliente,confirmacion:'ELIMINAR TODO'})); expect(demo.demoExportStore()).toEqual(anterior);
  await actions.forzarEliminarClienteCompleto(form({id:cliente,confirmacion:'ELIMINAR TODO'}));
  expect(demo.demoClientesRows().some(c=>c.id===cliente)).toBe(false); expect(stock(id)).toBe(100);
  expect(demo.demoVentasRows().some(v=>v.cliente_id===cliente)).toBe(false);
});

const rapidaLocal = (id=crypto.randomUUID(), patch:Record<string,unknown>={}) => actions.createCotizacion(form({
  submission_id:id,cliente_id:cliente,fecha:'2026-10-11',tipo:'mueble_personalizado',especie_madera:'Ficticia',
  unidad_medida:'cm',precio_calculado:1000,precio_acordado:1000,estado:'confirmada',motivo_ajuste:'',...patch,
}));
test('cotización rápida local confirma y reconoce reintentos sin registrar dinero',async()=>{
  const id=crypto.randomUUID(),caja=totalCaja();await rapidaLocal(id);await rapidaLocal(id);
  expect(demo.demoCotizacionesRows().filter(c=>c.id===id)).toHaveLength(1);expect(totalCaja()).toBe(caja);
  await expect(rapidaLocal(id,{precio_acordado:900})).rejects.toThrow(/otros datos/);
  expect(demo.demoCotizacionesRows().find(c=>c.id===id)!.precio_acordado).toBe(1000);
});
test('cotización rápida local no deja documento ni recibo si falla el disco',async()=>{
  const anterior=demo.demoExportStore(),id=crypto.randomUUID();falloDisco();
  await expect(rapidaLocal(id)).rejects.toThrow(/Disco/);expect(demo.demoExportStore()).toEqual(anterior);
  await rapidaLocal(id);expect(demo.demoCotizacionesRows().filter(c=>c.id===id)).toHaveLength(1);
});
test('aprobar la cotización rápida local cobra solo el adelanto indicado',async()=>{
  const id=crypto.randomUUID(),caja=totalCaja();await rapidaLocal(id);
  await actions.aprobarCotizacionAOrden(form({cotizacion_id:id,adelanto:300,metodo_adelanto:'yape',notas:''}));
  expect(totalCaja()-caja).toBe(300);expect(demo.demoOrdenesProduccionRows().filter(o=>o.cotizacion_id===id)).toHaveLength(1);
});
test('borrar una rápida con dinero enlazado conserva Caja y su documento en local',async()=>{
  const id=crypto.randomUUID();await rapidaLocal(id);demo.demoUpdateClienteEstado(cliente,'inactivo');
  demo.demoCreateCaja({organization_id:org,fecha:'2026-10-11',tipo:'ingreso',medio:'yape',categoria:'Cobro ficticio',
    monto:300,descripcion:null,modulo_origen:'muebles_corte',referencia_id:id});
  const anterior=demo.demoExportStore();expect(await actions.deleteCotizacionMueblePersonalizada(id)).toMatchObject({ok:false,error:expect.stringMatching(/movimientos en Caja/)});
  expect(demo.demoExportStore()).toEqual(anterior);
});
test('borrado local sin cobros conserva memoria ante fallo y no revive al reintentar el alta',async()=>{
  const id=crypto.randomUUID();await rapidaLocal(id);demo.demoUpdateClienteEstado(cliente,'inactivo');
  const anterior=demo.demoExportStore();falloDisco();expect((await actions.deleteCotizacionMueblePersonalizada(id)).ok).toBe(false);
  expect(demo.demoExportStore()).toEqual(anterior);expect(await actions.deleteCotizacionMueblePersonalizada(id)).toEqual({ok:true});
  await expect(rapidaLocal(id)).rejects.toThrow(/ya fue eliminada/);expect(demo.demoCotizacionesRows().some(c=>c.id===id)).toBe(false);
});
test('servicio de corte local conserva el cobro habitual sin repetirlo por envío',async()=>{
  const id=crypto.randomUUID(),caja=totalCaja();await rapidaLocal(id,{tipo:'servicio_corte'});await rapidaLocal(id,{tipo:'servicio_corte'});
  expect(totalCaja()-caja).toBe(1000);expect(demo.demoCotizacionesRows().filter(c=>c.id===id)).toHaveLength(1);
});
