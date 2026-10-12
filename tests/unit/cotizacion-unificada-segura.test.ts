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
const functions=new Set(['registrar_operacion_integral','crear_compra_madera_con_caja','consultar_cobro_cotizacion','registrar_cobro_cotizacion_seguro','corregir_venta_madera_cortada_historica','eliminar_movimiento_inventario_seguro','eliminar_producto_inventario_seguro','editar_producto_inventario_seguro','registrar_conteo_inventario_seguro','editar_cotizacion_unificada_segura','registrar_servicio_integral','aprobar_cotizacion_con_adelanto','registrar_cotizacion_rapida_segura','eliminar_cotizacion_mueble_segura','registrar_cotizacion_unificada_segura']);
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

// Regresiones: exigen el resultado corregido con datos ficticios y sin red.
const otroCliente='20000000-0000-4000-8000-000000000002';
const empleado='70000000-0000-4000-8000-000000000001';
const nuevoInput=()=>{const {id,...nuevo}=cotInput();void id;return {...nuevo,submissionId:crypto.randomUUID()};};
beforeAll(async()=>{
 await db.exec(`alter table cotizaciones_unificadas alter column id set default gen_random_uuid();
 alter table ordenes_produccion add column updated_at timestamptz;
 create table empleados(id uuid primary key,organization_id uuid,nombre text,activo boolean default true);
 create table adelantos(id uuid primary key default gen_random_uuid(),organization_id uuid,
 empleado_id uuid not null references empleados(id) on delete restrict,fecha date,monto numeric(12,2) not null check(monto>0),estado text default 'pendiente');`);
});
beforeEach(async()=>{
 await db.exec('truncate adelantos,empleados cascade');
 await db.query("insert into empleados(id,organization_id,nombre)values($1,$2,'Empleado ficticio')",[empleado,org]);
});

import { cotizacionUnificadaAprobable, presentacionCotizacionProduccion } from '@/lib/cotizacion-produccion';
const aprobar=(id=cot,adelanto=300)=>actions.aprobarCotizacionAOrden(form({cotizacion_id:id,adelanto,metodo_adelanto:'yape',notas:''}));
const acepta=()=>db.query("update cotizaciones_unificadas set estado_flujo='lista_produccion' where id=$1",[cot]);

