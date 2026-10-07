// PostgreSQL aislado en memoria. No lee credenciales ni conecta con Supabase.
// Runtime de pruebas instalado aparte: npm install --prefix temp/postgres-aislado --no-save --ignore-scripts @electric-sql/pglite
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
const {PGlite}=require('../../temp/postgres-aislado/node_modules/@electric-sql/pglite');
const db=new PGlite();
const org='00000000-0000-0000-0000-000000000001', other='00000000-0000-0000-0000-000000000002';
const owner='10000000-0000-4000-8000-000000000001', reader='10000000-0000-4000-8000-000000000002';
const product='20000000-0000-4000-8000-000000000001';
const passed=[];
try {
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create table perfiles(id uuid default gen_random_uuid(),user_id uuid,organization_id uuid,role text,ui_role text,deactivated_at timestamptz);
    create table audit_logs(id uuid default gen_random_uuid(),organization_id uuid,user_id uuid,user_name text,accion text,modulo text,detalles jsonb);
    create table clientes(id uuid primary key default gen_random_uuid(),organization_id uuid);
    create table compras_madera(id uuid primary key default gen_random_uuid(),organization_id uuid);
    create table configuracion_empresa(organization_id uuid,nombre text);
    create table empleados(id uuid primary key default gen_random_uuid(),organization_id uuid);
    create table sueldos(id uuid default gen_random_uuid(),organization_id uuid,empleado_id uuid references empleados(id),periodo text,monto_bruto numeric(12,2),descuentos numeric(12,2),monto_neto numeric(12,2));
    create table movimientos_caja(id uuid default gen_random_uuid(),organization_id uuid,fecha date,tipo text,monto numeric(12,2),es_personal boolean,deleted_at timestamptz,voided_at timestamptz);
    create table inventario_productos(id uuid primary key default gen_random_uuid(),organization_id uuid,codigo text,nombre text,categoria text,unidad text,stock_actual numeric(12,2),stock_minimo numeric(12,2),costo_unitario numeric(12,2),precio_venta numeric(12,2),activo boolean,deleted_at timestamptz,unique(organization_id,codigo));
    create table inventario_movimientos(id uuid default gen_random_uuid(),organization_id uuid,producto_id uuid references inventario_productos(id) on delete restrict,fecha date,tipo text,cantidad numeric(12,2) constraint inventario_movimientos_cantidad_check check(cantidad>0),costo_unitario numeric(12,2),referencia text);
    insert into perfiles(user_id,organization_id,role,ui_role) values('${owner}','${org}','ventas','owner_admin'),('${reader}','${org}','owner_admin','readonly');
    insert into configuracion_empresa values('${org}','Empresa aislada');
    insert into sueldos(organization_id,periodo,monto_bruto,descuentos,monto_neto)values('${org}','histórico',-1,5,-6);
    insert into inventario_productos values('${product}','${org}','P1','Tabla','Madera','PT',10,2,3,99,true,null);
    insert into inventario_productos(organization_id,codigo,nombre,stock_actual)values('${other}','P1','Otro',10);
  `);
  // Instala exactamente la migración entregada, sin reproducir las funciones en la prueba.
  await db.exec(readFileSync(new URL('../../supabase/migrations/20261006233000_restantes_integridad.sql',import.meta.url),'utf8'));
  const trigger=readFileSync(new URL('../../supabase/migrations/20260430201000_inventory_module.sql',import.meta.url),'utf8');
  await db.exec(trigger.slice(trigger.indexOf('create or replace function public.sync_stock_from_movimiento')));
  const importProduct=(data,user=owner)=>db.query('select importar_producto_inventario($1,$2,$3,false,$4) result',[org,user,JSON.stringify(data),'2026-10-06']);
  const stock=async()=>Number((await db.query('select stock_actual from inventario_productos where id=$1',[product])).rows[0].stock_actual);
  await assert.rejects(importProduct({codigo:'P1',stock_actual:20},reader),/No autorizado/); assert.equal(await stock(),10);
  passed.push('Rol UI de lectura no hereda los permisos del rol antiguo');
  await importProduct({codigo:'P1',stock_actual:15}); assert.equal(await stock(),15);
  await importProduct({codigo:'P1',stock_actual:15});
  await importProduct({codigo:'P1',stock_actual:4}); assert.equal(await stock(),4);
  const movements=(await db.query('select cantidad from inventario_movimientos order by cantidad')).rows;
  assert.deepEqual(movements.map(r=>Number(r.cantidad)),[-11,5]);
  assert.equal(Number((await db.query('select precio_venta from inventario_productos where id=$1',[product])).rows[0].precio_venta),99);
  assert.equal(Number((await db.query('select stock_actual from inventario_productos where organization_id=$1',[other])).rows[0].stock_actual),10);
  passed.push('Ajustes ascendentes/descendentes y reintentos: stock y Kardex coherentes, precio y otra empresa conservados');
  await assert.rejects(importProduct({codigo:'P1',nombre:'Cambio inválido',stock_actual:-2}),/inválido/);
  assert.equal((await db.query('select nombre from inventario_productos where id=$1',[product])).rows[0].nombre,'Tabla');
  await db.exec('drop trigger trg_sync_stock_from_movimiento on inventario_movimientos');
  await importProduct({codigo:'P1',stock_actual:6}); assert.equal(await stock(),6);
  const created=await importProduct({codigo:'P2',nombre:'Producto nuevo',stock_actual:7,costo_unitario:8}); assert.equal(created.rows[0].result,'inserted');
  passed.push('Sin trigger histórico: mismo stock; producto nuevo con movimiento de apertura; fallo revierte metadatos');
  await assert.rejects(db.query("insert into sueldos(organization_id,periodo,monto_bruto,descuentos,monto_neto) values($1,'2026-13',100,20,80)",[org]),/sueldos_periodo_y_neto_validos/);
  await assert.rejects(db.query("insert into sueldos(organization_id,periodo,monto_bruto,descuentos,monto_neto) values($1,'2026-10',100,120,-20)",[org]),/sueldos_periodo_y_neto_validos/);
  await db.query("insert into sueldos(organization_id,periodo,monto_bruto,descuentos,monto_neto) values($1,'2026-10',100,20,80)",[org]);
  assert.equal((await db.query("select count(*) n from sueldos where periodo='histórico'")).rows[0].n,1);
  passed.push('Sueldos nuevos válidos; período/neto inválidos rechazados; históricos conservados');
  await db.query(`insert into movimientos_caja(organization_id,fecha,tipo,monto,es_personal,deleted_at) values
    ($1,'2026-10-06','ingreso',500,false,null),($1,'2026-10-06','egreso',80,false,null),
    ($1,'2026-10-06','egreso',900,true,null),($1,'2026-10-06','ingreso',999,false,now())`,[org]);
  const month=(await db.query('select * from utilidad_mensual where organization_id=$1',[org])).rows[0];
  assert.equal(Number(month.ingresos),500);assert.equal(Number(month.egresos),80);assert.equal(Number(month.sueldos),80);assert.equal(Number(month.utilidad_neta),420);
  passed.push('Vista mensual excluye Caja personal y borrados; nómina no se descuenta dos veces');
  await db.exec(`insert into compras_madera(organization_id)values('${org}'); insert into clientes(organization_id)values('${org}');
    create table bloqueo_prueba(cliente_id uuid references clientes(id) on delete restrict); insert into bloqueo_prueba select id from clientes;
    insert into audit_logs(organization_id,accion)values('${org}','EVIDENCIA');`);
  const reset=()=>db.query('select limpiar_datos_operativos_atomico($1,$2,$3)',[org,owner,'Dueña aislada']);
  await assert.rejects(reset(),/foreign key/);
  assert.equal((await db.query('select count(*) n from compras_madera')).rows[0].n,1);
  assert.equal((await db.query('select count(*) n from inventario_productos where organization_id=$1',[org])).rows[0].n,2);
  passed.push('Fallo tras borrados iniciales: toda la limpieza se revierte');
  await db.exec('drop table bloqueo_prueba; alter table audit_logs add constraint bloquear_prueba check(accion<>\'DATABASE_RESET\') not valid;');
  await assert.rejects(reset(),/bloquear_prueba/);assert.equal((await db.query('select count(*) n from clientes')).rows[0].n,1);
  passed.push('Fallo de auditoría: datos operativos conservados');
  await db.exec('alter table audit_logs drop constraint bloquear_prueba;');
  await reset();
  assert.equal((await db.query('select count(*) n from clientes')).rows[0].n,0);
  assert.equal((await db.query('select count(*) n from audit_logs')).rows[0].n,2);
  assert.equal((await db.query('select count(*) n from perfiles')).rows[0].n,2);
  assert.equal((await db.query('select count(*) n from configuracion_empresa')).rows[0].n,1);
  assert.equal((await db.query('select count(*) n from inventario_productos where organization_id=$1',[other])).rows[0].n,1);
  passed.push('Limpieza exitosa mantiene evidencia, usuarios, empresa y organización ajena');
  await db.exec('set role authenticated');
  await assert.rejects(reset(),/permission denied/);await db.exec('reset role');
  passed.push('RPC administrativa no ejecutable desde una sesión pública/autenticada');
  console.log(JSON.stringify({ok:true,checks:passed},null,2));
} finally {await db.close();}
