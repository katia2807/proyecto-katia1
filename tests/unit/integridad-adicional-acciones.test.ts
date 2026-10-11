// Regresiones: acciones reales, SDK Supabase y migración SQL, sin red ni datos reales.
// Acciones actuales + SDK real + PostgreSQL en memoria, sin conexiones externas ni datos del negocio.
import { beforeAll, beforeEach, afterAll, expect, test, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { createClient } from '@supabase/supabase-js';
const mocks = vi.hoisted(() => ({ auth:vi.fn(),client:vi.fn(),runtime:vi.fn(),company:vi.fn() }));
vi.mock('next/cache',()=>({revalidatePath:vi.fn()}));
vi.mock('next/navigation',()=>({redirect:vi.fn()}));
vi.mock('@/lib/auth',()=>({requireAuthContext:mocks.auth}));
vi.mock('@/lib/runtime',()=>({hasSupabaseEnv:mocks.runtime}));
vi.mock('@/lib/supabase/server',()=>({getSupabaseServerClient:mocks.client}));
vi.mock('@/lib/numeracion',()=>({nextCorrelativo:vi.fn().mockImplementation(async()=> 'AUD-'+crypto.randomUUID())}));
vi.mock('@/lib/store-persistence',()=>({readStoreFromDisk:()=>null,writeStoreToDisk:vi.fn()}));
vi.mock('@/lib/company-config',()=>({getEmpresaConfig:mocks.company}));
import * as actions from '@/app/actions';
import { DEFAULT_ORG_ID as org } from '@/lib/constants';
import { defaultCotizacionDetalleV1 } from '@/lib/cotizacion-unificada-payload';
import { calcularContratoCotizacion, crearInstantaneaCalculoCotizacion } from '@/lib/cotizacion-calculos';

type Row=Record<string,unknown>;

const actor='10000000-0000-4000-8000-000000000001',cliente='20000000-0000-4000-8000-000000000001';
const producto='30000000-0000-4000-8000-000000000001',cot='50000000-0000-4000-8000-000000000001';
const proveedor='60000000-0000-4000-8000-000000000001';
let db:PGlite,traces:Row[]=[],gate:null|(()=>Promise<void>)=null;
let afterProductRead:null|(()=>Promise<void>)=null, loseRpcResponse=false;
let loseTableResponse:string|null=null;

const tables=new Set(['clientes','proveedores','inventario_productos','muebles_catalogo','ventas_madera','ventas_madera_lineas',
 'inventario_movimientos','ventas_mueble_terminado','ventas_madera_cortada','servicios_aserradero','compras_madera',
 'alquileres','cotizaciones_unificadas','cotizaciones_mueble','ordenes_produccion','movimientos_caja','cierres_mensuales','operaciones_financieras_seguras']);
const functions=new Set(['registrar_operacion_integral','crear_compra_madera_con_caja','consultar_cobro_cotizacion','registrar_cobro_cotizacion_seguro','corregir_venta_madera_cortada_historica','eliminar_movimiento_inventario_seguro','eliminar_producto_inventario_seguro','editar_producto_inventario_seguro','registrar_conteo_inventario_seguro','editar_cotizacion_unificada_segura','registrar_servicio_integral']);
const name=(v:string)=>{if(!/^[a-z_][a-z_0-9]*$/.test(v))throw Error('Identificador no permitido');return '"'+v+'"';};
const parameter=(v:unknown)=>v!==null&&typeof v==='object'?JSON.stringify(v):v;
// PostgREST serializa numeric como número JSON; PGlite lo entrega como texto al driver.
const numericFields=new Set(['total','stock_actual','stock_disponible','stock_minimo','costo_unitario','precio_lista','precio_unitario','cantidad','monto','monto_total','adelanto','cobrado','saldo']);
const dateFields=new Set(['fecha','fecha_inicio','fecha_fin','fecha_termino','fecha_aprobacion','fecha_pago_credito']);
const fixtureFetch:typeof fetch=async(input,init)=>{
 const url=new URL(String(input));if(url.hostname!=='audit.invalid')throw Error('Red externa bloqueada');
 const table=url.pathname.split('/').pop()!,method=init?.method??'GET';
 const response=(v:unknown,status=200)=>new Response(JSON.stringify(v,(key,value)=>
  dateFields.has(key)&&typeof value==='string'?value.slice(0,10):numericFields.has(key)&&typeof value==='string'&&value!==''&&Number.isFinite(Number(value))?Number(value):value),{status,headers:{'content-type':'application/json'}});
 try{
  const body:Row=init?.body?JSON.parse(String(init.body)):{};
  if(url.pathname.includes('/rpc/')){
   if(!functions.has(table))throw Error('RPC no permitida');const keys=Object.keys(body);
   const rows=(await db.query<Row>('select '+name(table)+'('+keys.map((k,i)=>name(k)+' => $'+(i+1)).join(',')+') result',keys.map(k=>parameter(body[k])))).rows;
   traces.push({table,method,rpc:true});
   if(loseRpcResponse){loseRpcResponse=false;traces.push({respuestaPerdidaDespuesDeCommit:true});return response({message:'Respuesta de prueba perdida después de confirmar',code:'AUDIT'},503);}
   return response(rows[0].result);
  }
  if(!tables.has(table))throw Error('Tabla no permitida');
  const params:unknown[]=[],where:string[]=[];
  for(const[k,v]of url.searchParams){
   if(['select','order','limit','offset','columns'].includes(k))continue;
   if(v==='is.null')where.push(name(k)+' is null');
   else{
    const match=/^(eq|neq|gte|lte)\.(.*)$/.exec(v);if(!match)throw Error('Filtro no soportado '+k+'='+v);
    params.push(match[2]);where.push(name(k)+({eq:'=',neq:'<>',gte:'>=',lte:'<='}[match[1]])+'$'+params.length);
   }
  }
  const filter=where.length?' where '+where.join(' and '):'';
  let sql='select * from '+name(table)+filter;
  if(method==='POST'){
   const items=Array.isArray(body)?body:[body];const keys=Object.keys(items[0]);params.push(...items.flatMap(row=>keys.map(k=>parameter(row[k]))));
   sql='insert into '+name(table)+'('+keys.map(name).join(',')+') values '+items.map((_,j)=>'('+keys.map((_,i)=>'$'+(j*keys.length+i+1)).join(',')+')').join(',')+' returning *';
  }else if(method==='DELETE')sql='delete from '+name(table)+filter+' returning *';
  else if(method==='PATCH'){
   const keys=Object.keys(body),offset=params.length;params.push(...keys.map(k=>parameter(body[k])));
   sql='update '+name(table)+' set '+keys.map((k,i)=>name(k)+'=$'+(offset+i+1)).join(',')+filter+' returning *';
  }
  const rows=(await db.query<Row>(sql,params)).rows;traces.push({table,method,rows:rows.length});
  if(method==='POST'&&table===loseTableResponse){loseTableResponse=null;traces.push({respuestaPerdidaDespuesDeCommit:true});return response({message:'Respuesta de Caja perdida después de confirmar',code:'AUDIT'},503);}
  if(method==='GET'&&table==='inventario_productos'){
   if(gate)await gate();
   if(afterProductRead){const run=afterProductRead;afterProductRead=null;await run();}
  }
  const single=new Headers(init?.headers).get('accept')?.includes('vnd.pgrst.object');
  if(single&&rows.length>1)return response({code:'PGRST116',message:'Se esperó un solo registro'},406);
  return response(single?rows[0]??null:rows);
 }catch(e){const err=e as {message:string;code?:string};traces.push({table,method,error:err.message,code:err.code});return response({message:err.message,code:err.code??'XX000'},400);}
};
const form=(r:Row)=>{const f=new FormData();for(const[k,v]of Object.entries(r))f.set(k,String(v));return f;};
const num=async(sql:string)=>Number((await db.query<{n:number}>(sql)).rows[0].n);
const count=(t:string)=>num('select count(*) n from '+name(t));
const stock=()=>num(`select stock_actual n from inventario_productos where id='${producto}'`);
const cash=()=>num("select coalesce(sum(case when tipo='ingreso' then monto else -monto end),0) n from movimientos_caja where voided_at is null and deleted_at is null");

const entrada=(cantidad:number,fecha='2026-10-11')=>db.query<Row>(`insert into inventario_movimientos(organization_id,producto_id,fecha,tipo,cantidad,referencia) values($1,$2,$3,'entrada_compra',$4,'manual ficticia') returning id`,[org,producto,fecha,cantidad]);
const compraRapida=(id=crypto.randomUUID())=>actions.createInventarioCompraRapida(form({submission_id:id,producto_id:producto,fecha:'2026-10-11',cantidad:10,costo_unitario:10,proveedor:'Ficticio',nota:'',tipo_comprobante:'ninguno',url_comprobante:''}));
const venderMadera=()=>actions.createVentaMadera(form({submission_id:crypto.randomUUID(),cliente_id:cliente,fecha:'2026-10-11',total:1000,estado:'confirmada',
 inventario_producto_id:producto,cantidad_producto:10,metodo_pago:'yape',modalidad_pago:'contado',adelanto:0,fecha_pago_credito:''}));
const compraMadera=()=>actions.createCompraMadera(form({proveedor_id:proveedor,fecha:'2026-10-11',especie_madera:'Ficticia',detalle:'',cantidad:10,unidad:'pt',
 precio_unitario:10,modalidad_pago:'contado',adelanto:0,estado:'confirmada',url_comprobante:''}));
const cotInput=(precioHora=1000)=>{const d=defaultCotizacionDetalleV1();d.rubros.aserradero=true;d.aserradero={modo:'hora',precioHora,horas:1,montoTotalFijo:0,descripcion:'Ficticio'};
 const c=calcularContratoCotizacion(d,0);return {id:cot,clienteId:cliente,tipoCliente:'natural' as const,fecha:'2026-10-11',detalle:d,total:c.totalFinal,estadoFlujo:'pendiente' as const};};
beforeAll(async()=>{
 db=new PGlite();
 for(const file of ['tests/unit/fixtures/finanzas.sql','tests/unit/fixtures/finanzas-heredado.sql','supabase/migrations/20261010010000_cobros_y_cierres_seguros.sql','supabase/migrations/20261011010000_integridad_caja_stock_operaciones.sql'])await db.exec(readFileSync(file,'utf8'));
 await db.exec(`alter table inventario_productos add column costo_unitario numeric;
  alter table cotizaciones_unificadas add column tipo_cliente text;
  alter table inventario_movimientos add constraint inventario_movimientos_cantidad_check check((tipo='ajuste' and cantidad<>0) or (tipo in ('entrada_compra','salida_venta') and cantidad>0));
  create unique index inventario_productos_org_codigo on inventario_productos(organization_id,codigo);
  create unique index muebles_catalogo_org_codigo on muebles_catalogo(organization_id,codigo);
  create unique index ordenes_unique_cot_unif on ordenes_produccion(organization_id,cotizacion_unificada_id) where cotizacion_unificada_id is not null;
  create function fallo_inventario_ficticio() returns trigger language plpgsql as $$begin
   if current_setting('auditoria.fallo_stock_update',true)='si' then raise exception 'Fallo de escritura de stock solo de prueba';end if;return new;end $$;
  create trigger fallo_inventario before update on inventario_productos for each row execute function fallo_inventario_ficticio();`);
 await db.exec(`alter table perfiles add column full_name text;
  alter table alquileres alter column id set default gen_random_uuid();
  create table audit_logs(id uuid default gen_random_uuid(),organization_id uuid,user_id uuid,user_name text,accion text,modulo text,entidad_id text,entidad_nombre text,detalles jsonb);`);
 await db.exec(readFileSync('tests/unit/fixtures/finanzas-adicional.sql','utf8'));
 await db.exec(readFileSync('supabase/migrations/20261011020000_integridad_adicional_operaciones.sql','utf8'));
 await db.exec("set request.jwt.claim.role='service_role'");
},30000);
beforeEach(async()=>{
 traces=[];gate=null;afterProductRead=null;loseRpcResponse=false;loseTableResponse=null;
 await db.exec('truncate audit_logs,operaciones_financieras_seguras,ventas_madera_lineas,inventario_movimientos,ventas_mueble_terminado,ventas_madera_cortada,ventas_madera,servicios_aserradero,compras_madera,alquileres,ordenes_produccion,cotizaciones_unificadas,cotizaciones_mueble,muebles_catalogo,inventario_productos,clientes,proveedores,movimientos_caja,cierres_mensuales,perfiles cascade');
 await db.exec("set auditoria.fallo_stock_update='no';set auditoria.fallo_caja='no';set auditoria.fallo_categoria='';");
 await db.query("insert into perfiles(user_id,organization_id,role,ui_role) values($1,$2,'owner_admin','owner_admin')",[actor,org]);
 await db.query("insert into clientes(id,organization_id,nombre)values($1,$2,'Cliente ficticio')",[cliente,org]);
 await db.query('insert into proveedores(id,organization_id)values($1,$2)',[proveedor,org]);
 await db.query("insert into inventario_productos(id,organization_id,codigo,nombre,stock_actual,unidad,categoria)values($1,$2,'AUD-01','Madera ficticia',100,'unidad','Maderas')",[producto,org]);
 const input=cotInput(),calculo=calcularContratoCotizacion(input.detalle,0),detalle={...input.detalle,resumenCalculo:crearInstantaneaCalculoCotizacion(calculo)};
 await db.query("insert into cotizaciones_unificadas(id,organization_id,cliente_id,total,fecha,estado_flujo,detalle)values($1,$2,$3,1000,'2026-10-11','en_produccion',$4)",[cot,org,cliente,JSON.stringify(detalle)]);
 mocks.auth.mockResolvedValue({userId:actor,organizationId:org,role:'owner_admin',uiRole:'owner_admin'});mocks.runtime.mockReturnValue(true);
 mocks.company.mockResolvedValue({margen_ganancia_default_pct:0});
 mocks.client.mockReturnValue(createClient('https://audit.invalid','clave-ficticia',{global:{fetch:fixtureFetch},auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}}));
});
afterAll(async()=>{await db.close();});

