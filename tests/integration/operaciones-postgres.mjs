// Prueba opcional contra PostgreSQL real, en un directorio NUEVO y solo en loopback.
// No usa .env, credenciales remotas ni registros del negocio. No borra respaldos.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { execFile, execFileSync } from 'node:child_process';
import { promisify } from 'node:util';
import { randomUUID } from 'node:crypto';
const run = promisify(execFile), root = process.cwd();
const bin = path.resolve(process.argv[2] ?? 'temp/respaldos-seguros/herramientas/postgresql-17.11/pgsql/bin');
const work = path.join(root, 'temp', 'pruebas-operaciones-postgres', randomUUID());
const cluster = path.join(work, 'datos'), port = '56383', exe = name => path.join(bin, name + (process.platform === 'win32' ? '.exe' : ''));
fs.mkdirSync(work, { recursive: true });
const args = ['-X', '-qAt', '-h', '127.0.0.1', '-p', port, '-U', 'katia_pruebas', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1'];
const sql = q => execFileSync(exe('psql'), [...args, '-c', q], { encoding: 'utf8', windowsHide: true, timeout: 20000 }).trim();
const connection = async q => (await run(exe('psql'), [...args, '-c', q], { encoding: 'utf8', windowsHide: true, timeout: 20000 })).stdout.trim();
const org = '00000000-0000-0000-0000-000000000001', actor = '10000000-0000-4000-8000-000000000001';
const customer = '20000000-0000-4000-8000-000000000001', product = '30000000-0000-4000-8000-000000000001';
const literal = value => "'" + JSON.stringify(value).replaceAll("'", "''") + "'::jsonb";
const tables = ['clientes','proveedores','inventario_productos','muebles_catalogo','ventas_madera','ventas_madera_lineas',
 'inventario_movimientos','ventas_mueble_terminado','ventas_madera_cortada','servicios_aserradero','compras_madera','alquileres',
 'cotizaciones_unificadas','cotizaciones_mueble','ordenes_produccion','movimientos_caja','cierres_mensuales','operaciones_financieras_seguras'];
const results = [];
// Sincroniza las conexiones por bloqueos reales; el orden no depende de pausas
// o de la velocidad de arranque de psql en la computadora.
async function competing(firstSql, secondSql) {
 const marker=randomUUID(),firstName='primero-'+marker,secondName='segundo-'+marker;
 const capture=p=>p.then(value=>({status:'fulfilled',value}),reason=>({status:'rejected',reason}));
 const waitFor=async predicate=>{
   const end=Date.now()+15000;
   while(!predicate()){if(Date.now()>end)throw Error('No se confirmó el bloqueo concurrente');await new Promise(resolve=>setTimeout(resolve,25));}
 };
 const first=capture(connection(`set application_name='${firstName}';begin;${firstSql}
 do $$declare limite timestamptz:=clock_timestamp()+interval '20 seconds';begin
 while not exists(select 1 from prueba_sincronizacion where id='${marker}') loop
 if clock_timestamp()>limite then raise exception 'Espera de prueba agotada';end if;perform pg_sleep(0.02);end loop;end $$;commit;`));
 let second;
 try {
   await waitFor(()=>sql(`select count(*) from pg_locks l join pg_stat_activity a on a.pid=l.pid where a.application_name='${firstName}' and l.locktype='advisory' and l.granted`)!=='0');
   second=capture(connection(`set application_name='${secondName}';${secondSql}`));
   await waitFor(()=>sql(`select count(*) from pg_locks l join pg_stat_activity a on a.pid=l.pid where a.application_name='${secondName}' and l.locktype='advisory' and not l.granted`)!=='0');
 } finally { sql(`insert into prueba_sincronizacion values('${marker}') on conflict do nothing;`); }
 return Promise.all([first,second]);
}
function reset(stock = 10) {
 sql(`truncate perfiles,${tables.join(',')} cascade;set auditoria.fallo_caja='no';set auditoria.fallo_categoria='';
 insert into perfiles(user_id,organization_id,role,ui_role) values('${actor}','${org}','owner_admin',null);
 insert into clientes(id,organization_id,nombre) values('${customer}','${org}','Cliente ficticio');
 insert into inventario_productos(id,organization_id,nombre,stock_actual,categoria)values('${product}','${org}','Tabla ficticia',${stock},'Madera');`);
}
function sale(id = randomUUID(), quantity = 8) {
 const document = { cliente_id: customer, fecha: '2026-10-10', total: quantity * 100, estado: 'confirmada',
   metodo_pago: 'yape', modalidad_pago: 'contado', adelanto: 0 };
 const stock = [{ producto_id: product, cantidad: quantity, costo_unitario: 100 }];
 const cash = { fecha: '2026-10-10', tipo: 'ingreso', medio: 'yape', categoria: 'venta_madera', monto: quantity * 100 };
 return `select registrar_operacion_integral('${org}','${actor}','venta_madera','${id}',${literal(document)},'[]',${literal(stock)},${literal(cash)});`;
}
let started = false;
try {
 execFileSync(exe('initdb'), ['-D', cluster, '-U', 'katia_pruebas', '-A', 'trust', '--encoding=UTF8', '--locale=C'], { windowsHide: true, timeout: 60000 });
 execFileSync(exe('pg_ctl'), ['-D', cluster, '-l', path.join(work, 'postgres.log'), '-o', '-h 127.0.0.1 -p ' + port, '-w', 'start'], { windowsHide: true, timeout: 30000, stdio: 'ignore' });
 started = true;
 for (const file of ['tests/unit/fixtures/finanzas.sql','tests/unit/fixtures/finanzas-heredado.sql',
   'supabase/migrations/20261010010000_cobros_y_cierres_seguros.sql','supabase/migrations/20261011010000_integridad_caja_stock_operaciones.sql',
   'tests/unit/fixtures/finanzas-adicional.sql','supabase/migrations/20261011020000_integridad_adicional_operaciones.sql',
   'tests/unit/fixtures/finanzas-cotizacion-rapida.sql','supabase/migrations/20261011030000_cotizacion_rapida_segura.sql',
   'supabase/migrations/20261011040000_cotizacion_unificada_segura.sql','supabase/migrations/20261011050000_altas_inventario_y_catalogo_seguros.sql']) {
   execFileSync(exe('psql'), [...args, '-f', path.join(root, file)], { windowsHide: true, timeout: 20000 });
 }
 sql(`create table prueba_sincronizacion(id text primary key);create extension pgcrypto;create schema app;create function app.current_role() returns text language sql as $$select 'owner_admin'::text$$;
 create table sueldos(organization_id uuid,periodo text,monto_neto numeric);
 create table auditoria_prueba(organization_id uuid,accion text,datos jsonb);
 create function log_audit_event(uuid,text,text,uuid,jsonb) returns void language sql as $$insert into auditoria_prueba values($1,$2,$5)$$;`);
 const view = fs.readFileSync(path.join(root, 'supabase/migrations/20261006233000_restantes_integridad.sql'), 'utf8')
   .split('create or replace view public.utilidad_mensual')[1].split('commit;')[0];
 sql('create or replace view public.utilidad_mensual' + view);
 reset();
 const doubleSale = await competing(sale(),sale());
 assert.equal(doubleSale.filter(r => r.status === 'fulfilled').length, 1);
 assert.equal(sql('select stock_actual from inventario_productos'), '2');
 assert.equal(sql('select count(*) from ventas_madera'), '1');
 assert.equal(sql('select sum(monto) from movimientos_caja'), '800.00');
 results.push('Stock diez: dos conexiones intentan vender ocho; una venta aceptada, stock dos y Caja 800.');
 reset(100); const nonce = randomUUID();
 assert((await competing(sale(nonce),sale(nonce))).every(r=>r.status==='fulfilled'));
 assert.equal(sql('select stock_actual from inventario_productos'), '92');
 assert.equal(sql('select count(*) from movimientos_caja'), '1');
 results.push('Dos conexiones reintentan la misma solicitud: una venta, una salida y un ingreso.');
 reset(100); await connection(sale());
 const closing = await competing(`select cerrar_mes('${org}',2026,10);`,sale());
 assert.equal(closing[0].status, 'fulfilled'); assert.equal(closing[1].status, 'rejected');
 assert.equal(sql('select count(*) from ventas_madera'), '1');
 assert.equal(sql("select reporte_json->>'ingresos' from cierres_mensuales"), '800.00');
 assert.equal(sql('select bool_and(periodo_cerrado) from movimientos_caja'), 't');
 assert.equal(sql("select count(*) from auditoria_prueba where accion='MONTH_CLOSE'"), '1');
 results.push('Cierre mensual real con vista y SHA-256: snapshot 800, movimiento marcado y escritura simultánea rechazada.');
 reset(100); await connection(sale());
 const id = sql('select id from ventas_madera');
 assert((await competing(`select anular_operacion_integral('${org}','${actor}','venta_madera','${id}');`,
   `select anular_operacion_integral('${org}','${actor}','venta_madera','${id}');`)).every(r=>r.status==='fulfilled'));
 assert.equal(sql('select stock_actual from inventario_productos'), '100');
 assert.equal(sql("select count(*) from inventario_movimientos where tipo='ajuste'"), '1');
 assert.equal(sql('select count(*) from movimientos_caja where voided_at is null'), '0');
 results.push('Dos anulaciones simultáneas: una devolución de stock y el cobro conservado como anulado.');
 reset(100);
 const manualA=randomUUID(),manualB=randomUUID();
 sql(`insert into inventario_movimientos(id,organization_id,producto_id,fecha,tipo,cantidad,referencia) values
 ('${manualA}','${org}','${product}','2026-10-11','entrada_compra',10,'Manual A'),('${manualB}','${org}','${product}','2026-10-11','entrada_compra',20,'Manual B');`);
 assert((await competing(`select eliminar_movimiento_inventario_seguro('${org}','${actor}','${manualA}');`,
   `select eliminar_movimiento_inventario_seguro('${org}','${actor}','${manualB}');`)).every(r=>r.status==='fulfilled'));
 assert.equal(sql('select stock_actual from inventario_productos'),'100');assert.equal(sql('select count(*) from inventario_movimientos'),'0');
 results.push('Dos borrados manuales con conexiones independientes revierten diez y veinte sin perder una devolución.');
 reset(100);
 const change=`insert into inventario_movimientos(organization_id,producto_id,fecha,tipo,cantidad,referencia)values('${org}','${product}','2026-10-11','entrada_compra',10,'Entrada concurrente');`;
 const staleCount=await competing(change,`select registrar_conteo_inventario_seguro('${org}','${actor}','${product}','2026-10-11',120,'Conteo ficticio',100);`);
 assert.equal(staleCount[0].status,'fulfilled');assert.equal(staleCount[1].status,'rejected');
 assert.equal(sql('select stock_actual from inventario_productos'),'110');assert.equal(sql('select sum(cantidad) from inventario_movimientos'),'10');
 results.push('Entrada concurrente y conteo anterior: conserva la entrada y rechaza el conteo desactualizado.');
 reset(100);
 assert((await competing(`select registrar_conteo_inventario_seguro('${org}','${actor}','${product}','2026-10-11',120,'Conteo ficticio',100);`,change)).every(r=>r.status==='fulfilled'));
 assert.equal(Number(sql('select stock_actual from inventario_productos')),130);assert.equal(Number(sql('select sum(cantidad) from inventario_movimientos')),30);
 results.push('Conteo seguido de entrada concurrente: stock ciento treinta y Kardex treinta, sin sobrescritura.');
 reset(100);
 const datos={codigo:'AUD-M',nombre:'Tabla renombrada',categoria:'Madera',unidad:'unidad',stock_minimo:0,stock_actual:100,foto_url:null,costo_unitario:null};
 assert((await competing(sale(randomUUID(),10),`select editar_producto_inventario_seguro('${org}','${actor}','${product}',${literal(datos)},100);`)).every(r=>r.status==='fulfilled'));
 assert.equal(sql('select stock_actual from inventario_productos'),'90');assert.equal(sql('select nombre from inventario_productos'),'Tabla renombrada');
 results.push('Editor de nombre y venta simultánea: conserva noventa unidades y el cambio de nombre.');
 for (const tipo of ['aserradero','alquiler']) {
   reset();const key=randomUUID();
   const documento=tipo==='aserradero'?{cliente_id:customer,fecha:'2026-10-11',precio_cobrado:1000,adelanto:0,modalidad_pago:'contado'}
     :{cliente_id:customer,fecha_inicio:'2026-10-11',estado:'abierto',monto_total:1000,deposito_30:300};
   const importe=tipo==='aserradero'?1000:300;
   const caja={fecha:'2026-10-11',tipo:'ingreso',medio:'yape',categoria:tipo,monto:importe};
   const q=`select registrar_servicio_integral('${org}','${actor}','${tipo}','${key}',${literal(documento)},${literal(caja)},false);`;
   assert((await competing(q,q)).every(r=>r.status==='fulfilled'));
   assert.equal(sql('select count(*) from '+(tipo==='aserradero'?'servicios_aserradero':'alquileres')),'1');
   assert.equal(sql('select count(*) from movimientos_caja'),'1');assert.equal(Number(sql('select sum(monto) from movimientos_caja')),importe);
   results.push('Dos envíos simultáneos de '+tipo+': un documento y un cobro.');
 }
 reset(); const quote=randomUUID();
 sql(`insert into cotizaciones_unificadas(id,organization_id,cliente_id,total,fecha,estado_flujo,detalle) values('${quote}','${org}','${customer}',1000,'2026-10-11','lista_produccion','{}');`);
 const cambios={cliente_id:customer,tipo_cliente:'natural',fecha:'2026-10-11',total:100,estado_flujo:'lista_produccion',detalle:{}};
 const paid=await competing(`select registrar_cobro_cotizacion_seguro('${org}','${actor}','${quote}',1000,1000,'yape','2026-10-11');`,
   `select editar_cotizacion_unificada_segura('${org}','${actor}','${quote}',${literal(cambios)},1000,'lista_produccion');`);
 assert.equal(paid[0].status,'fulfilled');assert.equal(paid[1].status,'rejected');assert.equal(sql('select total from cotizaciones_unificadas'),'1000');
 assert.equal(sql('select estado_flujo from cotizaciones_unificadas'),'cobrada');assert.equal(sql('select sum(monto) from movimientos_caja'),'1000.00');
 results.push('Cobro y edición simultáneos: conserva el total cobrado y rechaza el formulario anterior.');
 reset();const rapidKey=randomUUID();
 const rapidDocument={cliente_id:customer,fecha:'2026-10-11',tipo:'mueble_personalizado',especie_madera:'Ficticia',unidad_medida:'cm',
   precio_calculado:1000,precio_acordado:1000,motivo_ajuste:null,estado:'confirmada'};
 const rapidQuery=`select registrar_cotizacion_rapida_segura('${org}','${actor}','${rapidKey}',${literal(rapidDocument)});`;
 assert((await competing(rapidQuery,rapidQuery)).every(r=>r.status==='fulfilled'));
 assert.equal(sql('select count(*) from cotizaciones_mueble'),'1');assert.equal(sql('select count(*) from movimientos_caja'),'0');
 assert.equal(sql('select count(*) from operaciones_financieras_seguras'),'1');
 results.push('Dos conexiones envían la misma cotización rápida: un documento, un recibo y ningún ingreso automático.');
 const approveRapid=id=>`select aprobar_cotizacion_con_adelanto('${org}','${actor}','${id}',false,1000,300,'yape',
   ${literal({fecha_aprobacion:'2026-10-11',notas:null,correlativo:'RAP-01'})});`;
 const deleteRapid=id=>`select eliminar_cotizacion_mueble_segura('${org}','${actor}','${id}');`;
 sql(`update clientes set estado='inactivo' where id='${customer}';`);
 const deleteFirst=await competing(deleteRapid(rapidKey),approveRapid(rapidKey));
 assert.equal(deleteFirst[0].status,'fulfilled');assert.equal(deleteFirst[1].status,'rejected');
 assert.equal(sql('select count(*) from cotizaciones_mueble'),'0');assert.equal(sql('select count(*) from ordenes_produccion'),'0');
 assert.equal(sql('select count(*) from movimientos_caja'),'0');
 results.push('Borrado seguido de aprobación concurrente: elimina solo la cotización sin cobros y rechaza la aprobación, sin ingreso huérfano.');
 reset();const approvedKey=randomUUID();
 sql(`select registrar_cotizacion_rapida_segura('${org}','${actor}','${approvedKey}',${literal(rapidDocument)});
   update clientes set estado='inactivo' where id='${customer}';`);
 const approveFirst=await competing(approveRapid(approvedKey),deleteRapid(approvedKey));
 assert.equal(approveFirst[0].status,'fulfilled');assert.equal(approveFirst[1].status,'rejected');
 assert.equal(sql('select count(*) from cotizaciones_mueble'),'1');assert.equal(sql('select count(*) from ordenes_produccion'),'1');
 assert.equal(sql('select sum(monto) from movimientos_caja'),'300.00');
 results.push('Aprobación seguida de borrado concurrente: conserva cotización, orden y adelanto 300, sin separar su origen.');
 reset();const unifiedKey=randomUUID();
 const unifiedDocument={cliente_id:customer,tipo_cliente:'natural',fecha:'2026-10-11',total:1000,estado_flujo:'lista_produccion',detalle:{},correlativo:'UNIF-01'};
 const unifiedQuery=data=>`select registrar_cotizacion_unificada_segura('${org}','${actor}','${unifiedKey}',${literal(data)});`;
 assert((await competing(unifiedQuery(unifiedDocument),unifiedQuery({...unifiedDocument,correlativo:'UNIF-REINTENTO'}))).every(r=>r.status==='fulfilled'));
 assert.equal(sql('select count(*) from cotizaciones_unificadas'),'1');assert.equal(sql('select count(*) from operaciones_financieras_seguras'),'1');
 assert.equal(sql('select count(*) from movimientos_caja'),'0');
 results.push('Dos altas unificadas simultáneas con la misma clave: un documento, un recibo y Caja sin cobro automático.');
 const secondCustomer=randomUUID();sql(`insert into clientes(id,organization_id,nombre)values('${secondCustomer}','${org}','Segundo ficticio');`);
 const editUnified=data=>`select editar_cotizacion_unificada_segura('${org}','${actor}','${unifiedKey}',${literal(data)},1000,'lista_produccion');`;
 const approveUnified=`select aprobar_cotizacion_con_adelanto('${org}','${actor}','${unifiedKey}',true,1000,300,'yape',${literal({fecha_aprobacion:'2026-10-11',notas:null,correlativo:'OP-UNIF'})});`;
 const approvalVsClient=await competing(approveUnified,editUnified({...unifiedDocument,cliente_id:secondCustomer}));
 assert.equal(approvalVsClient[0].status,'fulfilled');assert.equal(approvalVsClient[1].status,'rejected');
 assert.equal(sql('select cliente_id from cotizaciones_unificadas'),customer);assert.equal(sql('select cliente_id from ordenes_produccion'),customer);
 assert.equal(sql('select sum(monto) from movimientos_caja'),'300.00');
 results.push('Aprobación antes de cambio de cliente concurrente: conserva cliente, orden y adelanto 300; rechaza el cambio desactualizado.');
 reset();sql(unifiedQuery(unifiedDocument));sql(`insert into clientes(id,organization_id,nombre)values('${secondCustomer}','${org}','Segundo ficticio');`);
 assert((await competing(editUnified({...unifiedDocument,cliente_id:secondCustomer}),approveUnified)).every(r=>r.status==='fulfilled'));
 assert.equal(sql('select cliente_id from cotizaciones_unificadas'),secondCustomer);assert.equal(sql('select cliente_id from ordenes_produccion'),secondCustomer);
 assert.equal(sql('select sum(monto) from movimientos_caja'),'300.00');
 results.push('Cambio de cliente antes de aprobación concurrente: ambos documentos se vinculan al nuevo cliente y se registra solo el adelanto 300.');
 reset();const mismatched=await competing(unifiedQuery(unifiedDocument),unifiedQuery({...unifiedDocument,fecha:'2026-10-12'}));
 assert.equal(mismatched[0].status,'fulfilled');assert.equal(mismatched[1].status,'rejected');assert.equal(sql('select count(*) from cotizaciones_unificadas'),'1');
 results.push('Una clave simultánea con contenido diferente se rechaza sin modificar ni duplicar la cotización inicial.');
 reset();sql(unifiedQuery(unifiedDocument));sql(`select registrar_cobro_cotizacion_seguro('${org}','${actor}','${unifiedKey}',1000,1000,'yape','2026-10-11');`);
 const paidOrder=approveUnified.replace(',1000,300,',',1000,0,');const paidOrders=await competing(paidOrder,paidOrder);
 assert.equal(paidOrders[0].status,'fulfilled');assert.equal(paidOrders[1].status,'rejected');assert.equal(sql('select count(*) from ordenes_produccion'),'1');
 assert.equal(sql('select count(*) from movimientos_caja'),'1');assert.equal(sql('select sum(monto) from movimientos_caja'),'1000.00');assert.equal(sql('select estado_flujo from cotizaciones_unificadas'),'cobrada');
 results.push('Dos aprobaciones de una cotización pagada: una orden y el cobro previo 1000 intacto, sin volver a cobrar.');

 sql('create unique index if not exists inventario_org_codigo_prueba on inventario_productos(organization_id,codigo)');
 const altaDatos={codigo:'AUD-81',nombre:'Mueble ficticio',categoria:'Muebles',unidad:'unidad',stock_inicial:10,stock_minimo:0,costo_unitario:25,fecha:'2026-10-11',foto_url:null};
 const altaQuery=(key=randomUUID())=>`select registrar_alta_inventario_segura('${org}','${actor}','producto_inventario','${key}',${literal(altaDatos)});`;
 reset();const altaKey=randomUUID();assert((await competing(altaQuery(altaKey),altaQuery(altaKey))).every(r=>r.status==='fulfilled'));
 assert.equal(sql("select count(*) from inventario_productos where codigo='AUD-81'"),'1');assert.equal(sql('select count(*) from inventario_movimientos'),'1');
 assert.equal(sql("select stock_actual from inventario_productos where codigo='AUD-81'"),'10');assert.equal(sql("select stock_disponible from muebles_catalogo where codigo='AUD-81'"),'10');
 results.push('Dos conexiones reintentan el alta: un producto, carga inicial diez y catálogo diez.');
 reset();const codigosIguales=await competing(altaQuery(),altaQuery());assert.equal(codigosIguales.filter(r=>r.status==='fulfilled').length,1);
 assert.equal(sql('select count(*) from inventario_movimientos'),'1');assert.equal(sql('select count(*) from operaciones_financieras_seguras'),'1');
 results.push('Dos altas distintas con el mismo código: una rechazada y ninguna carga inicial huérfana.');
 reset();const autoData={...altaDatos,codigo:'MUE-GEN-2610-###',codigo_automatico:true};
 const autoQuery=key=>`select registrar_alta_inventario_segura('${org}','${actor}','producto_inventario','${key}',${literal(autoData)});`;
 const autoKey=randomUUID();assert((await competing(autoQuery(autoKey),autoQuery(randomUUID()))).every(r=>r.status==='fulfilled'));sql(autoQuery(autoKey));
 assert.equal(sql("select string_agg(codigo,',' order by codigo) from inventario_productos where codigo like 'MUE-GEN-%'"),'MUE-GEN-2610-001,MUE-GEN-2610-002');
 assert.equal(sql('select count(*) from inventario_movimientos'),'2');assert.equal(sql('select count(*) from operaciones_financieras_seguras'),'2');assert.equal(sql('select count(*) from movimientos_caja'),'0');
 results.push('Dos productos con sugerencia igual en conexiones distintas reciben códigos 001 y 002; el reintento conserva su código y no duplica stock.');
 reset(100);const movDatos={producto_id:product,fecha:'2026-10-11',tipo:'entrada_compra',cantidad:10,costo_unitario:25,referencia:'Manual ficticia'};
 const movQuery=(key,datos=movDatos)=>`select registrar_alta_inventario_segura('${org}','${actor}','movimiento_inventario','${key}',${literal(datos)});`;
 const movKey=randomUUID();assert((await competing(movQuery(movKey),movQuery(movKey))).every(r=>r.status==='fulfilled'));
 assert.equal(sql('select stock_actual from inventario_productos'),'110');assert.equal(sql('select count(*) from inventario_movimientos'),'1');assert.equal(sql('select count(*) from movimientos_caja'),'0');
 results.push('Entrada manual repetida en dos conexiones: un Kardex, stock ciento diez y Caja intacta.');
 reset(100);const salidas=await competing(movQuery(randomUUID(),{...movDatos,tipo:'salida_venta',cantidad:80}),movQuery(randomUUID(),{...movDatos,tipo:'salida_venta',cantidad:80}));
 assert.equal(salidas.filter(r=>r.status==='fulfilled').length,1);assert.equal(sql('select stock_actual from inventario_productos'),'20');assert.equal(sql('select count(*) from inventario_movimientos'),'1');
 results.push('Dos salidas manuales de ochenta compiten por cien: una aceptada, stock veinte y ningún movimiento parcial.');
 fs.writeFileSync(path.join(work, 'resultado.json'), JSON.stringify({ ok: true, postgres: sql('show server_version'), results }, null, 2));
 console.log(JSON.stringify({ ok: true, pruebas: results.length, evidencia: path.join(work, 'resultado.json') }));
} finally {
 if (started) execFileSync(exe('pg_ctl'), ['-D', cluster, '-m', 'fast', '-w', 'stop'], { windowsHide: true, timeout: 30000, stdio: 'ignore' });
}
