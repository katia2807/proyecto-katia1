create extension if not exists pgcrypto;

create type app_role as enum (
  'owner_admin',
  'gerencia',
  'operaciones_caja',
  'ventas',
  'rrhh',
  'partner_readonly'
);

create type estado_documento as enum ('borrador', 'confirmada');
create type tipo_cotizacion as enum ('mueble_personalizado', 'servicio_corte');
create type unidad_medida as enum ('cm', 'in', 'otro');
create type tipo_movimiento as enum ('ingreso', 'egreso', 'transferencia');
create type medio_pago as enum ('efectivo', 'banco', 'yape', 'otro');
create type estado_adelanto as enum ('pendiente', 'descontado_nomina');
create type estado_alerta as enum ('nueva', 'revisada', 'resuelta');
create type prioridad_alerta as enum ('alta', 'media', 'baja');
create type tipo_alerta as enum ('stock_bajo', 'deuda_vencida', 'penalidad_limite', 'anomalia_caja');

create table if not exists organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists perfiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  organization_id uuid not null references organizations(id) on delete cascade,
  role app_role not null,
  full_name text,
  created_at timestamptz not null default now()
);

create table if not exists audit_log (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  action text not null,
  entity text not null,
  entity_id uuid,
  payload jsonb not null default '{}'::jsonb,
  actor_id uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists clientes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  nombre text not null,
  documento text,
  telefono text,
  created_at timestamptz not null default now()
);

create table if not exists productos_madera (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  nombre text not null,
  especie text,
  dimensiones text,
  unidad_base text not null default 'pies3',
  created_at timestamptz not null default now()
);

