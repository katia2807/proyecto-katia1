-- Plantilla técnica basada en hoja manual (Sr. Carlos - 22/04/2026)
-- Objetivo: dejar una cotización testeable rápidamente en BD real.

do $$
declare
  v_org_id uuid := '00000000-0000-0000-0000-000000000001';
  v_cliente_id uuid;
  v_cotizacion_id uuid;
begin
  -- 1) Cliente de prueba
  insert into public.clientes (organization_id, nombre, telefono, documento)
  select v_org_id, 'Sr. Carlos', '930781012', null
  where not exists (
    select 1
    from public.clientes c
    where c.organization_id = v_org_id
      and c.nombre = 'Sr. Carlos'
      and coalesce(c.telefono, '') = '930781012'
  );

  select c.id
  into v_cliente_id
  from public.clientes c
  where c.organization_id = v_org_id
    and c.nombre = 'Sr. Carlos'
    and coalesce(c.telefono, '') = '930781012'
  limit 1;

  -- 2) Cabecera de cotización (mueble personalizado)
  insert into public.cotizaciones_mueble (
    organization_id,
    cliente_id,
    fecha,
    tipo,
    especie_madera,
    unidad_medida,
    origen_material,
    precio_calculado,
    precio_acordado,
    motivo_ajuste,
    estado
  )
  select
    v_org_id,
    v_cliente_id,
    '2026-04-22',
    'mueble_personalizado',
    'Mixto (pino/cedro referencial)',
    'in',
    'cliente',
    980,
    900,
    'Ropero 2 puertas + 3 cajones, con ajustes según plano manual',
    'confirmada'
  where not exists (
    select 1
    from public.cotizaciones_mueble cm
    where cm.organization_id = v_org_id
      and cm.cliente_id = v_cliente_id
      and cm.fecha = '2026-04-22'
      and cm.precio_acordado = 900
  );

  select cm.id
  into v_cotizacion_id
  from public.cotizaciones_mueble cm
  where cm.organization_id = v_org_id
    and cm.cliente_id = v_cliente_id
    and cm.fecha = '2026-04-22'
    and cm.precio_acordado = 900
  limit 1;

  -- 3) Detalle técnico de cortes (aproximado desde hoja manual)
  if v_cotizacion_id is not null then
    insert into public.cotizacion_cortes (
      cotizacion_id,
      tipo_pieza,
      espesor,
      ancho,
      largo,
      cantidad,
      valor_calculado
    )
    select
      v_cotizacion_id,
      v.tipo_pieza,
      v.espesor,
      v.ancho,
      v.largo,
      v.cantidad,
      v.valor_calculado
    from (
      values
        ('tabla'::text, 1.0::numeric, 8.0::numeric, 13.0::numeric, 1::integer, 34.0::numeric),
        ('tabla'::text, 1.0::numeric, 10.0::numeric, 12.0::numeric, 1::integer, 30.0::numeric),
        ('tabla'::text, 1.0::numeric, 10.0::numeric, 12.0::numeric, 1::integer, 30.0::numeric),
        ('liston'::text, 1.0::numeric, 7.0::numeric, 12.0::numeric, 1::integer, 21.0::numeric),
        ('liston'::text, 1.0::numeric, 7.0::numeric, 16.0::numeric, 1::integer, 28.0::numeric),
        ('liston'::text, 1.0::numeric, 7.0::numeric, 9.0::numeric, 1::integer, 15.0::numeric),
        ('liston'::text, 1.0::numeric, 7.0::numeric, 12.0::numeric, 1::integer, 21.0::numeric)
    ) as v(tipo_pieza, espesor, ancho, largo, cantidad, valor_calculado)
    where not exists (
      select 1
      from public.cotizacion_cortes cc
      where cc.cotizacion_id = v_cotizacion_id
    );
  end if;
end $$;