test('UNI-01: respuesta perdida y reintento conservan una cotización y cero cobros',async()=>{
 await db.query('delete from cotizaciones_unificadas where id=$1',[cot]);const datos=nuevoInput();loseRpcResponse=true;
 expect((await actions.saveCotizacionUnificada(datos)).ok).toBe(false);expect(await count('cotizaciones_unificadas')).toBe(1);
 const respuesta=await actions.saveCotizacionUnificada(datos);expect(respuesta).toEqual({ok:true,id:datos.submissionId});
 expect(await count('cotizaciones_unificadas')).toBe(1);expect(await num('select sum(total) n from cotizaciones_unificadas')).toBe(1000);
 expect(await cash()).toBe(0);expect(await count('operaciones_financieras_seguras')).toBe(1);
});
test('UNI-01: cambiar datos del mismo envío no modifica ni duplica lo ya guardado',async()=>{
 await db.query('delete from cotizaciones_unificadas where id=$1',[cot]);const datos=nuevoInput();expect((await actions.saveCotizacionUnificada(datos)).ok).toBe(true);
 expect(await actions.saveCotizacionUnificada({...datos,fecha:'2026-10-12'})).toMatchObject({ok:false,error:expect.stringMatching(/otros datos/)});
 expect(await count('cotizaciones_unificadas')).toBe(1);expect(await cash()).toBe(0);
});
test('UNI-01: dos envíos legítimos idénticos con claves diferentes conservan dos documentos',async()=>{
 await db.query('delete from cotizaciones_unificadas where id=$1',[cot]);const datos=nuevoInput();
 expect((await actions.saveCotizacionUnificada(datos)).ok).toBe(true);
 expect((await actions.saveCotizacionUnificada({...datos,submissionId:crypto.randomUUID()})).ok).toBe(true);
 expect(await count('cotizaciones_unificadas')).toBe(2);expect(await cash()).toBe(0);
});
test('UNI-01: editar tras recibir el ID conserva un documento y su importe recalculado',async()=>{
 await db.query('delete from cotizaciones_unificadas where id=$1',[cot]);const datos=nuevoInput(),r=await actions.saveCotizacionUnificada(datos);
 if(!r.ok)throw Error(r.error);expect((await actions.saveCotizacionUnificada({...datos,id:r.id})).ok).toBe(true);
 expect(await count('cotizaciones_unificadas')).toBe(1);expect(await cash()).toBe(0);
});
test.each(['cobrada','en_produccion','inventado'])('UNI-02: el alta rechaza estado alterado %s antes de escribir',async estadoFlujo=>{
 await db.query('delete from cotizaciones_unificadas where id=$1',[cot]);const datos={...nuevoInput(),estadoFlujo} as unknown as Parameters<typeof actions.saveCotizacionUnificada>[0];
 expect((await actions.saveCotizacionUnificada(datos)).ok).toBe(false);expect(await count('cotizaciones_unificadas')).toBe(0);expect(traces).toHaveLength(0);expect(await cash()).toBe(0);
});
test('UNI-02: el RPC también rechaza cobrada aunque se invoque sin la acción',async()=>{
 await expect(db.query('select registrar_cotizacion_unificada_segura($1,$2,$3,$4)',[org,actor,crypto.randomUUID(),JSON.stringify({cliente_id:cliente,tipo_cliente:'natural',fecha:'2026-10-11',estado_flujo:'cobrada',total:1000,detalle:{}})])).rejects.toThrow(/alta no puede registrar un cobro/);
 expect(await count('operaciones_financieras_seguras')).toBe(0);expect(await cash()).toBe(0);
});
test.each([{fecha:'2026-02-30'},{tipoCliente:'otro'},{clienteId:'invalido'},{submissionId:undefined}])('UNI: identidad, fecha y clave inválidas se rechazan: %j',async patch=>{
 const datos={...nuevoInput(),...patch} as Parameters<typeof actions.saveCotizacionUnificada>[0];
 expect((await actions.saveCotizacionUnificada(datos)).ok).toBe(false);expect(traces).toHaveLength(0);
});
test('UNI-04: no se crea un documento con cliente de otra empresa',async()=>{
 await db.query('delete from cotizaciones_unificadas where id=$1',[cot]);
 await db.query("insert into clientes(id,organization_id,nombre) values($1,'00000000-0000-0000-0000-000000000002','Ajeno ficticio')",[otroCliente]);
 expect(await actions.saveCotizacionUnificada({...nuevoInput(),clienteId:otroCliente})).toMatchObject({ok:false,error:expect.stringMatching(/Cliente no encontrado/)});
 expect(await count('cotizaciones_unificadas')).toBe(0);expect(await count('operaciones_financieras_seguras')).toBe(0);
});
test('UNI-03: cliente vinculado a orden y adelanto no se cambia; importe y saldo se conservan',async()=>{
 await acepta();await aprobar();await db.query("insert into clientes(id,organization_id,nombre)values($1,$2,'Segundo ficticio')",[otroCliente,org]);
 expect(await actions.saveCotizacionUnificada({...cotInput(),clienteId:otroCliente})).toMatchObject({ok:false,error:expect.stringMatching(/cambiar el cliente/)});
 expect((await db.query<Row>('select cliente_id from cotizaciones_unificadas where id=$1',[cot])).rows[0].cliente_id).toBe(cliente);
 expect((await db.query<Row>('select cliente_id from ordenes_produccion')).rows[0].cliente_id).toBe(cliente);
 expect(await cash()).toBe(300);expect(await num(`select 1000-cobrado_cotizacion('${org}','${cot}',true) n`)).toBe(700);
 expect((await actions.saveCotizacionUnificada({...cotInput(),fecha:'2026-10-12'})).ok).toBe(true);
});
test('UNI-03: orden sin adelanto también protege al cliente',async()=>{
 await acepta();await aprobar(cot,0);await db.query("insert into clientes(id,organization_id,nombre)values($1,$2,'Segundo ficticio')",[otroCliente,org]);
 expect((await actions.saveCotizacionUnificada({...cotInput(),clienteId:otroCliente})).ok).toBe(false);expect(await cash()).toBe(0);
});
test('UNI-03: un movimiento directo incluso anulado conserva la atribución del cliente',async()=>{
 await acepta();await db.query("insert into movimientos_caja(organization_id,referencia_id,fecha,tipo,medio,categoria,monto,modulo_origen,voided_at)values($1,$2,'2026-10-11','ingreso','yape','cotizacion_unificada',100,'cotizacion_unificada',now())",[org,cot]);
 await db.query("insert into clientes(id,organization_id,nombre)values($1,$2,'Segundo ficticio')",[otroCliente,org]);
 expect((await actions.saveCotizacionUnificada({...cotInput(),clienteId:otroCliente})).ok).toBe(false);expect(await cash()).toBe(0);
});
test('UNI-03: se puede cambiar el cliente antes de tener orden o cobros',async()=>{
 await db.query("update cotizaciones_unificadas set estado_flujo='pendiente' where id=$1",[cot]);
 await db.query("insert into clientes(id,organization_id,nombre)values($1,$2,'Segundo ficticio')",[otroCliente,org]);
 expect((await actions.saveCotizacionUnificada({...cotInput(),clienteId:otroCliente})).ok).toBe(true);
 expect((await db.query<Row>('select cliente_id from cotizaciones_unificadas')).rows[0].cliente_id).toBe(otroCliente);expect(await cash()).toBe(0);
});
test('PER-01: respuesta perdida del adelanto y reintento conservan S/150 pendientes y Caja cero',async()=>{
 const datos=form({submission_id:crypto.randomUUID(),empleado_id:empleado,fecha:'2026-10-11',monto:150});loseTableResponse='adelantos';
 await expect(actions.createAdelanto(datos)).rejects.toThrow(/perdida/);expect(await count('adelantos')).toBe(1);
 await actions.createAdelanto(datos);expect(await count('adelantos')).toBe(1);expect(await num('select sum(monto) n from adelantos')).toBe(150);expect(await cash()).toBe(0);
});
test('PER-01: reutilizar clave con importe distinto se rechaza y un nuevo envío sigue siendo válido',async()=>{
 const clave=crypto.randomUUID(),datos={submission_id:clave,empleado_id:empleado,fecha:'2026-10-11',monto:150};await actions.createAdelanto(form(datos));
 await expect(actions.createAdelanto(form({...datos,monto:151}))).rejects.toThrow(/no coincide/);
 expect(await count('adelantos')).toBe(1);await actions.createAdelanto(form({...datos,submission_id:crypto.randomUUID()}));expect(await count('adelantos')).toBe(2);expect(await cash()).toBe(0);
});
test('PER-01: un formulario antiguo sin clave no guarda adelanto',async()=>{
 await expect(actions.createAdelanto(form({empleado_id:empleado,fecha:'2026-10-11',monto:150}))).rejects.toThrow(/abrir el formulario/);expect(await count('adelantos')).toBe(0);
});
test('PRO-01: cotización pagada genera solo la orden y conserva el cobro y estado',async()=>{
 await acepta();expect((await actions.registrarCobroCotizacionUnificada(cot,{medio:'yape',totalEsperado:1000,saldoEsperado:1000})).ok).toBe(true);
 await aprobar(cot,0);expect(await count('ordenes_produccion')).toBe(1);expect(await count('movimientos_caja')).toBe(1);expect(await cash()).toBe(1000);
 expect((await db.query<Row>('select estado_flujo from cotizaciones_unificadas')).rows[0].estado_flujo).toBe('cobrada');
 await expect(aprobar(cot,0)).rejects.toThrow(/ya tiene una orden/);expect(await cash()).toBe(1000);
});
test.each([0,1])('PRO-01: cobrada sin pago real no puede generar orden, adelanto=%s',async adelanto=>{
 await db.query("update cotizaciones_unificadas set estado_flujo='cobrada' where id=$1",[cot]);
 await expect(aprobar(cot,adelanto)).rejects.toThrow(/pago completo verificado/);expect(await count('ordenes_produccion')).toBe(0);expect(await cash()).toBe(0);
});
test('PRO-01: pagada no admite un adelanto adicional',async()=>{
 await acepta();await actions.registrarCobroCotizacionUnificada(cot,{medio:'yape',totalEsperado:1000,saldoEsperado:1000});
 await expect(aprobar(cot,1)).rejects.toThrow(/adelanto cero/);expect(await count('ordenes_produccion')).toBe(0);expect(await cash()).toBe(1000);
});
test('PRO-01: las opciones excluyen pendientes y documentos con orden',()=>{
 expect(cotizacionUnificadaAprobable('pendiente',false)).toBe(false);expect(cotizacionUnificadaAprobable('lista_produccion',false)).toBe(true);
 expect(cotizacionUnificadaAprobable('en_produccion',false)).toBe(true);expect(cotizacionUnificadaAprobable('cobrada',false)).toBe(true);
 expect(cotizacionUnificadaAprobable('cobrada',true)).toBe(false);expect(cotizacionUnificadaAprobable('inactivo',false)).toBe(false);
});
test('PRO-02: la presentación sigue la orden entregada sin cambiar Caja ni el estado de cobro',async()=>{
 await acepta();await aprobar();const id=(await db.query<Row>('select id from ordenes_produccion')).rows[0].id;
 await actions.cambiarEstadoOrden(form({orden_id:id,nuevo_estado:'entregado'}));
 const estado=String((await db.query<Row>('select estado_flujo from cotizaciones_unificadas')).rows[0].estado_flujo);
 const fase=String((await db.query<Row>('select estado from ordenes_produccion')).rows[0].estado);
 expect(presentacionCotizacionProduccion(estado,fase)).toEqual({estado:'entregado',produccion:null});expect(await cash()).toBe(300);
 expect(presentacionCotizacionProduccion('cobrada',fase)).toEqual({estado:'cobrada',produccion:'Orden: entregado'});
 expect(presentacionCotizacionProduccion('deudor',fase).estado).toBe('deudor');
});
test('LAT-01: la acción antigua se rechaza sin escribir ni cambiar estado',async()=>{
 await acepta();expect(await actions.pasarCotizacionAProduccion(cot)).toMatchObject({ok:false,error:expect.stringMatching(/Aprobar/)});
 expect(traces).toHaveLength(0);expect(await count('ordenes_produccion')).toBe(0);expect(await cash()).toBe(0);
 expect((await db.query<Row>('select estado_flujo from cotizaciones_unificadas')).rows[0].estado_flujo).toBe('lista_produccion');
});