test('Kardex no permite borrar salidas de venta ni deja Caja separada',async()=>{
 await venderMadera();const id=String((await db.query<Row>('select id from inventario_movimientos')).rows[0].id);
 await expect(actions.deleteInventarioMovimiento(form({id}))).rejects.toThrow(/operación de origen/);
 expect(await stock()).toBe(90);expect(await count('ventas_madera')).toBe(1);expect(await cash()).toBe(1000);expect(await count('inventario_movimientos')).toBe(1);
});
test('Kardex protege la entrada y el recibo de una compra rápida al reintentar',async()=>{
 const id=crypto.randomUUID();await compraRapida(id);
 await expect(actions.deleteInventarioMovimiento(form({id}))).rejects.toThrow(/operación de origen/);await compraRapida(id);
 expect(await stock()).toBe(110);expect(await cash()).toBe(-100);expect(await count('inventario_movimientos')).toBe(1);
});
test('el borrado directo y el borrado forzado del producto también protegen movimientos vinculados',async()=>{
 await venderMadera();
 await expect(db.exec('delete from inventario_movimientos')).rejects.toThrow(/operación de origen/);
 await expect(actions.deleteInventarioProducto(form({id:producto,forzarConMovimientos:true}))).rejects.toThrow(/operación de origen/);
 expect(await stock()).toBe(90);expect(await count('inventario_movimientos')).toBe(1);
});
test('un producto referenciado conserva su Kardex manual si falla el borrado final',async()=>{
 await entrada(10);await db.exec('create table if not exists referencia_producto_prueba(producto uuid references inventario_productos(id));');
 await db.query('insert into referencia_producto_prueba values($1)',[producto]);
 await expect(actions.deleteInventarioProducto(form({id:producto,forzarConMovimientos:true}))).rejects.toThrow(/foreign key/);
 expect(await stock()).toBe(110);expect(await count('inventario_movimientos')).toBe(1);
});
test('un fallo de stock conserva el movimiento manual y todo el inventario',async()=>{
 const id=String((await entrada(10)).rows[0].id);await db.exec("set auditoria.fallo_stock_update='si'");
 await expect(actions.deleteInventarioMovimiento(form({id}))).rejects.toThrow(/Fallo de escritura/);
 expect(await count('inventario_movimientos')).toBe(1);expect(await stock()).toBe(110);
});
test('dos borrados de movimientos distintos conservan la suma completa',async()=>{
 const a=String((await entrada(10)).rows[0].id),b=String((await entrada(20)).rows[0].id);
 await Promise.all([actions.deleteInventarioMovimiento(form({id:a})),actions.deleteInventarioMovimiento(form({id:b}))]);
 expect(await count('inventario_movimientos')).toBe(0);expect(await stock()).toBe(100);
});
test('no se recorta a cero el stock para borrar una entrada ya utilizada',async()=>{
 const id=String((await entrada(10)).rows[0].id);await db.exec('update inventario_productos set stock_actual=5');
 await expect(actions.deleteInventarioMovimiento(form({id}))).rejects.toThrow(/ya se utilizó/);
 expect(await stock()).toBe(5);expect(await count('inventario_movimientos')).toBe(1);
});
test('un conteo desactualizado conserva la entrada intervenida; uno actual registra solo la diferencia',async()=>{
 await entrada(10);
 const values={producto_id:producto,fecha:'2026-10-11',stock_contado:120,referencia:'Conteo ficticio',stock_esperado:100};
 await expect(actions.registrarConteoInventario(form(values))).rejects.toThrow(/stock cambió/);
 expect(await stock()).toBe(110);expect(await count('inventario_movimientos')).toBe(1);
 await actions.registrarConteoInventario(form({...values,stock_esperado:110}));
 expect(await stock()).toBe(120);expect(await num('select sum(cantidad) n from inventario_movimientos')).toBe(20);
});
const editarProducto=(patch:Row={})=>actions.updateInventarioProducto(form({id:producto,codigo:'AUD-01',nombre:'Madera renombrada',categoria:'Maderas',unidad:'unidad',stock_minimo:0,stock_actual:100,stock_esperado:100,foto_url:'',costo_unitario:'',...patch}));
test('editar el nombre con un formulario anterior conserva el stock vendido',async()=>{
 await venderMadera();await editarProducto();expect(await stock()).toBe(90);expect(await cash()).toBe(1000);
 expect(await count('inventario_movimientos')).toBe(1);
});
test('un cambio deliberado de stock desactualizado se rechaza sin guardar el nombre',async()=>{
 await venderMadera();await expect(editarProducto({stock_actual:120})).rejects.toThrow(/stock cambió/);
 expect(await stock()).toBe(90);expect((await db.query<Row>('select nombre from inventario_productos')).rows[0].nombre).toBe('Madera ficticia');
});
test('un formulario sin stock anterior no puede sobrescribir existencias',async()=>{
 await expect(editarProducto({stock_esperado:''})).rejects.toThrow(/Vuelve a abrir/);expect(await stock()).toBe(100);
});
test('comprar un mueble sincroniza catálogo; cambiar costo conserva precio, foto y stock por identidad',async()=>{
 await db.exec("update inventario_productos set categoria='Muebles';update muebles_catalogo set precio_lista=650");
 await compraRapida();expect(await num('select stock_disponible n from muebles_catalogo')).toBe(110);
 await editarProducto({categoria:'Muebles',stock_esperado:110,stock_actual:115,costo_unitario:300,foto_url:'foto.jpg'});
 expect(await stock()).toBe(115);expect(await num('select stock_disponible n from muebles_catalogo')).toBe(115);
 expect(await num('select precio_lista n from muebles_catalogo')).toBe(650);
 expect((await db.query<Row>('select foto_url from muebles_catalogo')).rows[0].foto_url).toBe('foto.jpg');
});
test('acciones antiguas retiradas fallan antes de crear gastos, compras o leer archivos',async()=>{
 for(const call of [()=>actions.importarArchivo(form({tipo:'gastos'})),()=>actions.repetirGastosMesAnterior(form({})),compraMadera]) await expect(call()).rejects.toThrow(/no está disponible/);
 expect(await cash()).toBe(0);expect(await count('compras_madera')).toBe(0);expect(await count('inventario_movimientos')).toBe(0);
});
test('una cotización no se reduce por debajo del adelanto de su orden',async()=>{
 const orden=String((await db.query<Row>("insert into ordenes_produccion(organization_id,cliente_id,cotizacion_unificada_id,estado)values($1,$2,$3,'en_produccion')returning id",[org,cliente,cot])).rows[0].id);
 await db.query("insert into movimientos_caja(organization_id,fecha,tipo,medio,categoria,monto,modulo_origen,referencia_id)values($1,'2026-10-11','ingreso','efectivo','adelanto_mueble_personalizado',300,'ventas',$2)",[org,orden]);
 expect(await actions.saveCotizacionUnificada(cotInput(100))).toMatchObject({ok:false,error:expect.stringMatching(/dinero ya recibido/)});
 expect(await num('select total n from cotizaciones_unificadas')).toBe(1000);expect(await cash()).toBe(300);
 expect(await actions.saveCotizacionUnificada(cotInput(500))).toEqual({ok:true,id:cot});
 expect(await actions.consultarCobroCotizacionUnificada(cot)).toEqual({ok:true,total:500,cobrado:300,saldo:200});
});
test('el rol operaciones usa los mismos permisos que la aplicación',async()=>{
 await db.exec("update perfiles set role='gerencia',ui_role='operaciones'");mocks.auth.mockResolvedValue({userId:actor,organizationId:org,role:'gerencia',uiRole:'operaciones'});
 await compraRapida();expect(await stock()).toBe(110);expect(await cash()).toBe(-100);
});
test('los RPC nuevos no conceden ejecución a sesiones normales',async()=>{
 const result=await db.query<Row>("select p.oid::regprocedure::text nombre,has_function_privilege('anon',p.oid,'execute') anon,has_function_privilege('authenticated',p.oid,'execute') usuario,has_function_privilege('service_role',p.oid,'execute') servidor from pg_proc p where proname in ('eliminar_movimiento_inventario_seguro','eliminar_producto_inventario_seguro','editar_producto_inventario_seguro','registrar_conteo_inventario_seguro','editar_cotizacion_unificada_segura','registrar_servicio_integral','corregir_venta_madera_cortada_historica')");
 expect(result.rows).toHaveLength(7);for(const row of result.rows)expect(row).toMatchObject({anon:false,usuario:false,servidor:true});
});
test('un perfil desactivado o de otra empresa no puede modificar stock por RPC',async()=>{
 await db.exec('update perfiles set deactivated_at=now()');
 await expect(compraRapida()).rejects.toThrow(/No autorizado/);expect(await stock()).toBe(100);
 await db.exec("update perfiles set deactivated_at=null,organization_id='00000000-0000-4000-8000-000000000002'");
 await expect(compraRapida()).rejects.toThrow(/No autorizado/);expect(await stock()).toBe(100);
});
test('un cobro entre la lectura y el guardado no se sobrescribe',async()=>{
 const input=cotInput(500);
 // La acción lee un snapshot antes de pedir la configuración. Interviene un cobro real antes del RPC.
 mocks.company.mockImplementationOnce(async()=>{await db.exec("update cotizaciones_unificadas set estado_flujo='cobrada';");return {margen_ganancia_default_pct:0};});
 expect(await actions.saveCotizacionUnificada(input)).toMatchObject({ok:false,error:expect.stringMatching(/ya está cobrada/)});
 expect(await num('select total n from cotizaciones_unificadas')).toBe(1000);
 expect((await db.query<Row>('select estado_flujo from cotizaciones_unificadas')).rows[0].estado_flujo).toBe('cobrada');
});
const historica='70000000-0000-4000-8000-000000000001';
const seedHistorica=async(modalidad='contado')=>{
 await db.query(`insert into ventas_madera_cortada(id,organization_id,cliente_id,fecha,estado,tipo_corte,total_pt,precio_por_pt,cantidad_piezas,total,
   metodo_pago,modalidad_pago,tipo_entrega,estado_entrega,lineas_comprobante)values($1,$2,$3,'2026-10-11','confirmada','tabla',12,83.333333,1,1000,'efectivo',$4,'entrega_local','pendiente','[]')`,[historica,org,cliente,modalidad]);
 await db.query("insert into movimientos_caja(organization_id,fecha,tipo,medio,categoria,monto,modulo_origen,referencia_id)values($1,'2026-10-11','ingreso','efectivo','venta_madera', $2,'ventas_madera_cortada',$3)",[org,modalidad==='contado'?1000:300,historica]);
};
const corregirHistorica=(precio=100)=>actions.correctVentaMaderaCortadaHistorica(form({id:historica,confirmacion:'on',precio_por_pt:precio,total_mode:'calculado',
 total_manual:'',motivo_correccion:'Verificación ficticia aislada de permisos',piezas_confirmadas:'[1]',
 lineas_cubicaje:JSON.stringify([{id:1,cantidad:1,espesor:1,ancho:12,largo:12,descripcion:'Tabla de cedro cepillada para puerta principal'}])}));
