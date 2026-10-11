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
const functions=new Set(['registrar_operacion_integral','crear_compra_madera_con_caja','consultar_cobro_cotizacion','registrar_cobro_cotizacion_seguro','corregir_venta_madera_cortada_historica','eliminar_movimiento_inventario_seguro','eliminar_producto_inventario_seguro','editar_producto_inventario_seguro','registrar_conteo_inventario_seguro','editar_cotizacion_unificada_segura','registrar_servicio_integral','aprobar_cotizacion_con_adelanto','registrar_cotizacion_rapida_segura','eliminar_cotizacion_mueble_segura']);
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
const cash=()=>num("select coalesce(sum(case when tipo='ingreso' then monto else -monto end),0) n from movimientos_caja where voided_at is null and deleted_at is null");
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
 await db.exec(readFileSync('tests/unit/fixtures/finanzas-cotizacion-rapida.sql','utf8'));
 await db.exec(readFileSync('supabase/migrations/20261011030000_cotizacion_rapida_segura.sql','utf8'));
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

const rapida = (id=crypto.randomUUID(), patch:Row={}) => actions.createCotizacion(form({submission_id:id,cliente_id:cliente,
 fecha:'2026-10-11',tipo:'mueble_personalizado',especie_madera:'Tornillo ficticio',unidad_medida:'cm',
 precio_calculado:1000,precio_acordado:1000,motivo_ajuste:'',estado:'confirmada',...patch}));
const inactivar = () => db.query("update clientes set estado='inactivo' where id=$1",[cliente]);
const idRapida = async()=>String((await db.query<Row>('select id from cotizaciones_mueble')).rows[0].id);
const aprobar = (id:string,adelanto=300)=>actions.aprobarCotizacionAOrden(form({cotizacion_id:id,adelanto,metodo_adelanto:'yape',notas:''}));

