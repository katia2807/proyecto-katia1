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
 'alquileres','cotizaciones_unificadas','cotizaciones_mueble','ordenes_produccion','movimientos_caja','cierres_mensuales','operaciones_financieras_seguras','empleados','adelantos','sueldos']);
const functions=new Set(['registrar_alta_inventario_segura','editar_mueble_catalogo_seguro','registrar_operacion_integral','crear_compra_madera_con_caja','consultar_cobro_cotizacion','registrar_cobro_cotizacion_seguro','corregir_venta_madera_cortada_historica','eliminar_movimiento_inventario_seguro','eliminar_producto_inventario_seguro','editar_producto_inventario_seguro','registrar_conteo_inventario_seguro','editar_cotizacion_unificada_segura','registrar_servicio_integral','aprobar_cotizacion_con_adelanto','registrar_cotizacion_rapida_segura','eliminar_cotizacion_mueble_segura','registrar_cotizacion_unificada_segura']);
const name=(v:string)=>{if(!/^[a-z_][a-z_0-9]*$/.test(v))throw Error('Identificador no permitido');return '"'+v+'"';};
const parameter=(v:unknown)=>v!==null&&typeof v==='object'?JSON.stringify(v):v;
// PostgREST serializa numeric como número JSON; PGlite lo entrega como texto al driver.
const numericFields=new Set(['total','stock_actual','stock_disponible','stock_minimo','costo_unitario','precio_lista','precio_unitario','cantidad','monto','monto_total','precio_acordado','precio_calculado','adelanto','cobrado','saldo']);
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
   if(k==='or'){
    const parts=v.slice(1,-1).split(',').map(part=>{
     const m=/^([a-z_]+)\.(eq|ilike)\.(.*)$/.exec(part);if(!m)throw Error('Filtro OR no soportado');
     params.push(m[3]);return name(m[1])+(m[2]==='ilike'?' ilike ':'=')+'$'+params.length;
    });where.push('('+parts.join(' or ')+')');continue;
   }
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
  if(method==='POST'&&table===loseTableResponse){loseTableResponse=null;traces.push({respuestaPerdidaDespuesDeCommit:true});return response({message:'Respuesta de guardado perdida después de confirmar',code:'AUDIT'},503);}
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
const cash=()=>num("select coalesce(sum(case when tipo='ingreso' then monto else -monto end),0) n from movimientos_caja where voided_at is null and deleted_at is null");
const cotInput=(manoObra=1000)=>{const d=defaultCotizacionDetalleV1();d.rubros.muebles=true;d.costoManoObra=manoObra;
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
 await db.exec(readFileSync('tests/unit/fixtures/finanzas-cotizacion-rapida.sql','utf8'));
 await db.exec(readFileSync('supabase/migrations/20261011030000_cotizacion_rapida_segura.sql','utf8'));
 await db.exec(readFileSync('supabase/migrations/20261011040000_cotizacion_unificada_segura.sql','utf8'));
 await db.exec(readFileSync('supabase/migrations/20261011050000_altas_inventario_y_catalogo_seguros.sql','utf8'));
 await db.exec("set request.jwt.claim.role='service_role'");
},30000);
beforeEach(async()=>{
 traces=[];gate=null;afterProductRead=null;loseRpcResponse=false;loseTableResponse=null;
 await db.exec('truncate cotizacion_cortes,audit_logs,operaciones_financieras_seguras,ventas_madera_lineas,inventario_movimientos,ventas_mueble_terminado,ventas_madera_cortada,ventas_madera,servicios_aserradero,compras_madera,alquileres,ordenes_produccion,cotizaciones_unificadas,cotizaciones_mueble,muebles_catalogo,inventario_productos,clientes,proveedores,movimientos_caja,cierres_mensuales,perfiles cascade');
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


const productoForm=(data:Row={})=>form({codigo:'AUD-NUEVO',nombre:'Producto de verificación',categoria:'Materiales',unidad:'unidad',stock_minimo:0,stock_inicial:10,costo_unitario:25,submission_id:crypto.randomUUID(),...data});
const movimientoForm=(data:Row={})=>form({producto_id:producto,fecha:'2026-10-11',tipo:'entrada_compra',cantidad:10,costo_unitario:25,referencia:'Entrada manual ficticia',submission_id:crypto.randomUUID(),...data});
test('código automático: respuesta perdida conserva 001 y otra solicitud asigna 002',async()=>{
 const f=productoForm({codigo:'MUE-GEN-2610-###',codigo_automatico:1,categoria:'Muebles'});loseRpcResponse=true;
 await expect(actions.createInventarioProducto(f)).rejects.toThrow();await actions.createInventarioProducto(f);
 await actions.createInventarioProducto(productoForm({codigo:'MUE-GEN-2610-###',codigo_automatico:1,categoria:'Muebles'}));
 const rows=(await db.query<Row>("select codigo from inventario_productos where codigo like 'MUE-GEN-%' order by codigo")).rows;
 expect(rows.map(r=>r.codigo)).toEqual(['MUE-GEN-2610-001','MUE-GEN-2610-002']);
 expect(await count('inventario_movimientos')).toBe(2);expect(await count('operaciones_financieras_seguras')).toBe(2);expect(await cash()).toBe(0);
});
test('código automático: respeta un código manual 999 y no trunca la siguiente secuencia',async()=>{
 await actions.createInventarioProducto(productoForm({codigo:'MUE-GEN-2610-999'}));
 await actions.createInventarioProducto(productoForm({codigo:'MUE-GEN-2610-###',codigo_automatico:1}));
 expect(await num("select count(*) n from inventario_productos where codigo='MUE-GEN-2610-999'")).toBe(1);
 expect(await num("select count(*) n from inventario_productos where codigo='MUE-GEN-2610-1000'")).toBe(1);
});
test('código automático: una plantilla alterada no deja filas ni recibos',async()=>{
 await expect(actions.createInventarioProducto(productoForm({codigo:'CODIGO-MANUAL',codigo_automatico:1}))).rejects.toThrow();
 expect(await count('inventario_productos')).toBe(1);expect(await count('inventario_movimientos')).toBe(0);expect(await count('operaciones_financieras_seguras')).toBe(0);
});
test('INV-ALTA-01: fallo del Kardex no deja un producto sin sus existencias iniciales',async()=>{
 await db.exec("set auditoria.fallo_stock_update='si'");
 await expect(actions.createInventarioProducto(productoForm())).rejects.toThrow();
 expect(await count('inventario_productos')).toBe(1);expect(await count('inventario_movimientos')).toBe(0);
});
test('INV-ALTA-02: respuesta perdida y reintento conservan una sola entrada y stock 110',async()=>{
 const f=movimientoForm();loseTableResponse='inventario_movimientos';loseRpcResponse=true;
 await expect(actions.createInventarioMovimiento(f)).rejects.toThrow();
 await actions.createInventarioMovimiento(f);
 expect(await count('inventario_movimientos')).toBe(1);expect(await num('select stock_actual n from inventario_productos')).toBe(110);expect(await cash()).toBe(0);
});
test('CAT-01: compartir nombre no permite reemplazar la foto de otro producto',async()=>{
 await db.query("update inventario_productos set categoria='Muebles',foto_url='original.jpg' where id=$1",[producto]);
 const segundo=crypto.randomUUID();await db.query("insert into inventario_productos(id,organization_id,codigo,nombre,categoria,unidad,stock_actual,foto_url)values($1,$2,'AUD-OTRO','Madera ficticia','Materiales','unidad',20,'otro.jpg')",[segundo,org]);
 await actions.updateMuebleCatalogo(form({id:producto,precio_lista:500,descripcion:'Precio actualizado',foto_url:'nueva.jpg'}));
 expect((await db.query<Row>('select foto_url from inventario_productos where id=$1',[segundo])).rows[0].foto_url).toBe('otro.jpg');
});

test('INV-ALTA-01: alta completa y reintento tras perder respuesta conservan producto, Kardex y stock',async()=>{
 const f=productoForm({categoria:'Muebles'});loseRpcResponse=true;
 await expect(actions.createInventarioProducto(f)).rejects.toThrow();await actions.createInventarioProducto(f);
 const id=String(f.get('submission_id'));expect(await count('inventario_productos')).toBe(2);
 expect(await count('inventario_movimientos')).toBe(1);expect(await num("select stock_actual n from inventario_productos where codigo='AUD-NUEVO'")).toBe(10);
 expect((await db.query<Row>('select stock_disponible from muebles_catalogo where id=$1',[id])).rows[0].stock_disponible).toBe('10');
 expect(await cash()).toBe(0);
});
test('INV-ALTA-02: cambiar cantidad del mismo envío se rechaza y otro envío legítimo se acepta',async()=>{
 const f=movimientoForm();await actions.createInventarioMovimiento(f);f.set('cantidad','20');
 await expect(actions.createInventarioMovimiento(f)).rejects.toThrow('otros datos');
 f.set('submission_id',crypto.randomUUID());await actions.createInventarioMovimiento(f);
 expect(await count('inventario_movimientos')).toBe(2);expect(await num('select stock_actual n from inventario_productos')).toBe(130);
});
test('INV-ALTA-01: un código ocupado no deja otra carga inicial',async()=>{
 const f=productoForm({codigo:'AUD-01'});await expect(actions.createInventarioProducto(f)).rejects.toThrow();
 expect(await count('inventario_productos')).toBe(1);expect(await count('inventario_movimientos')).toBe(0);
});
test.each([{stock_inicial:'-5'},{stock_inicial:'invalido'},{costo_unitario:'-1'},{costo_unitario:'abc'}])('INV-ALTA-01: rechaza stock o costo inválidos antes de guardar %j',async datos=>{
 await expect(actions.createInventarioProducto(productoForm(datos))).rejects.toThrow('inválidos');expect(traces).toEqual([]);
});
test('INV-ALTA-02: stock insuficiente y fechas inválidas no dejan movimiento ni alteran existencias',async()=>{
 await expect(actions.createInventarioMovimiento(movimientoForm({tipo:'salida_venta',cantidad:101}))).rejects.toThrow('Stock insuficiente');
 await expect(actions.createInventarioMovimiento(movimientoForm({fecha:'2026-02-30'}))).rejects.toThrow('inválidos');
 expect(await count('inventario_movimientos')).toBe(0);expect(await num('select stock_actual n from inventario_productos')).toBe(100);
});
test('INV-ALTA-02: un producto de otra empresa se rechaza',async()=>{
 await db.query('update inventario_productos set organization_id=$1 where id=$2',[crypto.randomUUID(),producto]);
 await expect(actions.createInventarioMovimiento(movimientoForm())).rejects.toThrow('esta empresa');expect(await count('inventario_movimientos')).toBe(0);
});
test('INV-ALTA-02: fallo del marcador de reintento revierte movimiento y existencias',async()=>{
 await db.exec("create function fallo_recibo_inventario() returns trigger language plpgsql as $$begin raise exception 'Fallo de recibo solo ficticio';end$$;create trigger fallo_recibo_inventario before insert on operaciones_financieras_seguras for each row execute function fallo_recibo_inventario();");
 try{await expect(actions.createInventarioMovimiento(movimientoForm())).rejects.toThrow();
 expect(await count('inventario_movimientos')).toBe(0);expect(await num('select stock_actual n from inventario_productos')).toBe(100);
 }finally{await db.exec('drop trigger fallo_recibo_inventario on operaciones_financieras_seguras;drop function fallo_recibo_inventario()');}
});
test('CAT-01: fallo de foto compartida no confirma un precio parcial ni cambia costo',async()=>{
 await db.query("update inventario_productos set categoria='Muebles',costo_unitario=25 where id=$1",[producto]);
 const antes=(await db.query<Row>('select precio_lista from muebles_catalogo where id=$1',[producto])).rows[0].precio_lista;
 await db.exec("set auditoria.fallo_stock_update='si'");
 await expect(actions.updateMuebleCatalogo(form({id:producto,precio_lista:500,descripcion:'Ficticia',foto_url:'nueva.jpg'}))).rejects.toThrow();
 expect((await db.query<Row>('select precio_lista from muebles_catalogo where id=$1',[producto])).rows[0].precio_lista).toBe(antes);
 expect(await num('select costo_unitario n from inventario_productos')).toBe(25);
});
test('CAT-01: mueble inexistente no informa éxito',async()=>{
 await expect(actions.updateMuebleCatalogo(form({id:crypto.randomUUID(),precio_lista:500,descripcion:'Ficticia',foto_url:'nueva.jpg'}))).rejects.toThrow('no encontrado');
});
test('RPC de Inventario: permisos efectivos y acceso exclusivo del servidor',async()=>{
 await db.query("update perfiles set ui_role='readonly' where user_id=$1",[actor]);
 await expect(actions.createInventarioMovimiento(movimientoForm())).rejects.toThrow('No autorizado');
 expect(await count('inventario_movimientos')).toBe(0);
 for(const rpc of ['registrar_alta_inventario_segura(uuid,uuid,text,uuid,jsonb)','editar_mueble_catalogo_seguro(uuid,uuid,uuid,jsonb)']){
  expect((await db.query<Row>("select has_function_privilege('anon',$1,'EXECUTE') permitido",[rpc])).rows[0].permitido).toBe(false);
  expect((await db.query<Row>("select has_function_privilege('authenticated',$1,'EXECUTE') permitido",[rpc])).rows[0].permitido).toBe(false);
 }
});