test('readonly heredado no puede corregir dinero ni desde la acción ni por RPC directo',async()=>{
 await seedHistorica();await db.exec("update perfiles set ui_role='readonly'");mocks.auth.mockResolvedValue({userId:actor,organizationId:org,role:'owner_admin',uiRole:'readonly'});
 await expect(corregirHistorica()).rejects.toThrow(/Solo Katia/);
 await expect(db.query('select corregir_venta_madera_cortada_historica($1,$2,null,100,\'[]\',1200,\'Prueba ficticia\',true)',[historica,actor])).rejects.toThrow(/No autorizado/);
 expect(await num('select total n from ventas_madera_cortada')).toBe(1000);expect(await cash()).toBe(1000);expect(await count('audit_logs')).toBe(0);
});
test('una corrección histórica respeta adelantos, y la dueña conserva la corrección al contado',async()=>{
 await seedHistorica('adelanto');await expect(corregirHistorica(100/12)).rejects.toThrow(/dinero ya recibido/);
 expect(await num('select total n from ventas_madera_cortada')).toBe(1000);expect(await cash()).toBe(300);
 await db.exec("update ventas_madera_cortada set modalidad_pago='contado';update movimientos_caja set monto=1000");
 await corregirHistorica();expect(await num('select total n from ventas_madera_cortada')).toBe(1200);expect(await cash()).toBe(1200);expect(await count('audit_logs')).toBe(1);
});
const servicioForm=(tipo:string,id:string,provisional=false)=>tipo==='aserradero'
 ?form({submission_id:id,usarClienteProvisional:provisional,cliente_id:cliente,fecha:'2026-10-11',precio_cobrado:1000,pies_cubicos:10,costo_cubicaje:100,
    lineas_json:'[]',metodo_pago:'yape',modalidad_pago:'contado',fecha_pago_credito:'',adelanto:0,tipo_comprobante:'ninguno',url_comprobante:''})
 :form({submission_id:id,cliente_id:cliente,activo:'Mixer ficticio',codigo:'',representante:'',ruc_empresa:'',direccion_ejecucion:'',
    fecha_inicio:'2026-10-11',fecha_termino:'2026-10-12',dias_alquiler:1,tarifa_unidad:'dia',tarifa:1000,monto_total:1000,metodo_pago:'yape',
    modalidad_pago:'adelanto',fecha_pago_credito:'',adelanto:300,monto_credito:0,penalidad_retraso_pago_pct:3,penalidad_devolucion_tardia_pct:3,penalidad_danios_pct:3});
