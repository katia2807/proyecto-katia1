-- Solo protege operaciones futuras. No corrige ni reescribe registros históricos.
begin;

-- Mantiene la exclusión entre peticiones también mientras se coordina con Auth.
-- No vence automáticamente: ante un resultado incierto se conserva el bloqueo,
-- en lugar de permitir cambios que puedan dejar a la empresa sin administradora.
create table public.gestiones_usuarios_seguras (
  id uuid primary key, organization_id uuid not null references public.organizations(id),
  actor_id uuid not null, user_id uuid, tipo text not null check(tipo in ('invitar','perfil','estado')),
  datos jsonb not null, anterior jsonb, actual jsonb,
  estado text not null default 'pendiente' check(estado in ('pendiente','confirmada','revertida')),
  error text, created_at timestamptz not null default now(), finished_at timestamptz
);
create unique index gestion_usuario_pendiente_por_empresa on public.gestiones_usuarios_seguras(organization_id)
  where estado='pendiente';
create unique index invitacion_usuario_pendiente_por_correo on public.gestiones_usuarios_seguras(lower(btrim(datos->>'email')))
  where estado='pendiente' and tipo='invitar';
alter table public.gestiones_usuarios_seguras enable row level security;
revoke all on public.gestiones_usuarios_seguras from public,anon,authenticated;
grant all on public.gestiones_usuarios_seguras to service_role;

-- Comprobación limitada, solo para el servidor: evita reinvitar o cambiar
-- metadatos de una cuenta ya vinculada, incluso si pertenece a otra empresa.
create function public.correo_con_perfil_usuario(p_correo text)
returns boolean language sql volatile security definer set search_path=pg_catalog as $$
  select exists(select 1 from auth.users u join public.perfiles p on p.user_id=u.id
    where lower(u.email)=lower(btrim(p_correo)));
$$;
alter function public.correo_con_perfil_usuario(text) owner to postgres;
revoke all on function public.correo_con_perfil_usuario(text) from public,anon,authenticated;
grant execute on function public.correo_con_perfil_usuario(text) to service_role;

create function public.iniciar_gestion_usuario_segura(p_org uuid,p_actor uuid,p_clave uuid,p_usuario uuid,p_tipo text,p_datos jsonb)
returns jsonb language plpgsql security invoker set search_path=pg_catalog,public as $$
declare v_perfil public.perfiles%rowtype; v_anterior jsonb; v_actual jsonb;
  v_gestion public.gestiones_usuarios_seguras%rowtype; v_duena_anterior boolean; v_duena_actual boolean;
