-- Estructura ficticia y funciones heredadas consultadas en producción el 10/10/2026.
-- No contiene registros del negocio ni credenciales; reproduce el estado ANTERIOR a la corrección.
create schema auth;create function auth.uid() returns uuid language sql as $$select null::uuid$$;
alter table inventario_productos add column codigo text,add column stock_minimo numeric default 0,
 add column activo boolean default true,add column created_at timestamptz default now(),add column foto_url text;
alter table muebles_catalogo add column codigo text,add column descripcion text,add column precio_lista numeric,
 add column activo boolean default true,add column created_at timestamptz default now(),add column foto_url text;
alter table movimientos_caja add column void_reason text,add column updated_at timestamptz;
alter table alquileres add column activo text,add column fecha_inicio date,add column fecha_termino date,add column tarifa numeric,
 add column representante text,add column ruc_empresa text,add column direccion_ejecucion text,add column dias_alquiler integer,
 add column tarifa_unidad text,add column modalidad_pago text,add column fecha_pago_credito date;
create table cierres_mensuales(id uuid default gen_random_uuid() primary key,organization_id uuid,anio int,mes int,
 reporte_json jsonb,hash_sha256 text,closed_at timestamptz default now(),closed_by uuid,reopened_at timestamptz,reopened_by uuid,reopen_reason text,
 unique(organization_id,anio,mes));
