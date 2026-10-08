// Prueba de privilegios en PostgreSQL aislado; no conecta con el negocio.
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const { PGlite } = require('../../temp/postgres-aislado/node_modules/@electric-sql/pglite');
const db = new PGlite();
const org = '00000000-0000-4000-8000-000000000001';
const cases = [
  ...['owner_admin','gerencia','ventas','vendedor','almacen','caja','rrhh','partner_readonly','operaciones_caja'].map(role => ({role, ui:null, expected:role==='partner_readonly'?'vendedor':role==='operaciones_caja'?'caja':role})),
  {role:'owner_admin',ui:'readonly',expected:'vendedor'},
  {role:'vendedor',ui:'operaciones',expected:'gerencia'},
  {role:'ventas',ui:'owner_admin',expected:'owner_admin'},
  {role:'owner_admin',ui:'owner_admin',expected:null,inactive:true},
];
const lit = value => value===null?'null':"'"+value.replaceAll("'","''")+"'";
try {
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema app; create schema auth;
    create type public.app_role as enum ('owner_admin','gerencia','ventas','vendedor','almacen','caja','rrhh','partner_readonly','operaciones_caja');
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema auth to anon,authenticated,service_role;
    create table auth.users(id uuid primary key,email text);
    create table public.perfiles(user_id uuid primary key,organization_id uuid,role public.app_role,ui_role text,deactivated_at timestamptz);
    create table public.clientes(id uuid primary key default gen_random_uuid(),organization_id uuid,nombre text);
    create function public.reset_datos_operativos(uuid,text,uuid) returns void language sql security definer as $$ delete from public.clientes where organization_id=$1 $$;
    create function public.handle_new_user() returns trigger language plpgsql as $$ begin insert into public.perfiles values(new.id,'${org}','owner_admin','owner_admin',null);return new;end $$;
    create trigger usuario_nuevo after insert on auth.users for each row execute function public.handle_new_user();
    create function app.current_org_id() returns uuid language sql stable as $$select organization_id from public.perfiles where user_id=auth.uid() limit 1$$;
    create function app.current_role() returns public.app_role language sql stable as $$select role from public.perfiles where user_id=auth.uid() limit 1$$;
    alter table public.perfiles enable row level security;
    create policy org_manage_perfiles on public.perfiles using(organization_id=app.current_org_id()) with check(organization_id=app.current_org_id());
    create policy perfiles_select_self on public.perfiles for select using(user_id=auth.uid());
    grant all on all tables in schema public to anon,authenticated,service_role;
    grant execute on function public.reset_datos_operativos(uuid,text,uuid) to anon,authenticated,service_role;
    insert into clientes(organization_id,nombre) values('${org}','Conservar');`);
  for (const [i,c] of cases.entries()) {
    c.id='10000000-0000-4000-8000-'+String(i+1).padStart(12,'0');
    await db.exec(`insert into perfiles values('${c.id}','${org}',${lit(c.role)},${lit(c.ui)},${c.inactive?'now()':'null'});`);
  }
  await db.exec(readFileSync(new URL('../../supabase/migrations/20261007150000_perfiles_y_acceso_servidor.sql',import.meta.url),'utf8'));
  for (const c of cases) {
    await db.exec(`set role authenticated; set request.jwt.claim.sub='${c.id}';`);
    const rows=(await db.query('select * from public.perfiles')).rows;
    assert.equal(rows.length,c.inactive?0:1);
    if(rows.length) assert.equal(rows[0].user_id,c.id,'Solo el perfil propio');
    assert.equal((await db.query('select app.current_role() rol')).rows[0].rol,c.expected);
    assert.equal((await db.query('select app.current_org_id() org')).rows[0].org,c.inactive?null:org);
    for(const sql of ['select * from clientes','delete from perfiles','update perfiles set role=\'owner_admin\'','truncate perfiles',`insert into perfiles values(gen_random_uuid(),'${org}','owner_admin',null,null)`,`select reset_datos_operativos('${org}','RESETEAR','${c.id}')`])
      await assert.rejects(db.exec(sql),/permission denied/);
    await db.exec('reset role;');
  }
  await db.exec("set role anon; set request.jwt.claim.sub='';");
  await assert.rejects(db.exec('select * from public.perfiles'),/permission denied/);
  await assert.rejects(db.exec(`select reset_datos_operativos('${org}','RESETEAR',null)`),/permission denied/);
  await db.exec('reset role;');
  assert.equal((await db.query('select nombre from public.clientes')).rows[0].nombre,'Conservar');
  const newUser='20000000-0000-4000-8000-000000000001';
  await db.exec(`insert into auth.users values('${newUser}','prueba@example.invalid');`);
  assert.equal((await db.query('select count(*)::int n from perfiles where user_id=$1',[newUser])).rows[0].n,0,'Registrarse no concede permisos');
  await db.exec(`set role service_role; insert into perfiles values('${newUser}','${org}','caja',null,null); insert into clientes(organization_id,nombre) values('${org}','Guardado servidor'); reset role;`);
  assert.equal((await db.query('select count(*)::int n from clientes')).rows[0].n,2,'Guardado autorizado funciona');
  await db.exec('create table public.futuro(id int); create function public.rpc_futura() returns int language sql as $$select 1$$;');
  const future=(await db.query("select has_table_privilege('authenticated','public.futuro','INSERT') escribir, has_function_privilege('anon','public.rpc_futura()','EXECUTE') ejecutar, has_table_privilege('service_role','public.futuro','INSERT') servidor")).rows[0];
  assert.deepEqual(future,{escribir:false,ejecutar:false,servidor:true});
  console.log(JSON.stringify({casosRoles:cases.length,perfilesSinRecursion:true,soloPerfilPropio:true,inactivosSinAcceso:true,operacionesDirectasBloqueadas:true,registroSinPrivilegios:true,invitacionYGuardadoServidor:true,nuevosObjetosProtegidos:true,sinConexionProduccion:true}));
} finally { await db.close(); }