begin
  if p_org is null or p_actor is null or p_clave is null or p_tipo not in ('invitar','perfil','estado')
    or jsonb_typeof(p_datos) is distinct from 'object' then raise exception 'Solicitud de usuario inválida.'; end if;
  perform pg_advisory_xact_lock(hashtextextended('katia-usuarios:'||p_org::text,0));
  if not exists(select 1 from public.perfiles where organization_id=p_org and user_id=p_actor and deactivated_at is null
    and (ui_role='owner_admin' or (coalesce(ui_role,'')='' and role::text='owner_admin'))) then
    raise exception 'Solo una dueña activa puede gestionar usuarios.';
  end if;
  select * into v_gestion from public.gestiones_usuarios_seguras where id=p_clave;
  if found then
    if v_gestion.organization_id<>p_org or v_gestion.actor_id<>p_actor or v_gestion.tipo<>p_tipo
      or v_gestion.datos<>p_datos or v_gestion.user_id is distinct from p_usuario then
      raise exception 'Esta solicitud ya pertenece a otro cambio.';
    end if;
    return to_jsonb(v_gestion);
  end if;
  if exists(select 1 from public.gestiones_usuarios_seguras where organization_id=p_org and estado='pendiente') then
    raise exception 'Hay un cambio de usuario pendiente de confirmación. Espera a que termine; si persiste, solicita su revisión.';
  end if;
  if p_tipo='invitar' then
    if p_usuario is not null or length(btrim(coalesce(p_datos->>'full_name','')))<1
      or coalesce(p_datos->>'role','') not in ('gerencia','vendedor','almacen','caja')
      or position('@' in coalesce(p_datos->>'email',''))<2 then raise exception 'Revisa el correo, el nombre y el rol.'; end if;
    perform pg_advisory_xact_lock(hashtextextended('katia-invitacion:'||lower(btrim(p_datos->>'email')),0));
    -- Volver a leer después de esperar: otra empresa pudo terminar la invitación.
    if public.correo_con_perfil_usuario(p_datos->>'email') then
      raise exception 'El correo ya tiene un perfil. Su cuenta y sus permisos se conservaron.';
    end if;
    if exists(select 1 from public.gestiones_usuarios_seguras where tipo='invitar' and estado='pendiente'
      and lower(btrim(datos->>'email'))=lower(btrim(p_datos->>'email'))) then
      raise exception 'Hay una invitación pendiente para este correo. Espera a que se confirme.';
    end if;
  else
    select * into v_perfil from public.perfiles where organization_id=p_org and user_id=p_usuario for update;
    if not found then raise exception 'No se pudo comprobar que el usuario pertenezca a esta organización. No se hicieron cambios.'; end if;
    v_anterior:=jsonb_build_object('full_name',v_perfil.full_name,'role',v_perfil.role::text,
      'ui_role',v_perfil.ui_role,'deactivated_at',v_perfil.deactivated_at);
    v_actual:=v_anterior;
    if p_tipo='perfil' then
      if length(btrim(coalesce(p_datos->>'full_name','')))<2
        or coalesce(p_datos->>'role','') not in ('conservar','owner_admin','gerencia','vendedor','almacen','caja') then
        raise exception 'Revisa el nombre y el rol.';
      end if;
      v_actual:=v_actual||jsonb_build_object('full_name',btrim(p_datos->>'full_name'));
      if p_datos->>'role'<>'conservar' then v_actual:=v_actual||jsonb_build_object('role',p_datos->>'role','ui_role',null); end if;
    else
      if jsonb_typeof(p_datos->'active') is distinct from 'boolean' then raise exception 'Estado de usuario inválido.'; end if;
      v_actual:=v_actual||jsonb_build_object('deactivated_at',case when (p_datos->>'active')::boolean then null else now() end);
    end if;
    v_duena_anterior:=(v_anterior->>'deactivated_at') is null and
      (v_anterior->>'ui_role'='owner_admin' or (coalesce(v_anterior->>'ui_role','')='' and v_anterior->>'role'='owner_admin'));
    v_duena_actual:=(v_actual->>'deactivated_at') is null and
      (v_actual->>'ui_role'='owner_admin' or (coalesce(v_actual->>'ui_role','')='' and v_actual->>'role'='owner_admin'));
    if p_usuario=p_actor and not coalesce(v_duena_actual,false) then raise exception 'No puedes desactivar tu sesión ni quitarte el permiso de dueña.'; end if;
    if coalesce(v_duena_anterior,false) and not coalesce(v_duena_actual,false) and not exists(
      select 1 from public.perfiles where organization_id=p_org and user_id<>p_usuario and deactivated_at is null
        and (ui_role='owner_admin' or (coalesce(ui_role,'')='' and role::text='owner_admin'))) then
      raise exception 'Debe existir al menos una dueña activa.';
    end if;
    update public.perfiles set full_name=v_actual->>'full_name',role=(v_actual->>'role')::public.app_role,
      ui_role=v_actual->>'ui_role',deactivated_at=(v_actual->>'deactivated_at')::timestamptz where id=v_perfil.id;
  end if;
  insert into public.gestiones_usuarios_seguras(id,organization_id,actor_id,user_id,tipo,datos,anterior,actual)
    values(p_clave,p_org,p_actor,p_usuario,p_tipo,p_datos,v_anterior,v_actual) returning * into v_gestion;
  return to_jsonb(v_gestion);
end $$;

create function public.finalizar_gestion_usuario_segura(p_org uuid,p_actor uuid,p_clave uuid,p_confirmar boolean,p_invitado uuid default null)
returns jsonb language plpgsql security invoker set search_path=pg_catalog,public as $$
declare v_gestion public.gestiones_usuarios_seguras%rowtype; v_perfil public.perfiles%rowtype;
  v_actual jsonb; v_id uuid; v_error text;