test.each(['confirmada','borrador'])('RAP-01: cotización rápida %s conserva el precio sin cobrarlo',async estado=>{
 await rapida(crypto.randomUUID(),{estado});expect(await count('cotizaciones_mueble')).toBe(1);expect(await cash()).toBe(0);
 const row=(await db.query<Row>('select * from cotizaciones_mueble')).rows[0];
 expect(Number(row.precio_acordado)).toBe(1000);expect(row.estado).toBe(estado);expect(await count('movimientos_caja')).toBe(0);
});
test('RAP-01: aprobación cobra solo el adelanto real y conserva S/700 por recibir',async()=>{
 await rapida();const id=await idRapida();await aprobar(id);
 expect(await count('ordenes_produccion')).toBe(1);expect(await cash()).toBe(300);expect(await count('movimientos_caja')).toBe(1);
 const row=(await db.query<Row>('select medio,referencia_id from movimientos_caja')).rows[0];
 expect(row.medio).toBe('yape');expect(row.referencia_id).toBe((await db.query<Row>('select id from ordenes_produccion')).rows[0].id);
 expect(await num(`select 1000-cobrado_cotizacion('${org}','${id}',false) n`)).toBe(700);
});
test('RAP-02: perder la respuesta confirmada y reintentar conserva una cotización y cero ingresos',async()=>{
 const id=crypto.randomUUID();loseRpcResponse=true;await expect(rapida(id)).rejects.toThrow(/perdida/);
 expect(await count('cotizaciones_mueble')).toBe(1);await rapida(id);
 expect(await count('cotizaciones_mueble')).toBe(1);expect(await cash()).toBe(0);expect(await count('operaciones_financieras_seguras')).toBe(1);
});
test('RAP-02: dos peticiones del mismo envío guardan solo una cotización',async()=>{
 const id=crypto.randomUUID();await Promise.all([rapida(id),rapida(id)]);
 expect(await count('cotizaciones_mueble')).toBe(1);expect(await count('operaciones_financieras_seguras')).toBe(1);
});
test('RAP-02: clave repetida con distinto precio no cambia el primer guardado',async()=>{
 const id=crypto.randomUUID();await rapida(id);await expect(rapida(id,{precio_acordado:900})).rejects.toThrow(/otros datos/);
 expect(await num('select precio_acordado n from cotizaciones_mueble')).toBe(1000);expect(await cash()).toBe(0);
});
test('pedidos distintos pueden tener los mismos datos sin fusionarse',async()=>{
 await rapida();await rapida();expect(await count('cotizaciones_mueble')).toBe(2);expect(await cash()).toBe(0);
});
test('sin clave de envío se rechaza antes de escribir',async()=>{
 await expect(rapida('',{})).rejects.toThrow(/Actualiza/);expect(await count('cotizaciones_mueble')).toBe(0);
});
test('cliente de otra empresa no recibe una cotización',async()=>{
 await db.query("update clientes set organization_id='00000000-0000-0000-0000-000000000002' where id=$1",[cliente]);
 await expect(rapida()).rejects.toThrow(/esta empresa/);expect(await count('cotizaciones_mueble')).toBe(0);
});
test.each(['readonly',null])('el SQL rechaza una cuenta de lectura %s aunque conserve rol heredado',async ui=>{
 await db.query('update perfiles set role=$1,ui_role=$2 where user_id=$3',[ui?'owner_admin':'partner_readonly',ui,actor]);
 await expect(rapida()).rejects.toThrow(/No autorizado/);expect(await count('cotizaciones_mueble')).toBe(0);
});
test('operaciones usa el rol efectivo para registrar una cotización',async()=>{
 await db.query("update perfiles set role='partner_readonly',ui_role='operaciones' where user_id=$1",[actor]);
 await rapida();expect(await count('cotizaciones_mueble')).toBe(1);expect(await cash()).toBe(0);
});
test('un fallo al guardar el recibo revierte también la cotización',async()=>{
 await db.exec(`create function fallo_recibo_rapida() returns trigger language plpgsql as $$begin raise exception 'Recibo ficticio fallido';end$$;
  create trigger fallo_recibo_rapida before insert on operaciones_financieras_seguras for each row execute function fallo_recibo_rapida();`);
 try{await expect(rapida()).rejects.toThrow(/Recibo ficticio/);expect(await count('cotizaciones_mueble')).toBe(0);expect(await cash()).toBe(0);}
 finally{await db.exec('drop trigger fallo_recibo_rapida on operaciones_financieras_seguras;drop function fallo_recibo_rapida();');}
});
test('RAP-03: una cotización antigua con cobro activo conserva documento y Caja al intentar borrarla',async()=>{
 await rapida();const id=await idRapida();await inactivar();
 await db.query("insert into movimientos_caja(organization_id,fecha,tipo,medio,categoria,monto,modulo_origen,referencia_id)values($1,'2026-10-11','ingreso','efectivo','servicio_corte_mueble',1000,'muebles_corte',$2)",[org,id]);
 const result=await actions.deleteCotizacionMueblePersonalizada(id);expect(result.ok).toBe(false);expect('error' in result&&result.error).toMatch(/movimientos en Caja/);
 expect(await count('cotizaciones_mueble')).toBe(1);expect(await cash()).toBe(1000);
});
test.each(['voided_at','deleted_at'])('una cotización con cobro histórico %s conserva su origen',async campo=>{
 await rapida();const id=await idRapida();await inactivar();
 await db.query(`insert into movimientos_caja(organization_id,fecha,tipo,medio,categoria,monto,modulo_origen,referencia_id,${campo})values($1,'2026-10-11','ingreso','yape','adelanto',100,'muebles_corte',$2,now())`,[org,id]);
 expect((await actions.deleteCotizacionMueblePersonalizada(id)).ok).toBe(false);expect(await count('cotizaciones_mueble')).toBe(1);expect(await count('movimientos_caja')).toBe(1);
});
test('orden vinculada conserva la cotización aunque el adelanto sea cero',async()=>{
 await rapida();const id=await idRapida();await inactivar();await aprobar(id,0);
 expect((await actions.deleteCotizacionMueblePersonalizada(id)).ok).toBe(false);expect(await count('ordenes_produccion')).toBe(1);
});
test('cliente activo conserva la regla habitual de borrado',async()=>{
 await rapida();const result=await actions.deleteCotizacionMueblePersonalizada(await idRapida());expect(result.ok).toBe(false);
 expect('error' in result&&result.error).toMatch(/cliente está activo/);expect(await count('cotizaciones_mueble')).toBe(1);
});
test('sin orden ni movimientos, un cliente inactivo permite borrar cotización y cortes',async()=>{
 await rapida();const id=await idRapida();await inactivar();await db.query('insert into cotizacion_cortes(cotizacion_id)values($1)',[id]);
 expect(await actions.deleteCotizacionMueblePersonalizada(id)).toEqual({ok:true});expect(await count('cotizaciones_mueble')).toBe(0);expect(await count('cotizacion_cortes')).toBe(0);
 await expect(rapida(id)).rejects.toThrow(/ya fue eliminada/);expect(await count('cotizaciones_mueble')).toBe(0);
});
test('un fallo al borrar cortes conserva cotización y sus filas',async()=>{
 await rapida();const id=await idRapida();await inactivar();await db.query('insert into cotizacion_cortes(cotizacion_id)values($1)',[id]);
 await db.exec(`create function fallo_borrado_corte() returns trigger language plpgsql as $$begin raise exception 'Borrado ficticio fallido';end$$;
 create trigger fallo_borrado_corte before delete on cotizacion_cortes for each row execute function fallo_borrado_corte();`);
 try{expect((await actions.deleteCotizacionMueblePersonalizada(id)).ok).toBe(false);expect(await count('cotizaciones_mueble')).toBe(1);expect(await count('cotizacion_cortes')).toBe(1);}
 finally{await db.exec('drop trigger fallo_borrado_corte on cotizacion_cortes;drop function fallo_borrado_corte();');}
});
test('el borrado no cruza empresas',async()=>{
 await rapida();const id=await idRapida();await inactivar();
 mocks.auth.mockResolvedValue({userId:actor,organizationId:'00000000-0000-0000-0000-000000000002',role:'owner_admin',uiRole:null});
 expect((await actions.deleteCotizacionMueblePersonalizada(id)).ok).toBe(false);expect(await count('cotizaciones_mueble')).toBe(1);
});
test('un servicio de corte confirmado conserva el cobro heredado, una sola vez por envío',async()=>{
 const id=crypto.randomUUID();await rapida(id,{tipo:'servicio_corte'});await rapida(id,{tipo:'servicio_corte'});
 expect(await count('cotizaciones_mueble')).toBe(1);expect(await cash()).toBe(1000);expect(await count('movimientos_caja')).toBe(1);
});
test('un servicio de corte en mes cerrado se rechaza sin documento ni recibo parciales',async()=>{
 await db.query('insert into cierres_mensuales(organization_id,anio,mes)values($1,2026,10)',[org]);
 await expect(rapida(crypto.randomUUID(),{tipo:'servicio_corte'})).rejects.toThrow(/cerrado/);
 expect(await count('cotizaciones_mueble')).toBe(0);expect(await count('operaciones_financieras_seguras')).toBe(0);expect(await cash()).toBe(0);
});
test('el borrado de una unificada con orden y adelanto conserva ambos',async()=>{
 await db.query("update cotizaciones_unificadas set estado_flujo='lista_produccion' where id=$1",[cot]);await aprobar(cot);
 expect((await actions.deleteCotizacionUnificada(cot)).ok).toBe(false);expect(await count('ordenes_produccion')).toBe(1);expect(await count('cotizaciones_unificadas')).toBe(1);expect(await cash()).toBe(300);
});
test('los RPC nuevos no permiten ejecución pública ni de usuarios directos',async()=>{
 for(const role of ['anon','authenticated'])for(const fn of ['registrar_cotizacion_rapida_segura(uuid,uuid,uuid,jsonb)','eliminar_cotizacion_mueble_segura(uuid,uuid,uuid)']) {
  expect((await db.query<Row>('select has_function_privilege($1,$2,\'EXECUTE\') permitido',[role,fn])).rows[0].permitido).toBe(false);
 }
});