test('el guardado completo revierte cotización y recibo si falla la segunda escritura',async()=>{
 await db.query('delete from cotizaciones_unificadas where id=$1',[cot]);
 await db.exec("create function fallo_recibo_ficticio() returns trigger language plpgsql as $$begin if new.tipo='cotizacion_unificada' then raise exception 'Fallo de recibo ficticio';end if;return new;end$$;create trigger fallo_recibo before insert on operaciones_financieras_seguras for each row execute function fallo_recibo_ficticio();");
 try {expect((await actions.saveCotizacionUnificada(nuevoInput())).ok).toBe(false);expect(await count('cotizaciones_unificadas')).toBe(0);expect(await count('operaciones_financieras_seguras')).toBe(0);}
 finally {await db.exec('drop trigger fallo_recibo on operaciones_financieras_seguras;drop function fallo_recibo_ficticio();');}
});
test('la migración conserva los documentos anteriores sin reconciliarlos',async()=>{
 const antes=(await db.query<Row>('select * from cotizaciones_unificadas')).rows;
 await db.exec(readFileSync('supabase/migrations/20261011040000_cotizacion_unificada_segura.sql','utf8'));
 expect((await db.query<Row>('select * from cotizaciones_unificadas')).rows).toEqual(antes);expect(await cash()).toBe(0);
});
test('el RPC nuevo solo admite ejecución del servidor, con actor autorizado',async()=>{
 for(const role of ['anon','authenticated'])expect((await db.query<Row>("select has_function_privilege($1,'public.registrar_cotizacion_unificada_segura(uuid,uuid,uuid,jsonb)','execute') allowed",[role])).rows[0].allowed).toBe(false);
 const input=nuevoInput();mocks.auth.mockResolvedValue({userId:actor,organizationId:org,role:'owner_admin',uiRole:'readonly'});
 expect((await actions.saveCotizacionUnificada(input)).ok).toBe(false);expect(traces).toHaveLength(0);
});