alter table ventas_madera_cortada drop constraint ventas_madera_cortada_cliente_id_fkey;
alter table ventas_madera_cortada add foreign key(cliente_id) references clientes(id) on delete restrict;
alter table ventas_madera_lineas drop constraint ventas_madera_lineas_venta_id_fkey;
alter table ventas_madera_lineas add foreign key(venta_id) references ventas_madera(id) on delete cascade;
alter table muebles_catalogo add CHECK ((stock_disponible >= 0));
alter table ventas_madera_cortada add CHECK ((estado_entrega = ANY (ARRAY['pendiente'::text, 'en_proceso'::text, 'entregado'::text])));
alter table ventas_madera_cortada add CHECK ((jsonb_typeof(lineas_comprobante) = 'array'::text));
alter table ventas_madera_cortada add CHECK ((metodo_pago = ANY (ARRAY['efectivo'::text, 'yape'::text, 'transferencia'::text, 'billetera_digital'::text, 'otro'::text])));
alter table ventas_madera_cortada add CHECK ((modalidad_pago = ANY (ARRAY['contado'::text, 'adelanto'::text, 'credito'::text])));
alter table ventas_madera_cortada add CHECK ((precio_por_pt >= (0)::numeric));
alter table ventas_madera_cortada add CHECK ((tipo_comprobante = ANY (ARRAY['boleta'::text, 'factura'::text, 'ninguno'::text])));
alter table ventas_madera_cortada add CHECK ((tipo_corte = ANY (ARRAY['tabla'::text, 'liston'::text, 'cuarton'::text, 'poste'::text])));
alter table ventas_madera_cortada add CHECK ((tipo_entrega = ANY (ARRAY['puesto_en_obra'::text, 'entrega_local'::text, 'envio'::text])));
alter table ventas_madera_cortada add CHECK ((total >= (0)::numeric));
alter table ventas_madera_cortada add CHECK ((total_pt > (0)::numeric));
CREATE OR REPLACE FUNCTION public.set_update_metadata()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.cancelar_venta_mueble(p_venta_id uuid, p_org_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_venta record;
BEGIN
  SELECT * INTO v_venta
    FROM public.ventas_mueble_terminado
   WHERE id = p_venta_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Venta no encontrada.';
  END IF;

  -- Devolver stock al inventario (sin updated_at)
  UPDATE public.inventario_productos
     SET stock_actual = stock_actual + v_venta.cantidad
   WHERE id = v_venta.mueble_catalogo_id;

  -- Registrar movimiento en kardex
  INSERT INTO public.inventario_movimientos (
    organization_id, producto_id, tipo, cantidad, fecha, referencia
  ) VALUES (
    v_venta.organization_id,
    v_venta.mueble_catalogo_id,
    'ajuste',
    v_venta.cantidad,
    CURRENT_DATE,
    'Cancelación de venta de mueble terminado'
  );

  -- Eliminar la venta
  DELETE FROM public.ventas_mueble_terminado
   WHERE id = p_venta_id;

  RETURN jsonb_build_object(
    'ok', true,
    'venta_id', p_venta_id,
    'stock_devuelto', v_venta.cantidad
  );
EXCEPTION WHEN OTHERS THEN
  RAISE EXCEPTION 'Error al cancelar venta: %', SQLERRM;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.cerrar_mes(p_org_id uuid, p_anio integer, p_mes integer)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;
CREATE OR REPLACE FUNCTION public.descontar_stock_venta_mueble()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  UPDATE public.muebles_catalogo
  SET stock_disponible = stock_disponible - NEW.cantidad
  WHERE id = NEW.mueble_catalogo_id;

  UPDATE public.inventario_productos
  SET stock_actual = stock_actual - NEW.cantidad
  WHERE id = NEW.mueble_catalogo_id;

  RETURN NEW;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.prevent_closed_period_changes()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  if old.periodo_cerrado then
    raise exception 'Este registro pertenece a un período cerrado. No se puede editar ni eliminar.';
  end if;
  return old;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.sync_catalogo_to_inventario()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  -- Si el trigger ya fue disparado de forma indirecta por otra actualización (profundidad > 1), abortar ejecución anidada.
  IF pg_trigger_depth() > 1 THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.inventario_productos (
    id, organization_id, codigo, nombre, categoria, unidad, stock_actual, stock_minimo, activo, created_at, foto_url
  )
  VALUES (
    NEW.id, NEW.organization_id, NEW.codigo, NEW.nombre, 'Muebles', 'unidad', NEW.stock_disponible, 0, NEW.activo, NEW.created_at, NEW.foto_url
  )
  ON CONFLICT (id) DO UPDATE SET
    nombre = EXCLUDED.nombre,
    codigo = EXCLUDED.codigo,
    foto_url = COALESCE(NULLIF(EXCLUDED.foto_url, ''), inventario_productos.foto_url),
    activo = EXCLUDED.activo
  WHERE (
    inventario_productos.nombre IS DISTINCT FROM EXCLUDED.nombre OR
    inventario_productos.codigo IS DISTINCT FROM EXCLUDED.codigo OR
    inventario_productos.foto_url IS DISTINCT FROM COALESCE(NULLIF(EXCLUDED.foto_url, ''), inventario_productos.foto_url) OR
    inventario_productos.activo IS DISTINCT FROM EXCLUDED.activo
  );
  RETURN NEW;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.sync_inventario_to_catalogo()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  -- Si el trigger ya fue disparado de forma indirecta por otra actualización (profundidad > 1), abortar ejecución anidada.
  IF pg_trigger_depth() > 1 THEN
    RETURN NEW;
  END IF;

  IF NEW.categoria = 'Muebles' THEN
    INSERT INTO public.muebles_catalogo (
      id, organization_id, codigo, nombre, descripcion,
      precio_lista, stock_disponible, foto_url, activo, created_at
    )
    VALUES (
      NEW.id, NEW.organization_id, NEW.codigo, NEW.nombre,
      'Producto importado del inventario',
      0, NEW.stock_actual, NEW.foto_url, NEW.activo, NEW.created_at
    )
    ON CONFLICT (id) DO UPDATE SET
      codigo = EXCLUDED.codigo,
      nombre = EXCLUDED.nombre,
      stock_disponible = EXCLUDED.stock_disponible,
      foto_url = COALESCE(NULLIF(EXCLUDED.foto_url, ''), muebles_catalogo.foto_url),
      activo = EXCLUDED.activo
    WHERE (
      muebles_catalogo.codigo IS DISTINCT FROM EXCLUDED.codigo OR
      muebles_catalogo.nombre IS DISTINCT FROM EXCLUDED.nombre OR
      muebles_catalogo.stock_disponible IS DISTINCT FROM EXCLUDED.stock_disponible OR
      muebles_catalogo.foto_url IS DISTINCT FROM COALESCE(NULLIF(EXCLUDED.foto_url, ''), muebles_catalogo.foto_url) OR
      muebles_catalogo.activo IS DISTINCT FROM EXCLUDED.activo
    );
  END IF;
  RETURN NEW;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.sync_stock_from_movimiento()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
declare
  delta numeric;
begin
  delta := case
    when new.tipo = 'entrada_compra' then new.cantidad
    when new.tipo = 'salida_venta' then -new.cantidad
    else new.cantidad
  end;

  update public.inventario_productos
    set stock_actual = greatest(0, stock_actual + delta)
  where id = new.producto_id
    and organization_id = new.organization_id;

  return new;
end;
$function$
;
CREATE TRIGGER trg_sync_stock_from_movimiento AFTER INSERT ON public.inventario_movimientos FOR EACH ROW EXECUTE FUNCTION sync_stock_from_movimiento();
CREATE TRIGGER trg_sync_inventario_to_catalogo AFTER INSERT OR UPDATE ON public.inventario_productos FOR EACH ROW EXECUTE FUNCTION sync_inventario_to_catalogo();
CREATE TRIGGER trg_movimientos_caja_prevent_update BEFORE DELETE OR UPDATE ON public.movimientos_caja FOR EACH ROW EXECUTE FUNCTION prevent_closed_period_changes();
CREATE TRIGGER trg_movimientos_caja_updated BEFORE UPDATE ON public.movimientos_caja FOR EACH ROW EXECUTE FUNCTION set_update_metadata();
CREATE TRIGGER trg_sync_catalogo_to_inventario AFTER INSERT OR UPDATE ON public.muebles_catalogo FOR EACH ROW EXECUTE FUNCTION sync_catalogo_to_inventario();
CREATE TRIGGER trg_descontar_stock_venta_mueble AFTER INSERT ON public.ventas_mueble_terminado FOR EACH ROW EXECUTE FUNCTION descontar_stock_venta_mueble();