const crearServicio=(tipo:string,id:string,provisional=false)=>tipo==='aserradero'?actions.createServicioAserradero(servicioForm(tipo,id,provisional)):actions.createContratoAlquiler(servicioForm(tipo,id));
test.each(['aserradero','alquiler'])('una respuesta perdida al crear %s conserva documento y cobro, sin duplicarlos al reintentar',async(tipo)=>{
 const id=crypto.randomUUID(),tabla=tipo==='aserradero'?'servicios_aserradero':'alquileres',importe=tipo==='aserradero'?1000:300;
 loseRpcResponse=true;await expect(crearServicio(tipo,id)).rejects.toThrow(/perdida/);
 expect(await cash()).toBe(importe);expect(await count(tabla)).toBe(1);
 await crearServicio(tipo,id);expect(await cash()).toBe(importe);expect(await count(tabla)).toBe(1);
});
test.each(['aserradero','alquiler'])('un fallo de Caja al crear %s revierte también documento y recibo',async(tipo)=>{
 await db.exec("set auditoria.fallo_caja='si'");await expect(crearServicio(tipo,crypto.randomUUID())).rejects.toThrow(/Fallo de Caja/);
 expect(await cash()).toBe(0);expect(await count(tipo==='aserradero'?'servicios_aserradero':'alquileres')).toBe(0);expect(await count('operaciones_financieras_seguras')).toBe(0);
});
test('cliente provisional y servicio se guardan juntos y el reintento no duplica clientes',async()=>{
 const id=crypto.randomUUID();loseRpcResponse=true;await expect(crearServicio('aserradero',id,true)).rejects.toThrow(/perdida/);
 await crearServicio('aserradero',id,true);expect(await count('clientes')).toBe(2);expect(await count('servicios_aserradero')).toBe(1);expect(await cash()).toBe(1000);
});
test('un fallo de Caja no deja cliente provisional huérfano',async()=>{
 await db.exec("set auditoria.fallo_caja='si'");await expect(crearServicio('aserradero',crypto.randomUUID(),true)).rejects.toThrow(/Fallo de Caja/);
 expect(await count('clientes')).toBe(1);expect(await count('servicios_aserradero')).toBe(0);
});