create table if not exists ventas_madera (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  cliente_id uuid not null references clientes(id) on delete restrict,
  fecha date not null,
  estado estado_documento not null default 'borrador',
  total numeric(12,2) not null default 0,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

create table if not exists ventas_madera_lineas (
  id uuid primary key default gen_random_uuid(),
  venta_id uuid not null references ventas_madera(id) on delete cascade,
  item_id uuid references productos_madera(id) on delete set null,
  volumen_m3_o_pies3 numeric(12,3) not null default 0,
  cantidad numeric(12,2) not null default 0,
  precio_unitario numeric(12,2) not null default 0,
  subtotal numeric(12,2) generated always as (cantidad * precio_unitario) stored
);

create table if not exists cotizaciones_mueble (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  cliente_id uuid not null references clientes(id) on delete restrict,
  fecha date not null,
  tipo tipo_cotizacion not null,
  especie_madera text not null,
  unidad_medida unidad_medida not null default 'cm',
  origen_material text not null default 'cliente',
  precio_calculado numeric(12,2) not null default 0,
  precio_acordado numeric(12,2) not null,
  motivo_ajuste text,
  estado estado_documento not null default 'borrador',
  created_at timestamptz not null default now()
);

create table if not exists cotizacion_cortes (
  id uuid primary key default gen_random_uuid(),
  cotizacion_id uuid not null references cotizaciones_mueble(id) on delete cascade,
  tipo_pieza text not null check (tipo_pieza in ('tabla', 'liston')),
  espesor numeric(12,3) not null,
  ancho numeric(12,3) not null,
  largo numeric(12,3) not null,
  cantidad integer not null default 1 check (cantidad > 0),
  valor_calculado numeric(12,2) not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists alquileres (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  cliente_id uuid not null references clientes(id) on delete restrict,
  activo text not null,
  fecha_inicio date not null,
  fecha_fin date,
  tarifa numeric(12,2) not null,
  penalidad numeric(12,2) not null default 0,
  estado text not null default 'abierto' check (estado in ('abierto', 'cerrado')),
  created_at timestamptz not null default now()
);

create table if not exists movimientos_caja (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  fecha date not null,
  tipo tipo_movimiento not null,
  medio medio_pago not null,
  categoria text not null,
  monto numeric(12,2) not null check (monto > 0),
  descripcion text,
  modulo_origen text,
  referencia_id uuid,
  periodo_cerrado boolean not null default false,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id),
  voided_at timestamptz,
  voided_by uuid references auth.users(id),
  void_reason text
);

create table if not exists empleados (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  nombre text not null,
  rol text not null,
  activo boolean not null default true,
  fecha_ingreso date not null,
  created_at timestamptz not null default now()
);

create table if not exists periodos_nomina (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  periodo text not null,
  estado text not null default 'abierto' check (estado in ('abierto', 'cerrado')),
  unique (organization_id, periodo)
);

create table if not exists sueldos (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  empleado_id uuid not null references empleados(id) on delete restrict,
  periodo text not null,
  monto_bruto numeric(12,2) not null,
  descuentos numeric(12,2) not null default 0,
  monto_neto numeric(12,2) not null,
  created_at timestamptz not null default now()
);

create table if not exists adelantos (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  empleado_id uuid not null references empleados(id) on delete restrict,
  fecha date not null,
  monto numeric(12,2) not null check (monto > 0),
  estado estado_adelanto not null default 'pendiente',
  created_at timestamptz not null default now()
);

create table if not exists alertas_operativas (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  tipo tipo_alerta not null,
  prioridad prioridad_alerta not null,
  estado estado_alerta not null default 'nueva',
  descripcion text not null,
  created_at timestamptz not null default now()
);

create table if not exists cierres_mensuales (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  anio integer not null,
  mes integer not null check (mes between 1 and 12),
  reporte_json jsonb not null,
  hash_sha256 text not null,
  closed_at timestamptz not null default now(),
  closed_by uuid references auth.users(id),
  reopened_at timestamptz,
  reopened_by uuid references auth.users(id),
  reopen_reason text,
  unique (organization_id, anio, mes)
);

create or replace function set_update_metadata()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end;
$$;

drop trigger if exists trg_movimientos_caja_updated on movimientos_caja;
create trigger trg_movimientos_caja_updated
before update on movimientos_caja
for each row execute function set_update_metadata();

create or replace function prevent_closed_period_changes()
returns trigger
language plpgsql
as $$
begin
  if old.periodo_cerrado then
    raise exception 'Este registro pertenece a un período cerrado. No se puede editar ni eliminar.';
  end if;
  return old;
end;
$$;

drop trigger if exists trg_movimientos_caja_prevent_update on movimientos_caja;
create trigger trg_movimientos_caja_prevent_update
before update or delete on movimientos_caja
for each row execute function prevent_closed_period_changes();

create or replace function app.current_org_id()
returns uuid
language sql
stable
as $$
  select organization_id
  from perfiles
  where user_id = auth.uid()
  limit 1
$$;

create or replace function app.current_role()
returns app_role
language sql
stable
as $$
  select role
  from perfiles
  where user_id = auth.uid()
  limit 1
$$;

create or replace function app.can_view_finance()
returns boolean
language sql
stable
as $$
  select app.current_role() in ('owner_admin', 'gerencia', 'partner_readonly')
$$;

create or replace view utilidad_mensual as
with movimientos as (
  select
    organization_id,
    extract(year from fecha)::int as anio,
    extract(month from fecha)::int as mes,
    sum(case when tipo = 'ingreso' then monto else 0 end) as ingresos,
    sum(case when tipo = 'egreso' then monto else 0 end) as egresos
  from movimientos_caja
  where voided_at is null
  group by organization_id, extract(year from fecha), extract(month from fecha)
),
nomina as (
  select
    organization_id,
    split_part(periodo, '-', 1)::int as anio,
    split_part(periodo, '-', 2)::int as mes,
    sum(monto_neto) as sueldos
  from sueldos
  group by organization_id, split_part(periodo, '-', 1), split_part(periodo, '-', 2)
)
select
  coalesce(m.organization_id, n.organization_id) as organization_id,
  coalesce(m.anio, n.anio) as anio,
  coalesce(m.mes, n.mes) as mes,
  coalesce(m.ingresos, 0)::numeric(12,2) as ingresos,
  coalesce(m.egresos, 0)::numeric(12,2) as egresos,
  coalesce(n.sueldos, 0)::numeric(12,2) as sueldos,
  (coalesce(m.ingresos, 0) - coalesce(m.egresos, 0) - coalesce(n.sueldos, 0))::numeric(12,2) as utilidad_neta
from movimientos m
full outer join nomina n
on m.organization_id = n.organization_id and m.anio = n.anio and m.mes = n.mes;

create or replace function log_audit_event(
  p_org_id uuid,
  p_action text,
  p_entity text,
  p_entity_id uuid,
  p_payload jsonb
)
returns void
language sql
security definer
set search_path = public
as $$
  insert into audit_log (organization_id, action, entity, entity_id, payload, actor_id)
  values (p_org_id, p_action, p_entity, p_entity_id, coalesce(p_payload, '{}'::jsonb), auth.uid());
$$;

create or replace function cerrar_mes(p_org_id uuid, p_anio int, p_mes int)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  reporte jsonb;
  hash_val text;
begin
  if app.current_role() not in ('owner_admin', 'gerencia') then
    raise exception 'No tienes permisos para cerrar mes.';
  end if;

  if exists (
    select 1 from cierres_mensuales
    where organization_id = p_org_id and anio = p_anio and mes = p_mes and reopened_at is null
  ) then
    raise exception 'El período ya está cerrado.';
  end if;

  select to_jsonb(u)
  into reporte
  from (
    select * from utilidad_mensual
    where organization_id = p_org_id and anio = p_anio and mes = p_mes
  ) as u;

  hash_val := encode(digest(coalesce(reporte::text, '{}'), 'sha256'), 'hex');

  insert into cierres_mensuales (organization_id, anio, mes, reporte_json, hash_sha256, closed_by)
  values (p_org_id, p_anio, p_mes, coalesce(reporte, '{}'::jsonb), hash_val, auth.uid())
  on conflict (organization_id, anio, mes)
  do update set
    reporte_json = excluded.reporte_json,
    hash_sha256 = excluded.hash_sha256,
    closed_at = now(),
    closed_by = auth.uid(),
    reopened_at = null,
    reopened_by = null,
    reopen_reason = null;

  update movimientos_caja
  set periodo_cerrado = true
  where organization_id = p_org_id
    and extract(year from fecha)::int = p_anio
    and extract(month from fecha)::int = p_mes;

  perform log_audit_event(
    p_org_id,
    'MONTH_CLOSE',
    'cierres_mensuales',
    (select id from cierres_mensuales where organization_id = p_org_id and anio = p_anio and mes = p_mes),
    jsonb_build_object('anio', p_anio, 'mes', p_mes, 'hash', hash_val)
  );

  return hash_val;
end;
$$;

alter table organizations enable row level security;
alter table perfiles enable row level security;
alter table audit_log enable row level security;
alter table clientes enable row level security;
alter table productos_madera enable row level security;
alter table ventas_madera enable row level security;
alter table ventas_madera_lineas enable row level security;
alter table cotizaciones_mueble enable row level security;
alter table cotizacion_cortes enable row level security;
alter table alquileres enable row level security;
alter table movimientos_caja enable row level security;
alter table empleados enable row level security;
alter table periodos_nomina enable row level security;
alter table sueldos enable row level security;
alter table adelantos enable row level security;
alter table alertas_operativas enable row level security;
alter table cierres_mensuales enable row level security;

create policy org_read_organizations on organizations
for select using (id = app.current_org_id());

create policy org_manage_perfiles on perfiles
for all using (organization_id = app.current_org_id())
with check (organization_id = app.current_org_id() and app.current_role() in ('owner_admin', 'gerencia'));

create policy org_read_audit on audit_log
for select using (organization_id = app.current_org_id() and app.current_role() in ('owner_admin', 'gerencia', 'partner_readonly'));

create policy org_insert_audit on audit_log
for insert with check (organization_id = app.current_org_id());

create policy org_data_access_clientes on clientes
for all using (organization_id = app.current_org_id())
with check (organization_id = app.current_org_id());

create policy org_data_access_productos on productos_madera
for all using (organization_id = app.current_org_id())
with check (organization_id = app.current_org_id());

create policy org_data_access_ventas on ventas_madera
for all using (organization_id = app.current_org_id())
with check (organization_id = app.current_org_id());

create policy org_data_access_cotizaciones on cotizaciones_mueble
for all using (organization_id = app.current_org_id())
with check (organization_id = app.current_org_id());

create policy org_data_access_alquileres on alquileres
for all using (organization_id = app.current_org_id())
with check (organization_id = app.current_org_id());

create policy org_data_access_caja on movimientos_caja
for all using (organization_id = app.current_org_id())
with check (
  organization_id = app.current_org_id()
  and app.current_role() in ('owner_admin', 'gerencia', 'operaciones_caja', 'ventas', 'rrhh')
);

create policy org_data_access_empleados on empleados
for all using (organization_id = app.current_org_id())
with check (organization_id = app.current_org_id() and app.current_role() in ('owner_admin', 'gerencia', 'rrhh'));

create policy org_data_access_periodos on periodos_nomina
for all using (organization_id = app.current_org_id())
with check (organization_id = app.current_org_id() and app.current_role() in ('owner_admin', 'gerencia', 'rrhh'));

create policy org_data_access_sueldos on sueldos
for all using (organization_id = app.current_org_id())
with check (organization_id = app.current_org_id() and app.current_role() in ('owner_admin', 'gerencia', 'rrhh'));

create policy org_data_access_adelantos on adelantos
for all using (organization_id = app.current_org_id())
with check (organization_id = app.current_org_id() and app.current_role() in ('owner_admin', 'gerencia', 'rrhh'));

create policy org_data_access_alertas on alertas_operativas
for all using (organization_id = app.current_org_id())
with check (organization_id = app.current_org_id());

create policy org_data_access_cierres on cierres_mensuales
for select using (organization_id = app.current_org_id())
with check (organization_id = app.current_org_id());

grant select on utilidad_mensual to authenticated;

create or replace function ventas_insertar_movimiento_caja()
returns trigger
language plpgsql
as $$
begin
  if new.estado = 'confirmada' then
    insert into movimientos_caja (
      organization_id,
      fecha,
      tipo,
      medio,
      categoria,
      monto,
      descripcion,
      modulo_origen,
      referencia_id,
      created_by,
      updated_by
    )
    values (
      new.organization_id,
      new.fecha,
      'ingreso',
      'efectivo',
      'venta_madera',
      new.total,
      'Ingreso automático por venta confirmada',
      'ventas',
      new.id,
      auth.uid(),
      auth.uid()
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_ventas_ingreso_caja on ventas_madera;
create trigger trg_ventas_ingreso_caja
after insert or update on ventas_madera
for each row execute function ventas_insertar_movimiento_caja();

create or replace function cotizacion_insertar_movimiento_caja()
returns trigger
language plpgsql
as $$
begin
  if new.estado = 'confirmada' then
    insert into movimientos_caja (
      organization_id,
      fecha,
      tipo,
      medio,
      categoria,
      monto,
      descripcion,
      modulo_origen,
      referencia_id,
      created_by,
      updated_by
    )
    values (
      new.organization_id,
      new.fecha,
      'ingreso',
      'efectivo',
      'servicio_corte_mueble',
      new.precio_acordado,
      'Ingreso automático por cotización confirmada',
      'muebles_corte',
      new.id,
      auth.uid(),
      auth.uid()
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_cotizacion_ingreso_caja on cotizaciones_mueble;
create trigger trg_cotizacion_ingreso_caja
after insert or update on cotizaciones_mueble
for each row execute function cotizacion_insertar_movimiento_caja();
