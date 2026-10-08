-- Las lecturas y guardados del negocio pasan por el servidor, que valida
-- sesión, rol efectivo y organización. El navegador solo necesita Auth y
-- leer su propio perfil; ninguna pantalla escribe directamente por PostgREST.
-- Esta instalación modifica estructura/permisos, nunca registros del negocio.
begin;

-- user_id ya referencia Auth. La relación adicional heredada sobre el id del
-- perfil impedía crear usuarios con el identificador propio de esa fila.
-- Se conserva la relación correcta, la clave primaria y todos los perfiles.
alter table public.perfiles drop constraint if exists perfiles_id_fkey;

create or replace function app.current_org_id()
returns uuid language sql stable security definer
set search_path = pg_catalog as $$
  select p.organization_id from public.perfiles p
  where p.user_id = auth.uid() and p.deactivated_at is null limit 1
$$;

create or replace function app.current_role()
returns public.app_role language sql stable security definer
set search_path = pg_catalog as $$
  select (case
    when p.ui_role = 'owner_admin' then 'owner_admin'
    when p.ui_role = 'operaciones' then 'gerencia'
    when p.ui_role = 'readonly' or p.role::text = 'partner_readonly' then 'vendedor'
    when p.role::text = 'operaciones_caja' then 'caja'
    else p.role::text
  end)::public.app_role
  from public.perfiles p
  where p.user_id = auth.uid() and p.deactivated_at is null limit 1
$$;

create or replace function app.can_view_finance()
returns boolean language sql stable set search_path = pg_catalog as $$
  select coalesce(app.current_role()::text in ('owner_admin','gerencia'), false)
$$;

-- El propietario atraviesa RLS al consultar exclusivamente auth.uid(); de
-- este modo las políticas de perfiles no vuelven a llamarse a sí mismas.
alter function app.current_org_id() owner to postgres;
alter function app.current_role() owner to postgres;
alter function app.can_view_finance() owner to postgres;
revoke all on function app.current_org_id(), app.current_role(), app.can_view_finance() from public, anon, authenticated;
grant usage on schema app to authenticated, service_role;
grant execute on function app.current_org_id(), app.current_role(), app.can_view_finance() to authenticated, service_role;

drop policy if exists org_manage_perfiles on public.perfiles;
drop policy if exists perfiles_select_self on public.perfiles;
drop policy if exists perfiles_lectura_propia_activa on public.perfiles;
create policy perfiles_lectura_propia_activa on public.perfiles
for select to authenticated
using (user_id = auth.uid() and deactivated_at is null);

-- Auth permite registrar una cuenta, pero eso no le concede acceso al negocio.
-- Usuarios ya crea el perfil y asigna sus permisos desde el servidor. El trigger
-- antiguo daba automáticamente rol de dueña y además duplicaba las invitaciones.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer
set search_path = pg_catalog as $$
begin
  return new;
end $$;
alter function public.handle_new_user() owner to postgres;

-- Incluye tablas sin RLS/políticas heredadas y las operaciones DELETE/TRUNCATE,
-- que no quedan protegidas por el WITH CHECK de las políticas antiguas.
revoke all on all tables in schema public from public, anon, authenticated;
grant select on public.perfiles to authenticated;
grant all on all tables in schema public to service_role;
revoke all on all sequences in schema public from public, anon, authenticated;
grant all on all sequences in schema public to service_role;
revoke create on schema public from public, anon, authenticated;

-- RPC antiguas aceptaban identificadores arbitrarios y algunas eran SECURITY
-- DEFINER. Solo el servidor puede invocarlas tras comprobar los permisos.
-- No tocar funciones de extensiones ni procedimientos del proveedor.
do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as firma
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prokind = 'f'
      and pg_get_userbyid(p.proowner) = 'postgres'
      and not exists (select 1 from pg_depend d where d.classid = 'pg_proc'::regclass and d.objid = p.oid and d.deptype = 'e')
  loop
    execute format('revoke all on function %s from public, anon, authenticated', f.firma);
    execute format('grant execute on function %s to service_role', f.firma);
  end loop;
end $$;

alter default privileges for role postgres in schema public revoke all on tables from public, anon, authenticated;
alter default privileges for role postgres in schema public grant all on tables to service_role;
alter default privileges for role postgres in schema public revoke all on sequences from public, anon, authenticated;
alter default privileges for role postgres in schema public grant all on sequences to service_role;
alter default privileges for role postgres in schema public revoke execute on functions from public, anon, authenticated;
-- EXECUTE de PUBLIC viene también del valor global predeterminado de PostgreSQL.
-- Un REVOKE limitado al esquema no puede quitar esa concesión global.
alter default privileges for role postgres revoke execute on functions from public, anon, authenticated;
alter default privileges for role postgres in schema public grant execute on functions to service_role;
commit;
