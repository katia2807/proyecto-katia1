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
function reset(stock = 10) {
 sql(`truncate perfiles,${tables.join(',')} cascade;set auditoria.fallo_caja='no';set auditoria.fallo_categoria='';
 insert into perfiles values('${actor}','${org}','owner_admin',null,null);
 insert into clientes values('${customer}','${org}','Cliente ficticio',null);
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
   'supabase/migrations/20261010010000_cobros_y_cierres_seguros.sql','supabase/migrations/20261011010000_integridad_caja_stock_operaciones.sql']) {
   execFileSync(exe('psql'), [...args, '-f', path.join(root, file)], { windowsHide: true, timeout: 20000 });
 }
 sql(`create extension pgcrypto;create schema app;create function app.current_role() returns text language sql as $$select 'owner_admin'::text$$;
 create table sueldos(organization_id uuid,periodo text,monto_neto numeric);
 create table auditoria_prueba(organization_id uuid,accion text,datos jsonb);
 create function log_audit_event(uuid,text,text,uuid,jsonb) returns void language sql as $$insert into auditoria_prueba values($1,$2,$5)$$;`);
 const view = fs.readFileSync(path.join(root, 'supabase/migrations/20261006233000_restantes_integridad.sql'), 'utf8')
   .split('create or replace view public.utilidad_mensual')[1].split('commit;')[0];
 sql('create or replace view public.utilidad_mensual' + view);
 reset();
 const doubleSale = await Promise.allSettled([connection('begin;' + sale() + 'select pg_sleep(0.35);commit;'), connection(sale())]);
 assert.equal(doubleSale.filter(r => r.status === 'fulfilled').length, 1);
 assert.equal(sql('select stock_actual from inventario_productos'), '2');
 assert.equal(sql('select count(*) from ventas_madera'), '1');
 assert.equal(sql('select sum(monto) from movimientos_caja'), '800.00');
 results.push('Stock diez: dos conexiones intentan vender ocho; una venta aceptada, stock dos y Caja 800.');
 reset(100); const nonce = randomUUID();
 await Promise.all([connection('begin;' + sale(nonce) + 'select pg_sleep(0.35);commit;'), connection(sale(nonce))]);
 assert.equal(sql('select stock_actual from inventario_productos'), '92');
 assert.equal(sql('select count(*) from movimientos_caja'), '1');
 results.push('Dos conexiones reintentan la misma solicitud: una venta, una salida y un ingreso.');
 reset(100); await connection(sale());
 const closing = await Promise.allSettled([
   connection(`begin;select cerrar_mes('${org}',2026,10);select pg_sleep(0.35);commit;`),
   connection(`select pg_sleep(0.1);${sale()}`),
 ]);
 assert.equal(closing[0].status, 'fulfilled'); assert.equal(closing[1].status, 'rejected');
 assert.equal(sql('select count(*) from ventas_madera'), '1');
 assert.equal(sql("select reporte_json->>'ingresos' from cierres_mensuales"), '800.00');
 assert.equal(sql('select bool_and(periodo_cerrado) from movimientos_caja'), 't');
 assert.equal(sql("select count(*) from auditoria_prueba where accion='MONTH_CLOSE'"), '1');
 results.push('Cierre mensual real con vista y SHA-256: snapshot 800, movimiento marcado y escritura simultánea rechazada.');
 reset(100); await connection(sale());
 const id = sql('select id from ventas_madera');
 await Promise.all([connection(`begin;select anular_operacion_integral('${org}','${actor}','venta_madera','${id}');select pg_sleep(0.35);commit;`),
   connection(`select anular_operacion_integral('${org}','${actor}','venta_madera','${id}')`)]);
 assert.equal(sql('select stock_actual from inventario_productos'), '100');
 assert.equal(sql("select count(*) from inventario_movimientos where tipo='ajuste'"), '1');
 assert.equal(sql('select count(*) from movimientos_caja where voided_at is null'), '0');
 results.push('Dos anulaciones simultáneas: una devolución de stock y el cobro conservado como anulado.');
 fs.writeFileSync(path.join(work, 'resultado.json'), JSON.stringify({ ok: true, postgres: sql('show server_version'), results }, null, 2));
 console.log(JSON.stringify({ ok: true, pruebas: results.length, evidencia: path.join(work, 'resultado.json') }));
} finally {
 if (started) execFileSync(exe('pg_ctl'), ['-D', cluster, '-m', 'fast', '-w', 'stop'], { windowsHide: true, timeout: 30000, stdio: 'ignore' });
}