begin
  perform pg_advisory_xact_lock(hashtextextended('katia-usuarios:'||p_org::text,0));
  select * into v_gestion from public.gestiones_usuarios_seguras where id=p_clave and organization_id=p_org and actor_id=p_actor for update;
  if not found or p_confirmar is null then raise exception 'No se encontró la gestión de usuario.'; end if;
  if v_gestion.estado<>'pendiente' then return to_jsonb(v_gestion); end if;
  if v_gestion.tipo='invitar' then
    if p_confirmar then
      if p_invitado is null then raise exception 'No se pudo comprobar la cuenta invitada.'; end if;
      -- Auth puede devolver una identidad previa. Nunca borrar ni reasignar esa cuenta.
      begin
        insert into public.perfiles(user_id,organization_id,role,full_name,ui_role)
          values(p_invitado,p_org,(v_gestion.datos->>'role')::public.app_role,v_gestion.datos->>'full_name',null)
          on conflict(user_id) do nothing returning id into v_id;
        if v_id is null then v_error:='El correo ya tiene un perfil. Su cuenta y sus permisos se conservaron.'; end if;
      exception when others then
        v_error:='No se pudo completar el perfil. La cuenta de acceso se conservó; revisa la invitación antes de reintentar.';
      end;
    end if;
  else
    select * into v_perfil from public.perfiles where user_id=v_gestion.user_id and organization_id=p_org for update;
    if not found then raise exception 'El perfil cambió durante la gestión. Revisa el usuario antes de continuar.'; end if;
    v_actual:=jsonb_build_object('full_name',v_perfil.full_name,'role',v_perfil.role::text,'ui_role',v_perfil.ui_role,'deactivated_at',v_perfil.deactivated_at);
    if v_actual is distinct from v_gestion.actual then raise exception 'El perfil cambió durante la gestión. Revisa el usuario antes de continuar.'; end if;
    if not p_confirmar then
      update public.perfiles set full_name=v_gestion.anterior->>'full_name',role=(v_gestion.anterior->>'role')::public.app_role,
        ui_role=v_gestion.anterior->>'ui_role',deactivated_at=(v_gestion.anterior->>'deactivated_at')::timestamptz where id=v_perfil.id;
    end if;
  end if;
  update public.gestiones_usuarios_seguras set estado=case when p_confirmar and v_error is null then 'confirmada' else 'revertida' end,
    error=v_error,finished_at=now() where id=p_clave returning * into v_gestion;
  return to_jsonb(v_gestion);
end $$;

revoke all on function public.iniciar_gestion_usuario_segura(uuid,uuid,uuid,uuid,text,jsonb),
  public.finalizar_gestion_usuario_segura(uuid,uuid,uuid,boolean,uuid) from public,anon,authenticated;
grant execute on function public.iniciar_gestion_usuario_segura(uuid,uuid,uuid,uuid,text,jsonb),
  public.finalizar_gestion_usuario_segura(uuid,uuid,uuid,boolean,uuid) to service_role;

-- La salida de Kardex es ahora la única que descuenta stock; el catálogo se sincroniza.
-- El trigger de la venta ya existe. No se inserta nada para ventas históricas.
create or replace function public.descontar_stock_venta_mueble()
returns trigger language plpgsql security invoker set search_path=pg_catalog,public as $$
begin
  perform public.bloquear_operacion_empresa(new.organization_id);
  if not exists(select 1 from public.muebles_catalogo c join public.inventario_productos p on p.id=c.id
    and p.organization_id=c.organization_id where c.id=new.mueble_catalogo_id and c.organization_id=new.organization_id) then
    raise exception 'No se encontró el inventario del mueble en esta empresa.';
  end if;
  insert into public.inventario_movimientos(organization_id,producto_id,fecha,tipo,cantidad,referencia)
    values(new.organization_id,new.mueble_catalogo_id,new.fecha,'salida_venta',new.cantidad,'venta:venta_mueble:'||new.id::text);
  return new;
end $$;
revoke all on function public.descontar_stock_venta_mueble() from public,anon,authenticated;
grant execute on function public.descontar_stock_venta_mueble() to service_role;

commit;
