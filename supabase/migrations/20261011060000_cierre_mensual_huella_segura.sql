-- Corrección de resolución de pgcrypto en Supabase. No cambia importes, fórmulas ni cierres existentes.
begin;

create or replace function public.cerrar_mes(p_org_id uuid, p_anio integer, p_mes integer)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  reporte jsonb;
  hash_val text;
begin
  perform public.bloquear_operacion_empresa(p_org_id);
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

  hash_val := encode(extensions.digest(coalesce(reporte::text, '{}'), 'sha256'), 'hex');

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

commit;
